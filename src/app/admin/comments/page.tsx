"use client";

import { useEffect, useState } from "react";

type Comment = {
  id: number;
  postSlug: string;
  name: string;
  message: string;
  approved: boolean;
  createdAt: string;
};

export default function AdminCommentsPage() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem("admin_token") ?? "")
  );
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && !!sessionStorage.getItem("admin_token")
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!unlocked || !token) return;
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/comments/moderate?status=pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cancelled) return;
      if (!res.ok) {
        setError("Invalid token.");
        setUnlocked(false);
        sessionStorage.removeItem("admin_token");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setComments(data.comments ?? []);
      setError("");
    })();

    return () => {
      cancelled = true;
    };
  }, [unlocked, token]);

  const handleUnlock = () => {
    sessionStorage.setItem("admin_token", token);
    setUnlocked(true);
  };

  const act = async (id: number, action: "approve" | "delete") => {
    await fetch("/api/comments/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action }),
    });
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  if (!unlocked) {
    return (
      <main className="mx-auto flex min-h-[60svh] max-w-sm flex-col justify-center px-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">Admin token</h1>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          className="mb-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground"
        />
        <button
          onClick={handleUnlock}
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Unlock
        </button>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Pending comments</h1>
      {comments.length === 0 ? (
        <p className="text-muted">Nothing pending.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="font-mono text-xs text-muted">
                {c.postSlug} — {new Date(c.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">{c.name}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{c.message}</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => act(c.id, "approve")}
                  className="rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background"
                >
                  Approve
                </button>
                <button
                  onClick={() => act(c.id, "delete")}
                  className="rounded-full border border-border px-4 py-1.5 text-xs text-foreground"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
