# Staging-only DAST with OWASP ZAP

This workflow runs OWASP ZAP Baseline against one explicitly supplied staging URL. It performs a bounded passive scan: it spiders the target and evaluates passive security rules. It does not run ZAP active attack scans. The workflow is manual-only (workflow_dispatch) and must never be pointed at production.

## One-time GitHub configuration

1. Create a GitHub Actions environment named staging under Settings → Environments.
2. Add the repository Actions variable DAST_ALLOWED_HOSTS with comma-separated, exact staging hostnames, for example staging.example.com,staging-api.example.com. Do not include schemes, paths, wildcards, or production hosts.
3. Optionally add DAST_PRODUCTION_HOSTS with comma-separated production hostnames as a second explicit denylist.
4. Configure environment protection/reviewers and staging network access as required. No credentials are embedded in the workflow.

The workflow fails closed if DAST_ALLOWED_HOSTS is missing. The validator requires HTTPS, rejects credentials, query strings, fragments, newlines, localhost and IP addresses, rejects the production denylist, and requires an exact hostname match against the staging allowlist.

## Run it

Open Actions → Staging DAST (OWASP ZAP Baseline) → Run workflow. Supply the full staging URL. The hostname must match DAST_ALLOWED_HOSTS. The scan is serialized to avoid overlapping scans against the same staging environment.

## Safety boundaries

- Only scan systems for which the repository owner has explicit authorization.
- Use a dedicated staging deployment with representative but non-production data.
- The baseline action performs passive checks; do not replace it with an active/full scan or enable active scan policies without a separate security review and written authorization.
- Spider depth is capped at 3 and duration at 3 minutes. The spider skips URL strings matching logout/signout, delete/destroy/remove, and moderation/approval/rejection patterns. Verify these exclusions against the deployed application's route names before the first scan.
- Do not put tokens or credentials in the URL. If authentication is later required, use a reviewed ZAP context and GitHub environment secrets; exclude state-changing actions and verify scope before enabling it.
- Respect staging rate limits and coordinate scans with the environment owner. Stop the workflow immediately if it causes unexpected load or behavior.
- Disable the workflow by disabling .github/workflows/dast-staging.yml or restricting Actions access. Removing DAST_ALLOWED_HOSTS makes all runs fail closed.

## Severity gate and reports

The JSON report is evaluated after the baseline scan. High-risk findings (ZAP risk code 3) fail the job; medium, low, and informational findings remain visible in the report for triage. The ZAP action uploads HTML, JSON, and Markdown reports as the zap-staging-dast-reports artifact. Review findings for reachability, environment-specific context, false positives, and remediation priority before suppressing or accepting risk.

## Validation

The Node test runner automatically discovers both DAST test files through the existing npm test command. Run targeted tests with:

    node --test scripts/validate-dast-target.test.mjs scripts/check-zap-report.test.mjs

Tests cover allowlist validation and the high-risk severity gate.
