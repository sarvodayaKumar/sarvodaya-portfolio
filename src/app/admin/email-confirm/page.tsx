"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashSnapshot() { return window.location.hash; }
function getServerHashSnapshot() { return "__server__"; }

type AttemptState = {
  token: string;
  status: "verifying" | "invalid";
  error: string;
};

export default function AdminEmailConfirmPage() {
  const router = useRouter();
  const hash = useSyncExternalStore(subscribeToHash, getHashSnapshot, getServerHashSnapshot);
  const hashToken = hash ? new URLSearchParams(hash.slice(1)).get("token") ?? "" : "";
  const validToken = hashToken.length >= 40 && hashToken.length <= 128;
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const status = attempt?.token === hashToken ? attempt.status : null;
  const error = attempt?.token === hashToken ? attempt.error : "";

  async function continueSignIn() {
    const oneTimeToken = hashToken;
    if (!oneTimeToken || oneTimeToken.length < 40 || oneTimeToken.length > 128) {
      setAttempt({ token: oneTimeToken, status: "invalid", error: "This sign-in link is invalid, expired, or already used." });
      return;
    }
    // Remove the one-time token from browser history before sending it.
    window.history.replaceState(null, "", window.location.pathname);
    setAttempt({ token: oneTimeToken, status: "verifying", error: "" });
    try {
      const response = await fetch("/api/admin/email-link", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: oneTimeToken }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Sign-in link is invalid or expired.");
      router.push("/admin/mfa");
    } catch (cause) {
      setAttempt({
        token: oneTimeToken,
        status: "invalid",
        error: cause instanceof Error ? cause.message : "Unable to verify sign-in link.",
      });
    }
  }

  return (
    <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Passwordless sign-in</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Confirm your sign-in</h1>
      {hash === "__server__" && <p className="mt-4 text-sm text-muted" role="status">Checking sign-in link…</p>}
      {hash !== "__server__" && status === null && validToken && (
        <>
          <p className="mt-3 text-sm text-muted">Continue to verify this one-time sign-in link. You will still need your configured MFA factor before accessing administrator tools.</p>
          <button type="button" onClick={continueSignIn} className="mt-6 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background">Continue sign-in</button>
        </>
      )}
      {status === "verifying" && <p className="mt-4 text-sm text-muted" role="status">Verifying sign-in link…</p>}
      {(status === "invalid" || (hash !== "__server__" && status === null && !validToken)) && (
        <>
          <p className="mt-3 text-sm text-red-500" role="alert">{error || "This sign-in link is invalid, expired, or already used."}</p>
          <Link href="/admin/comments" className="mt-5 text-sm text-foreground underline underline-offset-4">Return to administrator sign-in</Link>
        </>
      )}
    </main>
  );
}
