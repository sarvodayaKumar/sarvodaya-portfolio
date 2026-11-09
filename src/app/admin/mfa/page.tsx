"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
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
  const [emailMode, setEmailMode] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/mfa", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (data.mode === "challenge") {
        setMode("challenge");
        setMfaVerified(false);
        return;
      }
      setMode("enrollment");
      setEnabled(Boolean(data.enabled));
      const session = await fetch("/api/admin/session", { cache: "no-store" });
      setMfaVerified(session.ok);
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
      const response = mode === "challenge" && emailMode
        ? await fetch("/api/admin/mfa/email", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })
        : mode === "challenge" && recoveryMode
        ? await fetch("/api/admin/mfa/recovery", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          })
        : mode === "challenge"
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
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setNotice(data.message ?? "Authenticator enabled. Sign out and sign in again to complete MFA verification.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Code verification failed.");
    } finally { setBusy(false); }
  }

  async function sendEmailCode() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/mfa/email", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to send an email code.");
      setEmailMode(true);
      setRecoveryMode(false);
      setCode("");
      setNotice("A one-time code was sent to the administrator email address.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send an email code.");
    } finally { setBusy(false); }
  }

  async function regenerateRecoveryCodes() {
    setRegenerating(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/mfa/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: regenerateCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to regenerate recovery codes.");
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setRegenerateCode("");
      setNotice(data.message ?? "Recovery codes regenerated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to regenerate recovery codes.");
    } finally { setRegenerating(false); }
  }

  async function disableMfa() {
    setDisabling(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to disable authenticator.");
      window.location.assign("/admin/comments");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disable authenticator.");
    } finally { setDisabling(false); }
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
          <p className="mt-2 text-sm text-muted">Enter a current six-digit code from your authenticator app, or use the email fallback. The login challenge expires after five minutes.</p>
          <form onSubmit={submitCode} className="mt-5 space-y-3">
            <label className="block text-sm text-foreground">{emailMode ? "Email one-time code" : recoveryMode ? "Recovery code" : "Authenticator code"}
              <input inputMode={recoveryMode ? "text" : "numeric"} autoComplete="one-time-code" pattern={recoveryMode ? "[A-Fa-f0-9]{5}(-[A-Fa-f0-9]{5}){3}" : "[0-9]{6}"} maxLength={recoveryMode ? 23 : 6} required value={code} onChange={(event) => setCode(recoveryMode ? event.target.value.toUpperCase().replace(/[^A-F0-9-]/g, "").slice(0, 23) : event.target.value.replace(/\D/g, "").slice(0, 6))} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-lg tracking-[0.2em] text-foreground" />
            </label>
            <button disabled={busy || (recoveryMode ? !/^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/.test(code) : code.length !== 6)} className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50">{busy ? "Verifying…" : "Verify and sign in"}</button>
          </form>
          {!emailMode && !recoveryMode ? (
            <button type="button" onClick={sendEmailCode} disabled={busy} className="mt-4 text-sm text-foreground underline underline-offset-4 disabled:opacity-50">
              {busy ? "Sending…" : "Use email one-time code instead"}
            </button>
          ) : null}
          {!recoveryMode ? (
            <button type="button" onClick={() => { setRecoveryMode(true); setEmailMode(false); setCode(""); setError(""); setNotice(""); }} className="mt-3 block text-sm text-foreground underline underline-offset-4">
              Use a recovery code instead
            </button>
          ) : (
            <button type="button" onClick={() => { setRecoveryMode(false); setCode(""); setError(""); setNotice(""); }} className="mt-3 block text-sm text-foreground underline underline-offset-4">
              Use authenticator app instead
            </button>
          )}
          {emailMode && (
            <button type="button" onClick={() => { setEmailMode(false); setCode(""); setError(""); setNotice(""); }} className="mt-3 block text-sm text-foreground underline underline-offset-4">
              Use authenticator app instead
            </button>
          )}
        </section>
      )}

      {mode === "enrollment" && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          {enabled ? (
            <>
              <p className="text-sm font-medium text-emerald-600">Authenticator is enabled.</p>
              {recoveryCodes.length > 0 ? (
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">Save your recovery codes now</p>
                  <p className="mt-1 text-xs text-muted">Each code works once. These codes are displayed only now and cannot be retrieved later.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-foreground">
                    {recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}
                  </div>
                  <button type="button" onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\\n"))} className="mt-4 text-xs text-foreground underline underline-offset-4">Copy all recovery codes</button>
                  <button type="button" onClick={() => setRecoveryCodes([])} className="ml-4 mt-4 text-xs text-foreground underline underline-offset-4">I saved these codes</button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">Recovery codes</p>
                  <p className="mt-1 text-xs text-muted">Regenerate to invalidate all previously issued codes. Enter a fresh authenticator code to confirm.</p>
                  <form onSubmit={(event) => { event.preventDefault(); regenerateRecoveryCodes(); }} className="mt-3 flex flex-wrap gap-2">
                    <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={regenerateCode} onChange={(event) => setRegenerateCode(event.target.value.replace(/\\D/g, "").slice(0, 6))} aria-label="Current authenticator code" className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground" />
                    <button disabled={regenerating || regenerateCode.length !== 6} className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background disabled:opacity-50">{regenerating ? "Generating…" : "Regenerate"}</button>
                  </form>
                </div>
              )}
              <p className="mt-4 text-sm text-muted">New password sign-ins require a valid authenticator code, email OTP, or unused recovery code. Password-only sessions cannot access admin APIs.</p>
              {mfaVerified ? (
                <div className="mt-6 rounded-xl border border-border bg-background p-4">
                  <h3 className="text-sm font-semibold text-foreground">Disable authenticator</h3>
                  <p className="mt-1 text-xs text-muted">This requires your administrator password and a fresh authenticator code. All active admin sessions will be revoked; you must enroll again before accessing admin APIs.</p>
                  <form onSubmit={(event) => { event.preventDefault(); disableMfa(); }} className="mt-3 space-y-3">
                    <input type="password" autoComplete="current-password" required value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} placeholder="Administrator password" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" />
                    <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Current six-digit code" className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-sm text-foreground" />
                    <button disabled={disabling || disableCode.length !== 6 || !disablePassword} className="rounded-full border border-red-500 px-4 py-2 text-xs text-red-500 disabled:opacity-50">{disabling ? "Disabling…" : "Disable authenticator"}</button>
                  </form>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">Sign out and complete an MFA sign-in before changing recovery settings.</p>
              )}
              <button onClick={signOut} className="mt-5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">Sign out</button>
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
                  <div className="mt-5 flex justify-center rounded-xl bg-white p-4">
                    <QRCodeSVG
                      value={enrollment.provisioningUri}
                      size={220}
                      level="M"
                      title="Authenticator setup QR code"
                    />
                  </div>
                  <p className="mt-3 text-center text-xs text-muted">Scan this QR code with your authenticator app. The code is generated locally in your browser; the secret is not sent to a QR service.</p>
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
