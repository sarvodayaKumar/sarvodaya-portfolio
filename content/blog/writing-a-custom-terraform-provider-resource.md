---
title: "Writing a custom Terraform provider resource in Go: the CRUD lifecycle"
date: 2026-06-25
summary: A Terraform resource is a state machine over an API. Mapping Create, Read, Update, and Delete correctly is most of the work.
published: true
---

A Terraform provider resource looks like boilerplate the first time you write one — four functions and a schema — but almost every real bug in a provider comes from getting the contract of those four functions subtly wrong, not from the schema itself.

## The schema is the contract, not documentation

```go
func resourceWidget() *schema.Resource {
    return &schema.Resource{
        CreateContext: resourceWidgetCreate,
        ReadContext:   resourceWidgetRead,
        UpdateContext: resourceWidgetUpdate,
        DeleteContext: resourceWidgetDelete,
        Schema: map[string]*schema.Schema{
            "name": {
                Type:     schema.TypeString,
                Required: true,
                ForceNew: true, // changing this destroys and recreates
            },
            "size": {
                Type:     schema.TypeInt,
                Optional: true,
                Default:  10,
            },
        },
    }
}
```

`ForceNew` is easy to get wrong in both directions. Mark a field `ForceNew` that the API actually supports updating in place, and every change to it destroys and recreates a resource that didn't need to be destroyed — for anything stateful, that's data loss the user didn't ask for. Leave it off a field the API genuinely can't update, and `UpdateContext` silently no-ops on that field or errors in a way that doesn't clearly explain why.

## Create must set the ID before returning

```go
func resourceWidgetCreate(ctx context.Context, d *schema.ResourceData, m any) diag.Diagnostics {
    client := m.(*Client)
    widget, err := client.CreateWidget(ctx, &CreateWidgetInput{
        Name: d.Get("name").(string),
        Size: d.Get("size").(int),
    })
    if err != nil {
        return diag.FromErr(fmt.Errorf("create widget: %w", err))
    }
    d.SetId(widget.ID)
    return resourceWidgetRead(ctx, d, m)
}
```

Calling `resourceWidgetRead` at the end of `Create` isn't decoration — it re-reads the resource from the API and populates every computed field in state. Skip it, and any field the API sets server-side (a generated ARN, a default the API applied that wasn't in the config) stays empty in state until the next `terraform plan` happens to trigger a read.

## Read is what makes drift detection possible at all

```go
func resourceWidgetRead(ctx context.Context, d *schema.ResourceData, m any) diag.Diagnostics {
    client := m.(*Client)
    widget, err := client.GetWidget(ctx, d.Id())
    if err != nil {
        if errors.Is(err, ErrNotFound) {
            d.SetId("") // tells Terraform the resource is gone
            return nil
        }
        return diag.FromErr(fmt.Errorf("read widget %s: %w", d.Id(), err))
    }
    d.Set("name", widget.Name)
    d.Set("size", widget.Size)
    return nil
}
```

`d.SetId("")` on a 404 is the detail that makes `terraform plan` correctly show "this resource will be created" instead of erroring when something was deleted outside Terraform. Skip that check and return the raw error instead, and every `plan` after a manual deletion fails instead of surfacing the drift.

## Update should only touch fields that changed

```go
func resourceWidgetUpdate(ctx context.Context, d *schema.ResourceData, m any) diag.Diagnostics {
    client := m.(*Client)
    if d.HasChange("size") {
        if err := client.UpdateWidgetSize(ctx, d.Id(), d.Get("size").(int)); err != nil {
            return diag.FromErr(fmt.Errorf("update widget %s: %w", d.Id(), err))
        }
    }
    return resourceWidgetRead(ctx, d, m)
}
```

`d.HasChange` matters when the underlying API has separate endpoints per field, or when calling an update endpoint unconditionally has side effects (resetting a counter, bumping a version) beyond the field you actually meant to change. Unconditionally calling a generic "update everything" endpoint is fine when the API supports it cleanly; assuming that pattern works when the API doesn't is where unrelated fields start drifting on every apply.

## Delete should tolerate the resource already being gone

```go
func resourceWidgetDelete(ctx context.Context, d *schema.ResourceData, m any) diag.Diagnostics {
    client := m.(*Client)
    if err := client.DeleteWidget(ctx, d.Id()); err != nil && !errors.Is(err, ErrNotFound) {
        return diag.FromErr(fmt.Errorf("delete widget %s: %w", d.Id(), err))
    }
    return nil
}
```

If the resource was already deleted out-of-band, treating a 404 on delete as success (rather than an error) is what lets `terraform destroy` complete cleanly instead of getting stuck on a resource that doesn't exist to delete.

## A resource created on the API but not saved to state is an orphan

The most damaging bug in this lifecycle isn't in any of the four functions individually — it's the gap between them. If `CreateWidget` succeeds against the API but the process crashes, or the network drops, before `d.SetId(widget.ID)` runs and Terraform persists state, the resource now exists in the real infrastructure with no corresponding entry in state. The next `terraform apply` sees no resource in state and creates a *second* one, and the first is orphaned — billed, running, and invisible to Terraform.

```go
func resourceWidgetCreate(ctx context.Context, d *schema.ResourceData, m any) diag.Diagnostics {
    client := m.(*Client)
    widget, err := client.CreateWidget(ctx, &CreateWidgetInput{Name: d.Get("name").(string)})
    if err != nil {
        return diag.FromErr(fmt.Errorf("create widget: %w", err))
    }
    // Set the ID immediately — before any other work in this function.
    // Everything after this line can fail without orphaning the resource,
    // because Terraform now has a record it needs to reconcile.
    d.SetId(widget.ID)

    if err := client.AttachTags(ctx, widget.ID, d.Get("tags")); err != nil {
        // The widget is already in state — this is now an update-path
        // problem the next apply can retry, not a silent orphan.
        return diag.FromErr(fmt.Errorf("attach tags to widget %s: %w", widget.ID, err))
    }
    return resourceWidgetRead(ctx, d, m)
}
```

Calling `d.SetId` the instant an ID exists — before any subsequent API calls that could fail — is what turns a partial failure into a resource Terraform still knows about and can retry, instead of a resource that has to be found and imported manually after someone notices the orphaned billing line.

## The lifecycle is the whole point

None of this is unusual Go — it's mapping the honest state of a remote API onto Terraform's assumptions about what Create, Read, Update, and Delete each guarantee. Every provider bug report that starts with "terraform plan shows changes every time" or "destroy gets stuck" traces back to one of these four functions breaking that contract in a way that only shows up once real infrastructure — and real state files — depend on it.
