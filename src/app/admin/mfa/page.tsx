"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Mode = "loading" | "challenge" | "enrollment" | "signed-out";
type Enrollment = { secret: string; provisioningUri: string; expiresInSeconds: number };

export default function AdminMfaPage() {
  const [mode, setMode] = useState<Mode>("loading");
  const [enabled, setEnabled] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/mfa", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (data.mode === "challenge") {
        setMode("challenge");
        return;
      }
      setMode("enrollment");
      setEnabled(Boolean(data.enabled));
      return;
    }
    const challenge = await fetch("/api/admin/mfa/challenge", { cache: "no-store" });
    const challengeData = await challenge.json().catch(() => ({}));
    setMode(challengeData.pending ? "challenge" : "signed-out");
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setError("Unable to check MFA status.");
      setMode("signed-out");
    });
  }, [refresh]);

  async function startEnrollment() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/mfa", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to start enrollment.");
      setEnrollment(data as Enrollment);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start enrollment.");
    } finally { setBusy(false); }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = mode === "challenge"
        ? await fetch("/api/admin/mfa/challenge", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })
        : await fetch("/api/admin/mfa", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (mode === "challenge" && response.status === 401) {
          setError(data.error ?? "Challenge expired. Sign in again.");
          await refresh();
          return;
        }
        if (mode === "enrollment" && typeof data.error === "string" && /locked|expired/i.test(data.error)) {
          setEnrollment(null);
        }
        throw new Error(data.error ?? "Code verification failed.");
      }
      setCode("");
      if (mode === "challenge") {
        window.location.assign("/admin");
        return;
      }
      setEnrollment(null);
      setEnabled(true);
      setNotice("Authenticator enabled. Sign out and sign in again to complete MFA verification.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Code verification failed.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.assign("/admin/comments");
  }

  if (mode === "loading") return <main className="mx-auto max-w-xl px-6 py-16"><p role="status" className="text-sm text-muted">Checking authentication…</p></main>;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link href="/admin" className="text-sm text-muted underline underline-offset-4">Back to operations</Link>
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">Account security</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">Authenticator MFA</h1>

      {mode === "signed-out" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted">Sign in with your administrator password to enroll an authenticator or start an MFA challenge.</p>
          <Link href="/admin/comments" className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">Go to sign in</Link>
        </section>
      )}

      {mode === "challenge" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground">Verify your authenticator</h2>
          <p className="mt-2 text-sm text-muted">Enter the current six-digit code from your authenticator app. The login challenge expires after five minutes.</p>
          <form onSubmit={submitCode} className="mt-5 space-y-3">
            <label className="block text-sm text-foreground">Authenticator code
              <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-lg tracking-[0.3em] text-foreground" />
            </label>
            <button disabled={busy || code.length !== 6} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">{busy ? "Verifying…" : "Verify and sign in"}</button>
          </form>
        </section>
      )}

      {mode === "enrollment" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          {enabled ? (
            <>
              <p className="text-sm font-medium text-emerald-600">Authenticator is enabled.</p>
              <p className="mt-2 text-sm text-muted">New password sign-ins now require a valid authenticator code. This browser's current password-only session must be replaced with an MFA-verified session.</p>
              <button onClick={signOut} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">Sign out and verify MFA</button>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-foreground">Set up an authenticator app</h2>
              <p className="mt-2 text-sm text-muted">Use Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP-compatible app. The secret is shown once; store it securely.</p>
              {!enrollment ? (
                <button onClick={startEnrollment} disabled={busy} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">{busy ? "Preparing…" : "Start authenticator setup"}</button>
              ) : (
                <>
                  <div className="mt-5 rounded-xl border border-border bg-background p-4">
                    <p className="text-xs text-muted">Manual setup key · expires in 10 minutes</p>
                    <p className="mt-2 break-all font-mono text-sm font-semibold tracking-wider text-foreground">{enrollment.secret}</p>
                    <button type="button" onClick={() => navigator.clipboard.writeText(enrollment.secret)} className="mt-3 text-xs text-foreground underline underline-offset-4">Copy setup key</button>
                  </div>
                  <p className="mt-4 text-xs text-muted">If your app supports provisioning URIs, use this value:</p>
                  <code className="mt-2 block max-h-24 overflow-auto break-all rounded-xl bg-background p-3 text-xs text-muted">{enrollment.provisioningUri}</code>
                  <form onSubmit={submitCode} className="mt-5 space-y-3">
                    <label className="block text-sm text-foreground">Enter the six-digit code to confirm setup
                      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-lg tracking-[0.3em] text-foreground" />
                    </label>
                    <button disabled={busy || code.length !== 6} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">{busy ? "Confirming…" : "Confirm and enable MFA"}</button>
                  </form>
                </>
              )}
            </>
          )}
        </section>
      )}

      {error && <p className="mt-4 text-sm text-red-500" role="alert">{error}</p>}
      {notice && <p className="mt-4 text-sm text-emerald-600" role="status">{notice}</p>}
    </main>
  );
}
