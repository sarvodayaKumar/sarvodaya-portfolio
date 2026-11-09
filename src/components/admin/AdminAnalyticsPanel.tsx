"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyticsData = {
  totalViews: number;
  periodDays: number;
  daily: { day: string; views: number }[];
  topPages: { label: string; views: number }[];
  topReferrers: { label: string; views: number }[];
  source: string;
  fetchedAt: string;
};

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function Breakdown({ title, rows, empty }: {
  title: string;
  rows: { label: string; views: number }[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-muted">{row.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-foreground">{row.views.toLocaleString("en-IN")}</span>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-muted">{empty}</p>}
    </section>
  );
}

export default function AdminAnalyticsPanel() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/analytics", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401
        ? "Your administrator session has expired."
        : "Analytics data is temporarily unavailable.");
      setData(await response.json() as AnalyticsData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const maxViews = Math.max(1, ...(data?.daily.map((item) => item.views) ?? []));
  const hasData = Boolean(data && data.totalViews > 0);

  return (
    <section id="analytics" aria-labelledby="analytics-title" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Audience</p>
          <h2 id="analytics-title" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Site analytics</h2>
          <p className="mt-1 text-sm text-muted">First-party page views · last 30 days · no visitor profiles</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className="rounded-full border border-border px-4 py-2 text-sm text-foreground hover:bg-card disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh analytics"}
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600" role="alert">{error}</p>}

      {loading && !data ? (
        <p className="mt-5 text-sm text-muted" role="status">Loading analytics…</p>
      ) : data ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs text-muted">Page views · 30 days</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{data.totalViews.toLocaleString("en-IN")}</p>
              <p className="mt-2 text-xs text-muted">Aggregated page-view events</p>
            </article>
            <article className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs text-muted">Tracked days</p>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{data.daily.length}</p>
              <p className="mt-2 text-xs text-muted">Days with recorded traffic</p>
            </article>
          </div>

          {hasData ? (
            <>
              <section className="mt-5 rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground">Daily page views</h3>
                <div className="mt-5 flex h-36 items-end gap-1" role="img" aria-label="Daily page views for the last 30 days">
                  {data.daily.map((item) => (
                    <div key={item.day} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatDay(item.day)}: ${item.views} views`}>
                      <div className="w-full rounded-t bg-accent/80" style={{ height: `${Math.max(2, item.views / maxViews * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between text-[11px] text-muted">
                  <span>{data.daily[0] ? formatDay(data.daily[0].day) : ""}</span>
                  <span>{data.daily.at(-1) ? formatDay(data.daily.at(-1)!.day) : ""}</span>
                </div>
              </section>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Breakdown title="Top pages" rows={data.topPages} empty="No page views recorded yet." />
                <Breakdown title="Referrer hostnames" rows={data.topReferrers} empty="No referrer data recorded yet." />
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-2xl border border-border bg-card p-5 text-sm text-muted">
              No analytics have been collected yet. Page-view tracking starts after this version is deployed; historical traffic is not available.
            </p>
          )}
          <p className="mt-3 text-xs text-muted">Source: {data.source}. Only daily route and referrer-host aggregates are retained.</p>
        </>
      ) : null}
    </section>
  );
}
