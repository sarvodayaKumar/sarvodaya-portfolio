---
title: Table-driven tests in Go that actually catch regressions
date: 2026-09-05
summary: The table-driven pattern is easy to write badly — a table of happy-path inputs that never exercises the code that actually breaks in production.
published: true
tags: [go]
---

Every Go codebase past a certain size has table-driven tests, and a lot of them share the same weakness: the table is full of cases that all take the same path through the function. Passing tests, near-zero coverage of the branches that matter.

## The pattern itself

```go
func TestValidateOrder(t *testing.T) {
    tests := []struct {
        name    string
        order   Order
        wantErr string
    }{
        {
            name:  "valid order",
            order: Order{Quantity: 1, Price: 10.00},
        },
        {
            name:    "zero quantity",
            order:   Order{Quantity: 0, Price: 10.00},
            wantErr: "quantity must be positive",
        },
        {
            name:    "negative price",
            order:   Order{Quantity: 1, Price: -5.00},
            wantErr: "price must be positive",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateOrder(tt.order)
            if tt.wantErr == "" {
                if err != nil {
                    t.Fatalf("unexpected error: %v", err)
                }
                return
            }
            if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
                t.Fatalf("want error containing %q, got %v", tt.wantErr, err)
            }
        })
    }
}
```

`t.Run` matters more than it looks like it should: it names each case in test output, so a failure tells you which row broke instead of just which function. It also means `go test -run TestValidateOrder/negative_price` isolates one case without commenting out the rest of the table.

## Design the table around branches, not around inputs you thought of

The table above covers three cases because three cases came to mind, not because someone looked at `ValidateOrder`'s actual branches and asked which ones are untested. The more reliable process: read the function, list every `if`/`switch` branch and every early return, then write one case per branch. If the function has a branch for "quantity exceeds max order size," and that branch has no row in the table, the test suite has a gap the table's readability made easy to miss.

## Table-driven tests are the wrong shape for stateful sequences

A table row describes one input and one expected output — that fits pure functions cleanly. It fits a test like "create an order, then cancel it, then verify it can't be shipped" much worse, because now each row secretly depends on a sequence of calls, and the table stops being a table. When a test needs setup, an action, then an assertion that depends on prior state, write it as a normal sequential test function instead of forcing it into rows just because the file already has a table pattern in it.

## Assert behavior, not implementation

```go
// Brittle — breaks if the error message wording changes, tests nothing about behavior
if err.Error() != "order validation failed: quantity must be positive" {

// Better — tests what callers actually depend on
if !errors.Is(err, ErrInvalidQuantity) {
```

A test that string-matches an error message fails the moment someone rewords a log line, and passes even if the actual validation logic is wrong, as long as the string happens to match. Asserting against a sentinel error or a typed field tests the contract the caller relies on, not the prose.

## Go's built-in fuzzer finds the row you didn't think to write

A table only covers the inputs someone thought of. For a function parsing untrusted input — a query param, a header, a file format — that's exactly the category of function where the bug lives in an input nobody thought of:

```go
func FuzzParseAmount(f *testing.F) {
    f.Add("10.50") // seed corpus — known-good and known-bad examples
    f.Add("-5")
    f.Add("")

    f.Fuzz(func(t *testing.T, input string) {
        amount, err := ParseAmount(input)
        if err != nil {
            return // an error is a valid outcome for bad input
        }
        if amount < 0 {
            t.Fatalf("ParseAmount(%q) returned negative amount %v with no error", input, amount)
        }
    })
}
```

```
go test -fuzz=FuzzParseAmount -fuzztime=30s
```

The fuzzer generates inputs by mutating the seed corpus — flipping bytes, inserting Unicode, truncating strings — and any input that crashes the function or violates the invariant in the fuzz target gets saved to `testdata/fuzz/` as a permanent regression test. This is the tool for the specific bug a table can't reach: not "does this handle the three cases I imagined," but "does this handle literally anything a caller could pass in."

## What "actually catch regressions" means in practice

A test suite with 90% line coverage and every row exercising the same branch gives you a false sense of safety — the coverage number went up, but a real bug in the untested branch ships anyway. The table-driven pattern is a good shape for organizing test cases; it isn't a substitute for reading the function you're testing and asking what could actually go wrong in it.
