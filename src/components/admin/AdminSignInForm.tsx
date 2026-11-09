"use client";

import { useState, type FormEvent } from "react";

export default function AdminSignInForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(response.status === 429
          ? "Too many sign-in attempts. Try again in 15 minutes."
          : response.status === 503
            ? "Sign-in is temporarily unavailable. Please try again later."
            : "Invalid username or password.");
        return;
      }
      setPassword("");
      window.location.assign("/admin");
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-foreground">Administrator sign in</h1>
      <p className="mt-3 text-sm text-muted">Use your configured administrator account to continue.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block text-sm text-foreground">
          Username or email
          <input
            type="text" name="username" autoComplete="username" required maxLength={254}
            value={username} onChange={(event) => setUsername(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          />
        </label>
        <label className="block text-sm text-foreground">
          Password
          <input
            type="password" name="password" autoComplete="current-password" required maxLength={1024}
            value={password} onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}
    </main>
  );
}
