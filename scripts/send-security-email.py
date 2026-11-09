#!/usr/bin/env python3
"""Send the scheduled security scan status through Microsoft Graph."""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


TOKEN_URL = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token"
GRAPH_URL = "https://graph.microsoft.com/v1.0"


def request_json(url: str, *, method: str = "GET", data: dict | None = None,
                 token: str | None = None) -> dict:
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except HTTPError as error:
        # Do not print request headers or tokens into GitHub Actions logs.
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Microsoft Graph request failed ({error.code}): {detail[:1200]}") from None
    except URLError as error:
        raise RuntimeError(f"Unable to reach Microsoft identity/Graph service: {error.reason}") from None


def get_access_token(client_id: str, refresh_token: str) -> str:
    form = urlencode({
        "client_id": client_id,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "scope": "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access",
    }).encode("utf-8")
    request = Request(
        TOKEN_URL,
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Microsoft token refresh failed ({error.code}): {detail[:1200]}") from None
    except URLError as error:
        raise RuntimeError(f"Unable to reach Microsoft identity service: {error.reason}") from None

    access_token = payload.get("access_token")
    if not access_token:
        raise RuntimeError("Microsoft token response did not contain an access token.")
    return access_token


def main() -> int:
    expected_account = os.environ.get("OUTLOOK_EMAIL", "").strip()
    client_id = os.environ.get("MS_GRAPH_CLIENT_ID", "").strip()
    refresh_token = os.environ.get("MS_GRAPH_REFRESH_TOKEN", "").strip()
    recipient = os.environ.get("EMAIL_TO", expected_account).strip()

    missing = [
        name for name, value in (
            ("OUTLOOK_EMAIL", expected_account),
            ("MS_GRAPH_CLIENT_ID", client_id),
            ("MS_GRAPH_REFRESH_TOKEN", refresh_token),
        ) if not value
    ]
    if missing:
        # The scanner jobs are independent; this notification job should expose its own misconfiguration.
        print(
            "::error::Daily security email cannot run; missing configuration: "
            + ", ".join(missing),
            file=sys.stderr,
        )
        return 1

    results = {
        "CodeQL": os.environ.get("CODEQL_RESULT", "unknown"),
        "Gitleaks": os.environ.get("GITLEAKS_RESULT", "unknown"),
        "npm dependency audit": os.environ.get("DEPENDENCY_AUDIT_RESULT", "unknown"),
    }
    scan_date = os.environ.get("SCAN_DATE", "Daily scheduled scan")
    dependency_summary = os.environ.get(
        "DEPENDENCY_SUMMARY", "No dependency summary was produced."
    )

    body = (
        "Daily security scan results for sarvodaya-portfolio\n\n"
        + "\n".join(f"{name}: {status}" for name, status in results.items())
        + f"\n\nDependency findings: {dependency_summary}\n"
        + "\nA failed scanner job requires triage. Review GitHub Actions and "
        "GitHub Code Scanning for detailed findings. A clean scan does not "
        "guarantee the absence of vulnerabilities.\n"
    )

    try:
        token = get_access_token(client_id, refresh_token)
        profile = request_json(f"{GRAPH_URL}/me?$select=mail,userPrincipalName", token=token)
        actual_account = (profile.get("mail") or profile.get("userPrincipalName") or "").strip()
        if actual_account.casefold() != expected_account.casefold():
            raise RuntimeError(
                "The Microsoft account authorized by MS_GRAPH_REFRESH_TOKEN does not "
                "match OUTLOOK_EMAIL. Re-authorize using the intended Outlook account."
            )

        request_json(
            f"{GRAPH_URL}/me/sendMail",
            method="POST",
            token=token,
            data={
                "message": {
                    "subject": f"Portfolio security scan — {scan_date}",
                    "body": {"contentType": "Text", "content": body},
                    "toRecipients": [{"emailAddress": {"address": recipient}}],
                },
                "saveToSentItems": True,
            },
        )
    except Exception as error:  # noqa: BLE001 - fail the scheduled job visibly
        print(f"::error::Unable to send daily security email: {error}", file=sys.stderr)
        return 1

    print(f"Daily security report sent from {actual_account} to {recipient}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
