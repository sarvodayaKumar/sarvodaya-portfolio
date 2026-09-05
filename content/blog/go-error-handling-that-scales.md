---
title: Error handling patterns in Go that survive past the happy path
date: 2026-08-18
summary: if err != nil is easy to write and easy to make useless. Patterns for wrapping, sentinel errors, and when to panic instead.
published: true
tags: [go]
---

Go's error handling gets criticized for being verbose, but verbose isn't the problem. The problem is that `if err != nil { return err }` on every line gives you a stack trace with no story — you know something failed three layers down, but not what the caller was trying to do when it happened.

## Wrap with context, not just `%w`

`fmt.Errorf("%w", err)` preserves the error for `errors.Is`/`errors.As`, but on its own it just re-throws. Add the fact that mattered at that call site:

```go
func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
    row := s.db.QueryRowContext(ctx, userByIDQuery, id)
    var u User
    if err := row.Scan(&u.ID, &u.Name, &u.Email); err != nil {
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return &u, nil
}
```

Every layer that wraps adds one clause. By the time it surfaces in a log line, you have a sentence, not a stack of "failed to X" repeated five times.

## Sentinel errors are an API contract

`sql.ErrNoRows` is not the same failure as a dropped connection, and callers need to tell them apart:

```go
var ErrUserNotFound = errors.New("user not found")

func (s *Store) GetUser(ctx context.Context, id string) (*User, error) {
    row := s.db.QueryRowContext(ctx, userByIDQuery, id)
    var u User
    if err := row.Scan(&u.ID, &u.Name, &u.Email); err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, ErrUserNotFound
        }
        return nil, fmt.Errorf("get user %s: %w", id, err)
    }
    return &u, nil
}
```

Now the HTTP handler can do `errors.Is(err, ErrUserNotFound)` and return a 404 without string-matching an error message — which breaks the moment someone rewords the log line.

## Custom error types when you need structured data

Sentinel errors are fine for "which case is this," but sometimes the caller needs a field, not just a category — a validation error naming which field failed, or a rate-limit error carrying the retry-after duration.

```go
type ValidationError struct {
    Field string
    Msg   string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}
```

`errors.As(err, &validationErr)` pulls it back out anywhere up the call stack, structured, without parsing strings.

## panic is for programmer errors, not runtime failures

A missing config value at startup, a nil pointer that should be structurally impossible, an invariant your own code violated — those can panic, because there's no sane way to continue and the fix is a code change, not a retry. A failed database query, a timeout, a 404 from a downstream API — those are errors, because the caller has a legitimate reason to happen and a legitimate way to handle it (retry, fallback, surface to the user). If you're reaching for `recover()` to turn panics back into errors at a service boundary, that's usually a sign the inner code panicked for something that should have just returned an error in the first place.

## Retries turn a transient error into a correctness problem

A timeout calling a payment API isn't necessarily a failure — the request might have succeeded and only the response was lost. Retrying blindly can double-charge a customer; not retrying at all means a flaky network turns into a support ticket. The fix isn't cleverer error handling, it's making the operation itself safe to repeat:

```go
func (s *Store) CreatePayment(ctx context.Context, idempotencyKey string, amount int) (*Payment, error) {
    existing, err := s.findByIdempotencyKey(ctx, idempotencyKey)
    if err == nil {
        return existing, nil // already happened, return the prior result
    }
    if !errors.Is(err, ErrNotFound) {
        return nil, fmt.Errorf("check idempotency key: %w", err)
    }
    return s.insertPayment(ctx, idempotencyKey, amount)
}
```

With that in place, a retry loop is safe to add on top:

```go
func retryWithBackoff(ctx context.Context, attempts int, fn func() error) error {
    var err error
    for i := 0; i < attempts; i++ {
        if err = fn(); err == nil {
            return nil
        }
        if !isRetryable(err) {
            return err
        }
        select {
        case <-time.After(time.Duration(i+1) * 200 * time.Millisecond):
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return err
}
```

`isRetryable` matters as much as the backoff itself — retrying a `400 Bad Request` just repeats a request that was never going to succeed, three more times, slower each time. Only network errors, timeouts, and `5xx`/`429` responses belong in a retry loop; a `4xx` is the server telling you the request itself is wrong, and no amount of retrying fixes that.

## The actual scaling problem

None of this is about making individual functions prettier. It's about what happens when three teams are debugging a production incident from a log aggregator at 2am. Wrapped errors with context turn into a readable trail. Sentinel errors and typed errors let the code that's paging someone make a decision instead of grepping for a substring. That's the whole payoff — error handling that scales is error handling that someone else can act on without reading your source.
