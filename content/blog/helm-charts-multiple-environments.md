---
title: Structuring Helm charts for multiple environments without duplicating them
date: 2026-08-02
summary: One chart, per-environment values files, and the templating discipline that keeps staging and production from silently drifting apart.
published: true
tags: [kubernetes]
---

The failure mode that shows up first with Helm isn't a templating bug — it's three copies of a chart, one per environment, that were identical on day one and have quietly diverged ever since. Nobody decided to fork it; someone just needed a slightly different replica count in staging and copy-pasted the whole chart to change one line.

## One chart, values files per environment

```
mychart/
  Chart.yaml
  values.yaml           # shared defaults
  values-staging.yaml    # overrides
  values-production.yaml # overrides
  templates/
    deployment.yaml
    service.yaml
    ingress.yaml
```

```yaml
# values.yaml — the defaults every environment starts from
replicaCount: 2
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    memory: 256Mi
```

```yaml
# values-production.yaml — only what actually differs
replicaCount: 6
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    memory: 1Gi
```

```
helm upgrade myapp ./mychart -f values.yaml -f values-production.yaml
```

The second `-f` merges on top of the first — production only needs to state the handful of values it overrides, not restate the whole configuration. When someone reads `values-production.yaml`, every line in it is a deliberate difference from the baseline, which is the actual audit trail you want when someone asks "why does prod have 6 replicas and staging has 2."

## Templates should branch on values, not on environment names

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}
spec:
  rules:
    - host: {{ .Values.ingress.host }}
```

Not this:

```yaml
{{- if eq .Values.environment "production" }}
# production-only ingress config
{{- end }}
```

The first version means a new environment — a preview environment, a second production region — just needs a values file with `ingress.enabled: true` and the right host. The second version means every new environment requires a template change, and the templates accumulate `if/else` branches keyed on environment names that eventually nobody fully understands.

## `helm template` before `helm upgrade`, every time

```
helm template myapp ./mychart -f values.yaml -f values-production.yaml | less
```

This renders the final manifests without touching the cluster. Running it before every deploy — especially after touching a values file — catches the class of bug where a YAML indentation error or a missing value silently produces a manifest that's valid YAML but not what you meant, before it becomes a `kubectl apply` that partially succeeds against a live cluster.

## Secrets don't belong in any values file, including the encrypted-looking ones

A `values-production.yaml` checked into git is fine for replica counts and resource limits. It's not fine for a database password, even base64-encoded — base64 is an encoding, not encryption, and anyone with repo access can decode it in one command. Reference secrets from `ConfigMap`/`Secret` objects managed outside the chart (External Secrets Operator, Sealed Secrets, or your cloud provider's secret manager), and let the chart only take a reference name:

```yaml
envFrom:
  - secretRef:
      name: {{ .Values.secretName }}
```

## `helm diff` before `helm upgrade`, for the same reason as `terraform plan`

`helm template` shows you the full rendered output; it doesn't show you what's actually about to change on the cluster relative to what's already deployed. The `helm-diff` plugin closes that gap:

```
helm diff upgrade myapp ./mychart -f values.yaml -f values-production.yaml
```

This diffs the rendered manifests against the release currently running in the cluster, not against a previous local file — which catches the case `helm template` can't: someone ran `kubectl edit` directly against a running deployment (the same class of drift Terraform users deal with against cloud APIs), and the next `helm upgrade` would silently revert it. Seeing that diff before running upgrade is the difference between a deliberate decision and a surprised one.

## Hooks run outside the normal ordering — treat them with suspicion

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-migrate
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
```

A `pre-upgrade` hook running a database migration is a common and reasonable pattern — but a hook Job that fails doesn't roll back the release the way a failed main-chart resource does by default, and a hook that hangs can block the entire upgrade indefinitely if it has no `activeDeadlineSeconds`. Any hook doing something with real consequences (schema migrations, cache invalidation) needs its own timeout and its own failure handling — Helm's hook mechanism runs it, but doesn't make it safe on your behalf.

## What this buys you

The real payoff of one chart plus values files isn't less YAML — it's that a diff between `values-staging.yaml` and `values-production.yaml` is a complete, honest answer to "how does production differ from staging." Three forked charts can't give you that answer without someone diffing entire directory trees and hoping they didn't miss a template that also changed.
