"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Comment = {
  id: number;
  postSlug: string;
  name: string;
  message: string;
  approved: boolean;
  createdAt: string;
};

export default function AdminCommentsPage() {
  const [token, setToken] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadComments = useCallback(async () => {
    const res = await fetch("/api/comments/moderate?status=pending", {
      cache: "no-store",
    });
    if (!res.ok) {
      setUnlocked(false);
      setError(res.status === 401 ? "Your admin session has expired. Sign in again." : "Unable to load comments.");
      return;
    }
    const data = await res.json();
    setComments(data.comments ?? []);
    setError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          setUnlocked(true);
          await loadComments();
        }
      } catch {
        if (!cancelled) setError("Unable to verify the admin session.");
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadComments]);

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("Invalid credentials.");
        return;
      }
      setToken("");
      setUnlocked(true);
      await loadComments();
    } catch {
      setError("Unable to sign in. Please try again.");
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setUnlocked(false);
    setComments([]);
  };

  const act = async (id: number, action: "approve" | "delete") => {
    setBusyId(id);
    try {
      const res = await fetch("/api/comments/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? "Your admin session has expired. Sign in again." : "The moderation action failed.");
        if (res.status === 401) setUnlocked(false);
        return;
      }
      setComments((prev) => prev.filter((comment) => comment.id !== id));
      setError("");
    } catch {
      setError("The moderation action failed. Please retry.");
    } finally {
      setBusyId(null);
    }
  };

  if (checkingSession) {
    return <main className="mx-auto flex min-h-[60svh] max-w-sm items-center justify-center px-6"><p className="text-sm text-muted" role="status">Checking admin session…</p></main>;
  }

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">Admin sign in</h1>
        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Admin token"
            autoComplete="current-password"
            required
            className="mb-3 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground"
          />
          <button type="submit" className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background">
            Sign in
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Pending comments</h1>
        <button onClick={handleLogout} className="rounded-full border border-border px-4 py-2 text-xs text-foreground">Sign out</button>
      </div>
      {error && <p className="mb-4 text-sm text-red-500" role="alert">{error}</p>}
      {comments.length === 0 ? (
        <p className="text-muted">Nothing pending.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-mono text-xs text-muted">{comment.postSlug} — {new Date(comment.createdAt).toLocaleString()}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{comment.name}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{comment.message}</p>
              <div className="mt-3 flex gap-3">
                <button disabled={busyId === comment.id} onClick={() => act(comment.id, "approve")} className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background disabled:opacity-50">Approve</button>
                <button disabled={busyId === comment.id} onClick={() => act(comment.id, "delete")} className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground disabled:opacity-50">Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
