---
title: Context propagation and cancellation in Go services
date: 2026-06-12
summary: context.Context is easy to thread through a call stack and easy to misuse. Cancellation, deadlines, and what not to put in context.Value.
published: true
---

`context.Context` shows up as the first argument in almost every function signature in a Go service, which makes it tempting to treat it as a junk drawer. It has exactly two jobs: carrying cancellation/deadlines, and carrying request-scoped values that genuinely cross API boundaries — a trace ID, not your business logic.

## Deadlines have to propagate, not just exist

Setting a timeout at the top of a request handler does nothing if the code three layers down doesn't respect the context it was handed:

```go
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
    defer cancel()

    order, err := h.store.GetOrder(ctx, chi.URLParam(r, "id"))
    // ...
}

func (s *Store) GetOrder(ctx context.Context, id string) (*Order, error) {
    row := s.db.QueryRowContext(ctx, orderByIDQuery, id) // respects ctx deadline
    // ...
}
```

The moment a function swaps `QueryRowContext` for `QueryRow`, or an outbound HTTP call uses `http.Get` instead of `http.NewRequestWithContext`, the deadline you set upstream stops mattering. A request can hang well past its stated timeout because one call three hops down silently ignored the context it was given.

## Cancellation should stop work, not just get checked

`ctx.Err()` tells you cancellation happened; it doesn't stop anything by itself. In a loop doing real work, check it explicitly:

```go
func processItems(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ctx.Err()
        default:
        }
        if err := process(item); err != nil {
            return err
        }
    }
    return nil
}
```

Without that check, a client that disconnects mid-request doesn't free up the goroutine doing the work — it keeps running to completion, burning CPU and holding a database connection for a caller that's no longer listening.

## `context.Value` is for request metadata, not parameters

The Go team's own guidance is narrow here for a reason: values pulled from context are untyped, unchecked at compile time, and easy to make required by accident. A trace ID or an auth principal set once at the edge of a request and read many layers down — fine, that's the exact use case. A database connection, a config struct, a `*sql.Tx` — those should be explicit function parameters, not context values. If a function's real dependencies are invisible to its signature, every caller has to read the implementation to know what it actually needs, and the compiler can't help you when a required value is missing.

## Fan-out calls need one canceled context, not several unrelated ones

When a handler calls three downstream services concurrently and cares about all three succeeding, derive from a single parent context so a caller-side cancellation actually cancels every in-flight call:

```go
func (s *Aggregator) GetSummary(ctx context.Context, id string) (*Summary, error) {
    g, ctx := errgroup.WithContext(ctx)
    var orders []Order
    var user User

    g.Go(func() error {
        var err error
        orders, err = s.orderClient.List(ctx, id)
        return err
    })
    g.Go(func() error {
        var err error
        user, err = s.userClient.Get(ctx, id)
        return err
    })

    if err := g.Wait(); err != nil {
        return nil, err
    }
    return &Summary{User: user, Orders: orders}, nil
}
```

`errgroup.WithContext` cancels the shared context the instant any one call fails, so the other in-flight call gets torn down instead of finishing a request nobody needs the result of anymore.

## A goroutine that outlives its context is a leak with a delay

Spawning a goroutine from a request handler and passing it the request's context looks safe — it isn't, if the goroutine is meant to keep running after the handler returns:

```go
func (h *Handler) TriggerExport(w http.ResponseWriter, r *http.Request) {
    go func() {
        // r.Context() is canceled the instant the handler returns —
        // this export gets killed mid-run on every single request.
        exportData(r.Context())
    }()
    w.WriteHeader(http.StatusAccepted)
}
```

The request context is canceled as soon as the HTTP handler function returns, which for a `202 Accepted`-then-background-work pattern is almost immediately. The fix is deriving a new, independent context for work that must survive the request that triggered it:

```go
func (h *Handler) TriggerExport(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
    go func() {
        defer cancel()
        exportData(ctx)
    }()
    w.WriteHeader(http.StatusAccepted)
}
```

`context.Background()` here, not `r.Context()` — this goroutine's lifetime is intentionally decoupled from the request that started it, bounded by its own timeout instead. This is also exactly the case where a proper job queue (or at minimum a bounded worker pool) usually belongs instead of a bare `go func()` — an unbounded number of these per incoming request is how a traffic spike turns into an unbounded number of background goroutines competing for the same downstream resources.

That's the actual payoff of taking context seriously — not cleaner-looking function signatures, but a service that stops doing wasted work the moment a caller stops waiting for it, and doesn't spawn work that outlives its own reason for existing.
