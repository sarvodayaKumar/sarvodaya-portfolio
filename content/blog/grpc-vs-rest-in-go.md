---
title: "gRPC vs REST in Go: picking the right one for internal services"
date: 2026-08-27
summary: REST won't disappear and gRPC isn't automatically faster. Where each one actually wins when you're wiring up Go microservices.
published: true
---

Every "gRPC vs REST" post eventually says "it depends," and then doesn't say on what. Here's what actually moves the decision when you're building Go services that talk to each other.

## gRPC wins when the contract needs to be enforced, not just documented

A `.proto` file is a schema the compiler checks. If a service adds a required field, every generated client breaks the build until it's updated. A REST API's contract lives in an OpenAPI spec or, more often, in someone's memory — nothing stops a handler from silently dropping a field a consumer depends on.

For internal service-to-service calls where both ends are Go and you control the release cadence, that compile-time enforcement is worth the extra step of running `protoc`. For a public API where you don't control who's consuming it and can't force a client rebuild, that same rigidity becomes a liability — you can't loosen a contract clients depend on without a version bump and a deprecation window.

## REST wins on debuggability and reach

`curl` and a browser can talk to REST. Postman, your load balancer's health checks, that one bash script from three years ago that still exists in a cron job — that entire tooling ecosystem understands HTTP/JSON without any code generation. gRPC's binary protobuf frames need `grpcurl` or a generated client to even read a payload during an incident. When you're debugging a production issue at 2am, the ability to `curl` an endpoint and read the JSON with your own eyes is worth more than the encoding efficiency you gave up.

## Where gRPC actually pays for itself

Streaming is the case REST genuinely can't do cleanly. Bidirectional streaming, server-side streaming for large paginated result sets, or long-lived connections where the client needs a live feed — that's built into gRPC's model, and it's what you'd otherwise bolt on with WebSockets or long polling and reimplement badly.

The other real win is in high-fanout internal calls: a Go service that calls five other Go services per request feels the protobuf serialization savings and HTTP/2 multiplexing at real scale. At low request volume, you won't notice the difference; at the volume where a REST-plus-JSON service starts spending real CPU on marshaling, gRPC's numbers start to matter.

## What this looks like in a real Go service

```go
// REST handler — easy to test with curl, easy for any client to consume
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    order, err := h.store.GetOrder(r.Context(), id)
    if err != nil {
        http.Error(w, err.Error(), http.StatusNotFound)
        return
    }
    json.NewEncoder(w).Encode(order)
}
```

```go
// gRPC — the .proto is the contract, generated code enforces it
func (s *OrderServer) GetOrder(ctx context.Context, req *pb.GetOrderRequest) (*pb.Order, error) {
    order, err := s.store.GetOrder(ctx, req.GetId())
    if err != nil {
        return nil, status.Errorf(codes.NotFound, "order %s not found", req.GetId())
    }
    return order, nil
}
```

## Versioning is where the two models diverge the most

Protobuf's field-number-based wire format makes additive changes free: adding a new field with a new number never breaks old clients, because they simply ignore fields they don't recognize. What it doesn't forgive is reusing a field number after removing a field, or changing a field's type — either one produces bytes that decode into a completely different value on the wire, silently, with no error:

```protobuf
message Order {
  string id = 1;
  int32 quantity = 2;
  // reserved 3; — do this instead of letting the next field reuse it
  string customer_id = 4;
}
```

`reserved` is the detail that prevents a class of bug that's nearly impossible to debug after the fact — a field number quietly reused six months later, decoding old serialized data (or a client still running an older generated stub) into the wrong field.

REST has no compiler-enforced equivalent. Versioning is a convention — a `/v2/` path segment or an `Accept` header — that costs nothing until a consumer misses the deprecation notice for `/v1/` and it needs to be supported for another year longer than planned. Neither model prevents breaking changes on its own; protobuf just makes the *non-breaking* changes safe by default, where REST makes them safe only if the team maintains the discipline to keep them additive.

## The pragmatic default

Public-facing APIs and anything a non-Go client or a human needs to poke at: REST. Internal service mesh calls between services you own, especially anywhere you need streaming or you're paying real CPU for JSON marshaling at scale: gRPC. Most teams don't need to pick one dogmatically — a Go service exposing REST at the edge and gRPC internally between its own dependents is a completely normal shape, and it's usually the one that survives contact with actual traffic.
