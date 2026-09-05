---
title: Acceptance testing Terraform providers with terraform-plugin-testing
date: 2026-07-14
summary: Unit tests can't catch a provider bug that only shows up against the real API. Acceptance tests run the actual lifecycle against real infrastructure.
published: true
tags: [terraform, go]
---

A provider resource can pass every unit test and still be broken, because unit tests mock the API client — they prove your Go code calls the mock correctly, not that the mock reflects what the real API actually does. Acceptance tests close that gap by running `plan` → `apply` → `plan` (again, to verify no drift) → `destroy` against the real API.

## The basic shape of a `TestAccXxx` test

```go
func TestAccWidgetResource_basic(t *testing.T) {
    resource.Test(t, resource.TestCase{
        PreCheck:                 func() { testAccPreCheck(t) },
        ProtoV6ProviderFactories: testAccProtoV6ProviderFactories,
        Steps: []resource.TestStep{
            {
                Config: testAccWidgetConfig("test-widget", 10),
                Check: resource.ComposeAggregateTestCheckFunc(
                    resource.TestCheckResourceAttr("myprovider_widget.test", "name", "test-widget"),
                    resource.TestCheckResourceAttr("myprovider_widget.test", "size", "10"),
                    resource.TestCheckResourceAttrSet("myprovider_widget.test", "id"),
                ),
            },
        },
    })
}

func testAccWidgetConfig(name string, size int) string {
    return fmt.Sprintf(`
resource "myprovider_widget" "test" {
  name = %[1]q
  size = %[2]d
}
`, name, size)
}
```

The framework applies this config against a real backend, runs the checks, then automatically runs a second `plan` to confirm there's no drift immediately after apply — which is the single most common thing acceptance tests catch that unit tests structurally cannot: a `Computed` field that isn't marked as such, or a Read function that doesn't map an API response field back into state correctly.

## Testing the update path, not just create

```go
Steps: []resource.TestStep{
    {
        Config: testAccWidgetConfig("test-widget", 10),
        Check:  resource.TestCheckResourceAttr("myprovider_widget.test", "size", "10"),
    },
    {
        Config: testAccWidgetConfig("test-widget", 20),
        Check:  resource.TestCheckResourceAttr("myprovider_widget.test", "size", "20"),
    },
},
```

A second step with a changed config exercises `UpdateContext` specifically, and confirms the resource updates in place rather than getting destroyed and recreated — the framework flags a plan showing "destroy and recreate" where the test expected an in-place update, which is exactly the class of bug an incorrectly-set `ForceNew` produces.

## `ImportState` steps catch a whole separate class of bug

```go
{
    ResourceName:      "myprovider_widget.test",
    ImportState:       true,
    ImportStateVerify: true,
},
```

This imports the resource created by the previous step using only its ID, then verifies the imported state matches — proving the Read function alone can fully reconstruct a resource's state, independent of whatever `Create` happened to set. Providers that work fine on create-and-apply but break on `terraform import` almost always have a Read function that's missing a field the schema declares.

## Acceptance tests cost real money and real time — plan for that

Every `TestAccXxx` provisions real infrastructure against a real account. `TF_ACC=1` gates them intentionally, so they don't run as part of a normal `go test ./...` and surprise someone with cloud spend during local development:

```
TF_ACC=1 go test ./... -run TestAccWidgetResource -v -timeout 30m
```

The `-timeout` flag needs to be generous — provisioning and tearing down real resources is slow, and the default Go test timeout kills a test suite mid-provision, which can leave orphaned resources behind that nothing cleans up. Making sure `CheckDestroy` verifies the resource is actually gone after the test's implicit teardown is what keeps a failed acceptance test run from silently leaking billable infrastructure.

## Testing that invalid config actually gets rejected

A schema validation rule with no test proving it fires is a rule that can silently stop firing after a refactor. `ExpectError` runs a step and asserts it fails, instead of only ever testing the paths that succeed:

```go
{
    Config:      testAccWidgetConfig("", 10), // empty name should be rejected
    ExpectError: regexp.MustCompile(`name must not be empty`),
},
```

Providers accumulate validation logic over time — required fields, mutually exclusive attributes, value ranges — and every one of those rules is a behavior a user depends on to catch their own mistakes early, at `plan` time, instead of getting a confusing error from the underlying API later. Without an `ExpectError` step covering it, a validation rule can be accidentally removed in a refactor and nothing in the test suite notices, because every other test is checking that valid configuration succeeds.

## What this actually buys the provider

Unit tests prove the provider's logic does what you told it to do. Acceptance tests prove the API agrees with what you told the provider to assume about it. A provider used by anyone outside the team that wrote it needs both — the first catches regressions fast and cheaply in CI, the second is the only thing standing between "looks correct in code review" and "works against the actual thing it's supposed to manage."
