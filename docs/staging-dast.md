# Staging-only DAST with OWASP ZAP

This workflow runs OWASP ZAP Baseline against one explicitly supplied staging URL. It performs a bounded passive scan: it spiders the target and evaluates passive security rules. It does not run ZAP active attack scans. The workflow is manual-only (workflow_dispatch) and must never be pointed at production.

## One-time GitHub configuration

1. Create a GitHub Actions environment named staging under Settings → Environments.
2. Add the repository Actions variable DAST_ALLOWED_HOSTS with comma-separated, exact staging hostnames, for example staging.example.com,staging-api.example.com. Do not include schemes, paths, wildcards, or production hosts.
3. Optionally add DAST_PRODUCTION_HOSTS with comma-separated production hostnames as a second explicit denylist.
4. Configure environment protection/reviewers and staging network access as required. No credentials are embedded in the workflow.

The workflow fails closed if DAST_ALLOWED_HOSTS is missing. The validator requires HTTPS, rejects credentials, query strings, fragments, localhost and IP addresses, rejects the production denylist, and requires an exact hostname match against the staging allowlist.

## Run it

Open Actions → Staging DAST (OWASP ZAP Baseline) → Run workflow. Supply the full staging URL. The hostname must match DAST_ALLOWED_HOSTS. The scan is serialized to avoid overlapping scans against the same staging environment.

## Safety boundaries

- Only scan systems for which the repository owner has explicit authorization.
- Use a dedicated staging deployment with representative but non-production data.
- The baseline action performs passive checks; do not replace it with an active/full scan or enable active scan policies without a separate security review and written authorization.
- Spider depth is capped at 3 and duration at 3 minutes. URL strings for logout/signout, delete/destroy/remove, and moderation/approval/rejection actions are skipped by the spider configuration.
- Do not put tokens or credentials in the URL. If authentication is later required, use a reviewed ZAP context and GitHub environment secrets; exclude state-changing actions and verify scope before enabling it.
- Respect staging rate limits and coordinate scans with the environment owner. Stop the workflow immediately if it causes unexpected load or behavior.
- Disable the workflow by disabling .github/workflows/dast-staging.yml or restricting Actions access. Removing DAST_ALLOWED_HOSTS makes all runs fail closed.

## Severity gate and reports

The baseline action uses WARN as the failure threshold: WARN and FAIL alerts produce a non-zero result for triage; INFO and PASS are informational. Reports are uploaded as the zap-staging-dast-reports artifact for 14 days, including when the scan fails. Review each finding for reachability, environment-specific context, false positives, and remediation priority before suppressing or accepting risk.

## Validation

Run the URL guard tests with:

    node --test scripts/validate-dast-target.test.mjs

The tests cover allowlisted HTTPS acceptance, unlisted and production host rejection, unsafe URL forms, missing allowlist configuration, localhost, and IP-address rejection.
