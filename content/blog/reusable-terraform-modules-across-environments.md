---
title: Structuring reusable Terraform modules across environments
date: 2026-08-22
summary: A module used in three environments and copy-pasted three times isn't reusable, it's forked. Variables, outputs, and workspaces done right.
published: true
---

A Terraform module is reusable the moment a second environment can consume it without editing its source — the instant someone opens the module's `.tf` files to change a value for a specific environment, it's stopped being a shared module and started being three environment-specific copies that happen to still look identical today.

## Inputs and outputs are the entire interface

```
modules/network/
  main.tf
  variables.tf
  outputs.tf
```

```hcl
# variables.tf — every knob an environment might need to turn
variable "environment" {
  type = string
}

variable "cidr_block" {
  type = string
}

variable "az_count" {
  type    = number
  default = 2
}
```

```hcl
# outputs.tf — everything a caller might need downstream
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
```

A module with no `outputs.tf`, or one that only exports what the original author happened to need, forces every new consumer to either duplicate resources to get at a value the module already computed, or go edit the module to add the output — at which point it's drifting from a shared module toward an environment-specific fork again.

## Environments are callers, not branches inside the module

```hcl
# environments/staging/main.tf
module "network" {
  source      = "../../modules/network"
  environment = "staging"
  cidr_block  = "10.0.0.0/16"
  az_count    = 2
}
```

```hcl
# environments/production/main.tf
module "network" {
  source      = "../../modules/network"
  environment = "production"
  cidr_block  = "10.1.0.0/16"
  az_count    = 3
}
```

The module itself contains zero references to "staging" or "production" — every environment-specific value comes in through a variable. If the module needs an `if var.environment == "production"` branch to behave differently, that's usually a sign the actual difference should be an explicit variable (`enable_nat_gateway`, `instance_count`) rather than a name the module is pattern-matching against. Naming the environment is a caller's business; branching on it inside shared logic reintroduces the coupling reusability was supposed to remove.

## Workspaces solve a narrower problem than they look like they solve

`terraform workspace new staging` gives each workspace its own state file under one configuration, which looks like exactly what multi-environment needs. It works cleanly when every environment is structurally identical and only differs in variable values. It works poorly the moment one environment needs a resource the others don't — a production-only read replica, a staging-only debug endpoint — because now the shared configuration needs conditionals to handle an environment-specific resource, and that's the same coupling problem as above, just moved into the root module instead of a child module.

Separate directories per environment (as in the example above) avoid that entirely: each environment's root module can genuinely differ in what it calls, not just in the values it passes, while still calling the exact same shared child modules for everything that is common.

## Pin module versions, don't float on a branch

```hcl
module "network" {
  source  = "git::https://github.com/org/tf-modules.git//network?ref=v2.3.0"
  # ...
}
```

A `ref` pinned to a branch name means every environment picks up every change the moment someone merges to that branch — including a change made and tested only against staging's use case. A pinned tag means production upgrades to a new module version deliberately, on its own schedule, after staging has actually run it.

## Composition depth has a real limit before it stops being readable

A module calling a module calling a module looks like clean separation of concerns right up until someone needs to trace why a specific security group rule exists, and that trail runs three levels deep through modules none of which show the actual resource in their own source:

```
environments/production/main.tf
  → modules/app-platform (calls network + compute)
    → modules/network (calls security-groups)
      → modules/security-groups (the actual aws_security_group_rule)
```

Two levels — a root module composing shared child modules — is usually the depth that stays debuggable: `terraform plan` output, resource addresses, and state paths are all still short enough to reason about directly. A third or fourth level of nesting usually means a module is being built for reuse that doesn't exist yet, not reuse that's actually happening — the sign to flatten is when someone has to open three files in sequence just to find where a resource is actually declared, and "which module do I even edit" becomes a real question during an incident.

## The test for whether a module is really reusable

Add a new environment. If that only means writing a new set of variable values and calling the same module, the module is reusable. If it means opening the module's source to add a conditional, a new resource block, or a special case — it was never really shared, it was one environment's configuration wearing a module's clothing.
