---
title: Terraform state drift, detecting it before it detects you
date: 2026-08-10
summary: State drift isn't a Terraform bug, it's what happens when reality and the state file disagree. Catching it early is a process problem, not a tooling one.
published: true
tags: [terraform]
---

Drift happens the moment anyone or anything changes infrastructure outside Terraform — a manual console fix during an incident, another automation tool, a cloud provider auto-scaling a value Terraform also manages. The state file doesn't know, and it keeps believing what it last wrote until something forces it to check.

## `terraform plan` already tells you, if you run it

The mechanism is not exotic — `plan` calls each provider's Read function, compares the result against state, and shows a diff. Drift detection is just running `plan` regularly enough that the diff surfaces before it causes an incident, not after:

```
terraform plan -detailed-exitcode
```

The exit code is the part worth building automation around: `0` means no changes, `1` means an error, `2` means changes exist. A scheduled CI job that runs this nightly and alerts on exit code `2` turns drift from "someone notices during the next real deploy, possibly weeks later" into "someone gets a Slack message the morning after it happened."

## `-refresh-only` separates detection from action

```
terraform plan -refresh-only
```

This shows what changed in the real infrastructure without proposing any changes back — it answers "what drifted" without also asking "should Terraform revert it." That separation matters because the answer to drift isn't always "put it back." Sometimes the manual change was the correct emergency fix and the configuration needs to catch up to it, not the other way around.

```
terraform apply -refresh-only
```

applying a refresh-only plan updates the state file to match reality without touching any actual infrastructure — the right move when the drifted value should become the new source of truth and the `.tf` files need to be edited to match it afterward.

## Not all drift is equal — some of it is a provider bug

Before treating every diff as real infrastructure drift, rule out schema issues: a field that's genuinely computed by the API but not marked `Computed` in the resource schema will show as "changing" on every plan even though nothing changed. That's not drift, it's a provider bug, and no amount of `-refresh-only` fixes it — the resource schema needs the fix.

```go
"generated_id": {
    Type:     schema.TypeString,
    Computed: true, // missing this causes permanent false-positive diffs
},
```

If a specific field shows a diff on every single plan regardless of what changed in the actual infrastructure, check the schema before assuming someone is manually touching that field outside Terraform.

## Preventing drift is cheaper than detecting it

The most reliable fix for drift isn't better detection — it's removing the console access that causes it. IAM policies that make the Terraform-managed resource types read-only outside the CI/CD pipeline's service principal turn "someone might change this manually" into "nobody can, structurally." Detection is the safety net for the drift that still happens despite that — a break-glass emergency change, a resource type IAM couldn't fully lock down, a third-party integration nobody accounted for.

## Import blocks turn "found drift" into "adopted it" declaratively

Older Terraform required `terraform import` as an imperative, one-off CLI command — easy to run once and forget to commit the resulting configuration change. Since Terraform 1.5, an `import` block makes adoption part of the plan itself:

```hcl
import {
  to = aws_instance.web
  id = "i-0123456789abcdef0"
}

resource "aws_instance" "web" {
  ami           = "ami-0abcdef1234567890"
  instance_type = "t3.micro"
}
```

```
terraform plan
```

shows exactly what Terraform would change to bring the resource in line with the configuration — before anything is adopted, and reviewable in the same pull request as the configuration change. This is the natural complement to routine drift detection: detection tells you a resource exists outside Terraform's control; the import block is how that resource formally becomes managed, with the same review process as any other infrastructure change instead of a manual command someone ran locally.

## What actually goes wrong without this

Drift that goes undetected for months doesn't cause a dramatic incident on day one — it causes a much worse one weeks later, when someone runs `terraform apply` for an unrelated change and it silently reverts three other things that were manually fixed since the state file was last accurate, because Terraform genuinely doesn't know those changes were intentional. Regular drift detection is what turns that surprise into a routine, boring diff review instead.
