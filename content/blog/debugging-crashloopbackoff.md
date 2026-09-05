---
title: A field checklist for debugging CrashLoopBackOff
date: 2026-09-01
summary: The status tells you the pod is restarting, not why. A practical order of operations for finding the actual cause.
published: true
tags: [kubernetes]
---

`CrashLoopBackOff` isn't an error — it's Kubernetes telling you it gave up restarting a container that keeps exiting, with the backoff delay growing each time. The actual cause is somewhere in the container's exit, and the fastest path to it is a fixed order of checks, not guessing.

## Start with the exit code, not the logs

```
kubectl describe pod myapp-7d8f9-x2k9p
```

Look at `Last State` under the container status. The exit code narrows the search before you've read a single log line:

- **Exit code 0** — the process exited cleanly. If Kubernetes is restarting a container that thinks it finished successfully, the container's main process isn't meant to be long-running, or it's finishing before the process it's supposed to wrap does.
- **Exit code 1** — an unhandled application error. Go straight to logs.
- **Exit code 137** — SIGKILL, almost always OOMKilled. Check `Last State: Terminated, Reason: OOMKilled` in the same describe output before looking anywhere else.
- **Exit code 143** — SIGTERM, usually the app not shutting down within `terminationGracePeriodSeconds` and getting killed.

## OOMKilled means the limit, not the app, is usually the first thing to check

```
kubectl top pod myapp-7d8f9-x2k9p
```

If actual memory usage is consistently near the configured `resources.limits.memory`, the fix is either raising the limit or finding the actual leak — and those are different investigations. A container that grows memory linearly under load and gets killed at the same threshold every time is a leak. A container that gets OOMKilled once under a traffic spike and otherwise runs fine below the limit is usually just under-provisioned.

## Logs from the crashed container, not the new one

```
kubectl logs myapp-7d8f9-x2k9p --previous
```

`--previous` is the detail people forget. Without it, you're reading logs from the container that just started (and hasn't crashed yet), not the one that actually failed. This is the single most common reason "I checked the logs and they look fine" doesn't match the actual crash.

## Liveness probes that kill a healthy container

A liveness probe with too short a timeout or too aggressive a failure threshold restarts a container that's simply slow to start, not actually broken. Check the probe config against how long the app actually takes to become ready:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
```

If the app takes 15 seconds to warm up (loading a cache, connecting to a database pool) and `initialDelaySeconds` is 10, the probe starts checking before the app can answer, fails three times in 15 seconds, and Kubernetes restarts a container that was about to become healthy. Compare `initialDelaySeconds + (periodSeconds * failureThreshold)` against actual startup time, not against a value that looked reasonable when the manifest was written.

## Config and secrets that don't exist yet

A container crashing immediately, every time, with no real log output before it dies, is often a missing `ConfigMap` or `Secret` reference — the pod fails to even mount the volume or inject the env var, and the app panics on a nil config value before logging anything useful:

```
kubectl get events --sort-by=.lastTimestamp -n myns
```

Events surface `FailedMount` and similar scheduling/mounting failures that never make it into the application's own log stream, because the application never got far enough to start logging.

## Init containers fail silently into the same status

A pod stuck in `CrashLoopBackOff` that shows a container never even starting properly is sometimes not the main container's fault at all — an init container that fails leaves the pod status looking similar, but `kubectl describe` shows it distinctly if you read the container list carefully:

```
kubectl get pod myapp-7d8f9-x2k9p -o jsonpath='{.status.initContainerStatuses[*].state}'
```

An init container that keeps failing (a database migration that errors, a config-fetch step hitting a network policy it doesn't have an exception for) blocks the main container from ever starting, and the pod's overall status still reports `CrashLoopBackOff` or `Init:CrashLoopBackOff` — easy to misread as the application itself crashing when the application container has never actually run yet.

## Readiness probes can mask a crash as "still starting"

A container that's actually crash-looping but has a generous `failureThreshold` on its readiness probe can sit in a state where `kubectl get pods` shows `0/1 Running` for longer than expected, because Kubernetes hasn't yet decided the probe has failed enough times to matter. Cross-checking `kubectl get pod -w` (watch mode) against `kubectl describe`'s restart count over the same window tells you whether the pod is actually restarting or just slow to pass its first readiness check — two very different problems that look similar from a dashboard showing "not ready" with no further context.

## The order that actually saves time

`describe` for the exit code and events → `--previous` logs matched to that exit code → resource usage if it was OOMKilled → probe timing if it wasn't. Reading application logs first, before checking which of these five categories the crash actually falls into, is the most common way to spend twenty minutes staring at log lines that have nothing to do with why the container died.
