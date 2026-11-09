#!/usr/bin/env python3
"""Send the scheduled security scan status to the portfolio maintainer."""

import os
import smtplib
import sys
from email.message import EmailMessage


def main() -> int:
    username = os.environ.get("SMTP_USERNAME", "").strip()
    password = os.environ.get("SMTP_PASSWORD", "")
    recipient = os.environ.get("EMAIL_TO", "sarvodaya.kumar@outlook.com").strip()

    if not username or not password:
        print(
            "::error::Daily email is not configured. Add SMTP_USERNAME and "
            "SMTP_PASSWORD as GitHub Actions repository secrets.",
            file=sys.stderr,
        )
        return 1

    server = os.environ.get("SMTP_SERVER", "").strip() or "smtp-mail.outlook.com"
    port = int(os.environ.get("SMTP_PORT", "").strip() or "587")

    results = {
        "CodeQL": os.environ.get("CODEQL_RESULT", "unknown"),
        "Gitleaks": os.environ.get("GITLEAKS_RESULT", "unknown"),
        "npm dependency audit": os.environ.get("DEPENDENCY_AUDIT_RESULT", "unknown"),
    }
    scan_date = os.environ.get("SCAN_DATE", "Daily scheduled scan")
    dependency_summary = os.environ.get("DEPENDENCY_SUMMARY", "No dependency summary was produced.")

    message = EmailMessage()
    message["Subject"] = f"Portfolio security scan — {scan_date}"
    message["From"] = username
    message["To"] = recipient
    message.set_content(
        "Daily security scan results for sarvodaya-portfolio\n\n"
        + "\n".join(f"{name}: {status}" for name, status in results.items())
        + f"\n\nDependency findings: {dependency_summary}\n"
        + "\nA failed scanner job requires triage. Review GitHub Actions and "
        "GitHub Code Scanning for detailed findings. A clean scan does not "
        "guarantee the absence of vulnerabilities.\n"
    )

    try:
        with smtplib.SMTP(server, port, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(username, password)
            smtp.send_message(message)
    except Exception as error:  # noqa: BLE001 - report SMTP failure to the workflow
        print(f"::error::Unable to send daily security email: {error}", file=sys.stderr)
        return 1

    print(f"Daily security report sent to {recipient}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
