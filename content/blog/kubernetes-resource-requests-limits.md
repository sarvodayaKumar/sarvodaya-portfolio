---
title: "Kubernetes resource requests and limits: getting them right without guessing"
date: 2026-07-03
summary: Requests and limits aren't the same knob. Getting them wrong in either direction has a specific, predictable failure mode.
published: true
---

Requests and limits get treated as one setting with two numbers, but they control two different things — requests drive scheduling, limits drive throttling and eviction. Confusing them is how a service ends up either starved of CPU it was promised or evicted for using memory it was never actually given a hard ceiling on.

## Requests are a scheduling promise, not a cap

```yaml
resources:
  requests:
    cpu: 250m
    memory: 256Mi
```

The scheduler places a pod on a node only if that node has at least `250m` CPU and `256Mi` memory unreserved by other pods' requests. It's a reservation, not a limit — the container can use more than its request if the node has spare capacity, right up until it hits its limit (if one is set) or the node itself runs out.

Setting requests too low packs more pods onto a node than it can actually support once they're all busy simultaneously — everything looks fine until load increases across the whole node at once, and now every pod is competing for CPU that was oversold. Setting requests too high wastes capacity — the scheduler reserves memory the container mostly doesn't use, and the cluster needs more nodes than the actual workload requires.

## Memory limits are a hard wall; CPU limits are a leaky one

Exceed a memory limit and the kernel OOM-kills the container — no warning, no gradual degradation, an immediate SIGKILL. Exceed a CPU limit and the container gets throttled — it keeps running, just slower, which is a much easier failure to miss because nothing crashes. This asymmetry is why memory limits deserve more conservative headroom than CPU limits: getting memory wrong kills the pod, getting CPU wrong just makes it quietly slow, which can sit unnoticed in production for weeks as a latency regression nobody traced back to throttling.

```
kubectl top pod myapp-7d8f9-x2k9p
```

Compare actual usage against `resources.limits.cpu` — a container that's frequently near its CPU limit is being throttled even if it never restarts, and `kubectl describe` won't show that; you have to check `container_cpu_cfs_throttled_seconds_total` in your metrics stack (Prometheus, if that's what's already scraping the cluster) to see it directly.

## QoS class is a side effect of these settings, not a separate thing to configure

Kubernetes derives three QoS classes automatically from requests and limits:

- **Guaranteed** — requests equal limits for every container in the pod. Last to be evicted under node pressure.
- **Burstable** — requests are set but lower than limits. Evicted before Guaranteed pods, in order of how far usage exceeds requests.
- **BestEffort** — no requests or limits set at all. First to be evicted.

A stateful, latency-sensitive service (a database, a cache) usually wants Guaranteed — predictable resources, least likely to be evicted when a node comes under memory pressure. A stateless service that can tolerate a restart and scales horizontally is often fine as Burstable, trading some eviction risk for better bin-packing across the cluster.

## The Horizontal Pod Autoscaler scales against the request, not real usage

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

"70% CPU utilization" is 70% of the CPU *request*, not 70% of the node's actual capacity. A pod with a CPU request set far higher than it typically uses will show low utilization percentages and never trigger scale-out, even under real load — the HPA is technically working correctly, but the request that seemed conservative for scheduling purposes is now silently suppressing autoscaling. Conversely, a request set too low makes the HPA trigger-happy, scaling out on load spikes that a correctly-sized request would have absorbed without adding replicas. Tuning requests and tuning the HPA target are the same problem, not two separate ones — a request that looks reasonable for bin-packing can be actively wrong for how the HPA is supposed to behave.

## Setting real numbers instead of guessing

```
kubectl top pod --all-namespaces
```

or, for a trend rather than a snapshot, whatever's actually feeding your dashboards — Prometheus plus Grafana is the common pairing. The pattern that works: run the service under realistic load, note peak memory and CPU, set the memory limit with roughly 20–30% headroom above observed peak (memory limits are unforgiving, so don't cut it close), and set the CPU request near the p50 usage with the limit — if you set one at all — well above the p99, since throttling a burst is far less damaging than never scheduling the pod because its request was set from a worst-case number.

Vertical Pod Autoscaler in recommendation-only mode is worth turning on before hand-tuning any of this — it watches actual usage over time and gives you numbers grounded in the workload's real behavior instead of a guess made once at deploy time and never revisited.
