---
title: "API-key auth in a Terraform provider: implementing it without leaking the key"
date: 2026-09-03
summary: Configuring authentication is the first thing a provider does and the easiest place to accidentally write a secret into state or logs.
published: true
---

Every Terraform provider needs to authenticate to the API it manages, and API-key auth is the simplest form of it — which makes it easy to underestimate how many ways there are to accidentally leak that key once it's flowing through provider configuration, HTTP clients, and Terraform's own logging.

## The provider schema field has to be marked `Sensitive`

```go
func Provider() *schema.Provider {
    return &schema.Provider{
        Schema: map[string]*schema.Schema{
            "api_key": {
                Type:        schema.TypeString,
                Required:    true,
                Sensitive:   true,
                DefaultFunc: schema.EnvDefaultFunc("MYPROVIDER_API_KEY", nil),
            },
        },
        ResourcesMap: map[string]*schema.Resource{
            "myprovider_widget": resourceWidget(),
        },
        ConfigureContextFunc: providerConfigure,
    }
}
```

Without `Sensitive: true`, the value shows up in plain text in `terraform plan` and `terraform apply` output, and in `TF_LOG=trace` debug logs — anywhere Terraform prints the provider configuration, the key goes with it. `Sensitive` masks it as `(sensitive value)` in CLI output; it doesn't encrypt anything in the state file, which is a separate problem below.

`EnvDefaultFunc` matters for a different reason: it lets the key come from an environment variable instead of a literal string in a `.tf` file. A key typed directly into configuration ends up committed to git the first time someone forgets it's sensitive — an environment variable, sourced from a secrets manager in CI, never touches a file that gets version-controlled.

## The state file is the leak that `Sensitive` doesn't cover

Terraform state stores every attribute of every managed resource in plain text (or as an encrypted backend if you've configured one, but the on-disk local `terraform.tfstate` is not encrypted by default). If the API key is ever set as an attribute of a *resource* rather than only the provider block — for instance, a resource that represents an API credential the provider manages — that value sits in the state file, readable by anyone with access to it, `Sensitive` schema flag or not:

```
terraform show -json terraform.tfstate | jq '.values.root_module.resources'
```

That command will print any resource attribute, marked sensitive or not — the flag only changes CLI display, not what's persisted. A remote backend with encryption at rest (S3 with SSE, Terraform Cloud) and access controls on who can read state is the actual mitigation, not a schema attribute.

## Configuring the API client once, correctly

```go
func providerConfigure(ctx context.Context, d *schema.ResourceData) (interface{}, diag.Diagnostics) {
    apiKey := d.Get("api_key").(string)
    if apiKey == "" {
        return nil, diag.Errorf("api_key is required")
    }

    client := &Client{
        HTTPClient: &http.Client{Timeout: 30 * time.Second},
        BaseURL:    "https://api.example.com",
        APIKey:     apiKey,
    }
    return client, nil
}
```

```go
func (c *Client) do(ctx context.Context, req *http.Request) (*http.Response, error) {
    req.Header.Set("Authorization", "Bearer "+c.APIKey)
    return c.HTTPClient.Do(req)
}
```

Centralizing the header injection in one `do` method — rather than setting `Authorization` in every individual API call — means there's exactly one place that ever touches the raw key after configuration, which is also the one place that needs review if the auth scheme ever changes.

## Never log the client struct directly

```go
// Leaks the key into any log aggregator this line's output reaches
log.Printf("configured client: %+v", client)
```

A `%+v` format verb on a struct containing the API key prints every field, including the key, into whatever's capturing that log line — often a log aggregator with far broader read access than the Terraform run itself. Implement a `String()` method on the client type that redacts the key, or simply never log the struct as a whole:

```go
func (c *Client) String() string {
    return fmt.Sprintf("Client{BaseURL: %s}", c.BaseURL)
}
```

## Rotating the key without a maintenance window

A provider that only reads `api_key` once, at `ConfigureContextFunc`, forces a Terraform run restart every time the key rotates — inconvenient for a scheduled rotation, and actively bad during an incident response rotation where someone needs infrastructure changes to keep working through the rotation, not pause for it. Supporting a fallback lets a rotation be gradual instead of a hard cutover:

```go
"api_key": {
    Type:        schema.TypeString,
    Optional:    true,
    Sensitive:   true,
    DefaultFunc: schema.MultiEnvDefaultFunc(
        []string{"MYPROVIDER_API_KEY", "MYPROVIDER_API_KEY_LEGACY"},
        nil,
    ),
},
```

The underlying API accepting both the old and new key during a rotation window — a pattern most API providers support explicitly for this reason — combined with the provider reading either environment variable means a rotation is: issue the new key, update CI's secret store, confirm the next run picks it up, then revoke the old key. No step in that sequence requires infrastructure changes to stop while the rotation happens, which is the actual point of treating key rotation as routine maintenance instead of a scheduled outage.

## The actual discipline

None of this is exotic security engineering — it's tracing every place a secret value can end up (CLI output, debug logs, application logs, the state file) and closing each one deliberately, instead of assuming that marking one schema field `Sensitive` handles all of them. It doesn't; it handles exactly one.
