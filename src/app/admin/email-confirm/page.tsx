"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AdminEmailConfirmPage() {
  const initialized = useRef(false);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "invalid" | "verifying">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const value = params.get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (value.length < 40 || value.length > 128) {
      setStatus("invalid");
      return;
    }
    setToken(value);
    setStatus("ready");
  }, []);

  async function continueSignIn() {
    setStatus("verifying");
    setError("");
    try {
      const response = await fetch("/api/admin/email-link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      setToken("");
      if (!response.ok) throw new Error(result.error ?? "Sign-in link is invalid or expired.");
      window.location.assign("/admin/mfa");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify sign-in link.");
      setStatus("invalid");
    }
  }

  return (
    <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Passwordless sign-in</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Confirm your sign-in</h1>
      {status === "loading" && <p className="mt-4 text-sm text-muted" role="status">Checking sign-in link…</p>}
      {status === "ready" && (
        <>
          <p className="mt-3 text-sm text-muted">Continue to verify this one-time sign-in link. You will still need your configured MFA factor before accessing administrator tools.</p>
          <button type="button" onClick={continueSignIn} className="mt-6 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background">Continue sign-in</button>
        </>
      )}
      {status === "verifying" && <p className="mt-4 text-sm text-muted" role="status">Verifying sign-in link…</p>}
      {status === "invalid" && (
        <>
          <p className="mt-3 text-sm text-red-500" role="alert">{error || "This sign-in link is invalid, expired, or already used."}</p>
          <Link href="/admin/comments" className="mt-5 text-sm text-foreground underline underline-offset-4">Return to administrator sign-in</Link>
        </>
      )}
    </main>
  );
}
