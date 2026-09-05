---
title: "Structuring a Go microservice: packages, layering, and the god-package trap"
date: 2026-07-22
summary: Go doesn't force an architecture on you, which means a service either gets a deliberate shape or slowly turns into one giant package.
published: true
tags: [go]
---

Go's lack of opinions about project layout is a feature until a service has six engineers touching it and every new type lands in the same `models` package because that's where the last five went. A structure that scales isn't about following a specific template — it's about making the dependency direction obvious from the folder layout alone.

## `internal/` is the boundary that actually matters

Anything under `internal/` can't be imported by another module — the compiler enforces it. That's the real reason to use it: it's not documentation of intent, it's a hard boundary between "this is our implementation" and "this is what we expose." A service with a public client library should have that client in its own top-level package, and everything it depends on internally — the store, the handlers, the business logic — under `internal/`.

```
myservice/
  cmd/myservice/main.go       // wiring only
  internal/
    api/          // HTTP/gRPC handlers, thin
    store/        // database access
    order/        // business logic for orders
  pkg/client/     // public Go client, importable by other services
```

## Layer by dependency direction, not by file type

A `handlers/`, `models/`, `utils/` split organizes files by what they are, not by what depends on what. The layering that holds up under growth is: handlers depend on business logic, business logic depends on interfaces, and storage implements those interfaces. The business logic package should never import the HTTP package — if it does, you can't test it without spinning up a server, and you can't reuse it behind a gRPC endpoint later without a rewrite.

```go
// internal/order/service.go — no import of net/http, no import of database/sql
type Store interface {
    GetOrder(ctx context.Context, id string) (*Order, error)
}

type Service struct {
    store Store
}

func (s *Service) GetOrder(ctx context.Context, id string) (*Order, error) {
    order, err := s.store.GetOrder(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("get order %s: %w", id, err)
    }
    return order, nil
}
```

The `Store` interface is defined in the package that *uses* it, not the package that implements it — that's the Go idiom that keeps `internal/order` independent of whether storage is Postgres today and something else later. `internal/store` implements the interface; it doesn't define it.

## Wiring belongs in `main`, nowhere else

Dependency injection frameworks are rarely worth it in Go — what you actually need is one function that constructs everything in the right order and passes it down:

```go
func main() {
    db := mustConnect(os.Getenv("DATABASE_URL"))
    store := store.New(db)
    orderSvc := order.NewService(store)
    handler := api.NewHandler(orderSvc)

    log.Fatal(http.ListenAndServe(":8080", handler.Routes()))
}
```

If a package other than `main` is calling `os.Getenv` or opening a database connection, that's a sign it's doing wiring work that belongs at the top, and it's also a sign that package just got harder to unit test — anything that reaches into the environment directly can't be swapped out in a test without mutating global state.

## The layering pays for itself the first time you write a test

The reason to define `Store` as an interface inside `internal/order` rather than importing the concrete Postgres type directly shows up the moment you write `service_test.go`:

```go
type fakeStore struct {
    orders map[string]*Order
}

func (f *fakeStore) GetOrder(ctx context.Context, id string) (*Order, error) {
    o, ok := f.orders[id]
    if !ok {
        return nil, ErrNotFound
    }
    return o, nil
}

func TestService_GetOrder_NotFound(t *testing.T) {
    svc := &Service{store: &fakeStore{orders: map[string]*Order{}}}
    _, err := svc.GetOrder(context.Background(), "missing")
    if !errors.Is(err, ErrNotFound) {
        t.Fatalf("want ErrNotFound, got %v", err)
    }
}
```

No database connection, no test container, no network — this test runs in milliseconds and exercises real business logic. That's only possible because `Service` depends on an interface it owns, not a concrete `*sql.DB`-backed struct from another package. A service that imports its storage layer concretely can still be tested, but only with an actual database behind it — which means every business-logic test pays the cost of a database round trip, and the test suite that should run in seconds starts taking minutes.

## The actual failure mode to avoid

The god-package doesn't happen because someone decided to build one. It happens because the first few types went into `models` for convenience, and every addition after that followed the path of least resistance. The fix isn't a stricter template — it's asking, for every new type, "what does this depend on, and what should depend on it," and putting it where that answer is obvious from the import graph. A service that's easy to navigate six months in is one where the folder structure answers that question before you open a single file.
