# DAST with OWASP ZAP

This repository has three manual-only DAST workflows:

- `.github/workflows/dast-staging.yml`: passive baseline for a future, explicitly allowlisted staging deployment.
- `.github/workflows/dast-production-passive.yml`: bounded passive baseline against the fixed production origin `https://sarvodaya.dev`.
- `.github/workflows/dast-production-active.yml`: optional active scan against the same fixed production origin. It sends attack traffic and must be used only with explicit authorization and a maintenance/monitoring plan.

None of these workflows runs on push or pull request. Production workflows require an exact typed confirmation and use GitHub Environments as an approval boundary.

## GitHub environment setup

Create these environments under Settings → Environments:

1. `production-dast` for passive production checks.
2. `production-active-dast` for active production testing.

For `production-active-dast`, configure required reviewers and prevent self-review where the repository plan/settings support it. Restrict deployment branches to the DAST branch or `main` as appropriate. Do not run the active workflow until the environment protection is in place and the hosting/CDN provider's testing policy has been checked.

For future staging, create the `staging` environment and configure repository Actions variables:

- `DAST_ALLOWED_HOSTS`: comma-separated exact staging hostnames (no scheme, path, wildcard, or production host).
- `DAST_PRODUCTION_HOSTS`: comma-separated production hostnames; mandatory denylist.

The staging validator fails closed if either list is missing and rejects production hosts, non-HTTPS URLs, credentials, query strings, fragments, localhost, and IP addresses.

## Production passive scan

Open Actions → Production DAST (OWASP ZAP Passive Baseline) → Run workflow. Enter exactly:

```
CONFIRM-AUTHORIZED-PRODUCTION-DAST
```

The target is hard-coded to `https://sarvodaya.dev`; it cannot be overridden by workflow input. The scan uses a shallow, time-bounded spider and passive rules only. Passive scanning does not alter requests or responses, but crawling still generates traffic; schedule it responsibly and monitor the service.

## Production active scan

**Active scanning sends attack payloads. It can submit forms, trigger application behavior, create messages, or add load. No workflow can guarantee zero impact.** Do not run it merely because the site currently has no customer data.

Before enabling a run:

- Confirm you own the target or have written authorization to test it.
- Check the hosting provider, CDN, WAF, and other service policies.
- Configure required reviewers on the `production-active-dast` GitHub Environment.
- Review the app's forms and routes; ZAP may submit forms during crawling.
- Choose a maintenance window, monitor service health, and have a stop/rollback contact ready.

To dispatch, open Actions → Production Active DAST (Manual, Approval-Gated) and enter exactly:

```
CONFIRM-AUTHORIZED-PRODUCTION-DAST
```

The target is fixed to `https://sarvodaya.dev`. The workflow limits spider depth and duration, uses one active-scan thread, configures a short active-scan time budget and a request delay, and skips URL patterns for logout/signout and common destructive/moderation routes. These controls reduce exposure but do not make active testing risk-free. The report is uploaded as `zap-production-active-dast-reports`; findings do not automatically fail the workflow.

## Staging scan

For a future staging environment, open Actions → Staging DAST (OWASP ZAP Baseline) and supply the HTTPS staging URL. The exact hostname must match `DAST_ALLOWED_HOSTS` and must not appear in `DAST_PRODUCTION_HOSTS`. The workflow uses passive checks only.

## Reports and validation

ZAP uploads HTML, JSON, and Markdown reports as workflow artifacts. Review findings for reachability, environment-specific context, false positives, and remediation priority before suppressing or accepting risk.

Run the DAST unit tests with:

```sh
node --test scripts/validate-dast-target.test.mjs scripts/check-zap-report.test.mjs
```

The target-validator tests cover exact allowlisting and production-denylist behavior. The report-gate tests cover high-risk ZAP findings.
