"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  branch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
};

type OperationsData = {
  source: string;
  fetchedAt: string;
  runs: WorkflowRun[];
  summary: { total: number; running: number; successful: number; failed: number };
};

type ViewState = "checking" | "signed-out" | "ready";

function formatDate(value: string) {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Timestamp unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(run: WorkflowRun) {
  if (run.status !== "completed") return run.status.replaceAll("_", " ");
  return run.conclusion ?? "completed";
}

function statusClass(run: WorkflowRun) {
  if (run.status === "in_progress" || run.status === "queued") return "border-amber-500/40 bg-amber-500/10 text-amber-600";
  if (run.conclusion === "success") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600";
  if (run.conclusion === "failure" || run.conclusion === "timed_out" || run.conclusion === "action_required") return "border-red-500/40 bg-red-500/10 text-red-600";
  return "border-border bg-card text-muted";
}

export default function AdminOperationsPage() {
  const [view, setView] = useState<ViewState>("checking");
  const [data, setData] = useState<OperationsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store" });
      if (response.status === 401) {
        setView("signed-out");
        setData(null);
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Operations data is unavailable.");
      }
      setData(await response.json() as OperationsData);
      setView("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load operations data.");
      setView("ready");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (cancelled) return;
        if (!response.ok) {
          setView("signed-out");
          return;
        }
        await refresh();
      } catch {
        if (!cancelled) {
          setView("ready");
          setError("Unable to verify the administrator session.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => undefined);
    setData(null);
    setView("signed-out");
  };

  if (view === "checking") {
    return <main className="mx-auto flex min-h-[60svh] max-w-6xl items-center justify-center px-6"><p className="text-sm text-muted" role="status">Verifying administrator session…</p></main>;
  }

  if (view === "signed-out") {
    return (
      <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold text-foreground">Administrator access required</h1>
        <p className="mt-3 text-sm text-muted">Sign in to the existing secure admin area to access site operations.</p>
        <Link href="/admin/comments" className="mt-6 inline-flex w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">Go to admin sign in</Link>
      </main>
    );
  }

  const summary = data?.summary;
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Site administration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Operations overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">A read-only view of recent CI/CD activity. More operations modules will be added in later phases.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/comments" className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-card">Comments moderation</Link>
          <button onClick={refresh} disabled={loading} className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
          <button onClick={signOut} className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-card">Sign out</button>
        </div>
      </div>

      {error && <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600" role="alert">{error}</p>}

      <section aria-label="Workflow summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recent workflow runs", value: summary?.total ?? "—", note: "Latest eight from GitHub" },
          { label: "In progress", value: summary?.running ?? "—", note: "Queued or running" },
          { label: "Successful", value: summary?.successful ?? "—", note: "Completed successfully" },
          { label: "Failed", value: summary?.failed ?? "—", note: "Completed with failure" },
        ].map((item) => (
          <article key={item.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{item.value}</p>
            <p className="mt-2 text-xs text-muted">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-semibold text-foreground">Recent GitHub Actions runs</h2>
            <p className="mt-1 text-xs text-muted">Repository: sarvodayaKumar/sarvodaya-portfolio</p>
          </div>
          <a href="https://github.com/sarvodayaKumar/sarvodaya-portfolio/actions" target="_blank" rel="noreferrer" className="text-xs text-foreground underline underline-offset-4">Open Actions</a>
        </div>

        {!data && !error ? (
          <p className="p-5 text-sm text-muted">Loading workflow history…</p>
        ) : data?.runs.length ? (
          <ul className="divide-y divide-border">
            {data.runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <a href={run.url} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">{run.name}</a>
                  <p className="mt-1 truncate font-mono text-xs text-muted">{run.branch} · #{run.id}</p>
                  <p className="mt-1 text-xs text-muted">Updated {formatDate(run.updatedAt)}</p>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs capitalize ${statusClass(run)}`}>{statusLabel(run)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-muted">No workflow runs are currently available.</p>
        )}

        {data && (
          <div className="border-t border-border px-5 py-3 text-xs text-muted">
            Source: {data.source} · Retrieved {formatDate(data.fetchedAt)} · Refresh to check for newer runs.
          </div>
        )}
      </section>
    </main>
  );
}
