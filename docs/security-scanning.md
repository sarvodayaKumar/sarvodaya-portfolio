# Security scanning and vulnerability triage

The repository runs open-source security checks through GitHub Actions. Scans run for pull requests, pushes to `main`, manual dispatches, and every day at 11:00 AM India Standard Time (05:30 UTC).

## Scanners

| Scanner | Coverage | Output / gate |
| --- | --- | --- |
| GitHub CodeQL | JavaScript and TypeScript source; `security-extended` query suite | SARIF results in GitHub Code Scanning |
| Gitleaks | Secrets in the checked-out Git history and changes | Fails the job when a leak is detected; summary and SARIF artifact when findings exist |
| `npm audit` | Direct and transitive packages in `package-lock.json` | JSON report artifact; fails CI for High or Critical findings |

Third-party GitHub Actions in the security workflow are pinned to full commit SHAs. Review and update those pins deliberately when upgrading the actions.

## Daily email notification

The scheduled 11:00 AM IST run emails the scanner results and dependency severity counts to `sarvodaya.kumar@outlook.com`.

Configure these encrypted GitHub Actions repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:
- `SMTP_USERNAME`: the sending Outlook mailbox username.
- `SMTP_PASSWORD`: the mailbox password or app password accepted by the account's SMTP configuration.

Optional repository variables:
- `SMTP_SERVER`: defaults to `smtp-mail.outlook.com`.
- `SMTP_PORT`: defaults to `587` (STARTTLS).

Do not paste SMTP credentials into chat, source files, workflow YAML, or issue comments. Outlook account security settings may restrict SMTP AUTH; if the mailbox does not permit SMTP AUTH, use an approved SMTP relay and set `SMTP_SERVER` / `SMTP_PORT` accordingly. The daily notification job fails visibly when credentials are missing or email delivery fails.

## Severity policy

- **Critical:** block the workflow; begin remediation immediately and rotate any exposed credential.
- **High:** block the workflow; assign an owner and remediate before merge.
- **Moderate / Low:** report and triage; prioritize based on exploitability, reachability, and available fixes.
- CodeQL and Gitleaks findings must be reviewed in context. Do not dismiss a finding solely to make a workflow pass.

The dependency gate is intentionally limited to High and Critical npm advisories to avoid blocking delivery on lower-severity findings without triage. It does not mean lower-severity findings are safe or should be ignored.

## Ownership and exceptions

The repository maintainer is the initial triage owner. For each confirmed finding, create or update a GitHub issue with the scanner, affected file/package, advisory or alert URL, severity, remediation, and assignee.

Exceptions must be recorded in a GitHub issue and include:
- the exact finding and affected version/path;
- a reason remediation cannot be completed immediately;
- compensating controls and risk acceptance owner;
- a target remediation date (review exceptions at least every 30 days).

Do not add credentials, tokens, or other secret values to issues or workflow logs. If a credential is detected, revoke or rotate it first; deleting the value from the current source file does not invalidate a credential or erase it from Git history.

## Reports and limitations

The dependency workflow uploads `npm-audit.json` even when the severity gate fails. CodeQL results are published to GitHub Code Scanning, and Gitleaks provides a job summary and finding artifact when applicable. The daily email summarizes job status and npm severity counts; detailed findings remain in GitHub Actions artifacts and Code Scanning.

These scanners identify known classes of issues and known published dependency advisories. A clean run means no findings were detected by these configured checks; it is not a guarantee that the portfolio has zero vulnerabilities. Continue manual review, timely patching, and secure deployment practices.
