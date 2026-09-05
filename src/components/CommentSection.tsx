"use client";

import { useEffect, useState, type FormEvent } from "react";

type Comment = {
  id: number;
  name: string;
  message: string;
  createdAt: string;
};

export default function CommentSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ type: "error", text: data.error || "Something went wrong." });
        return;
      }
      setStatus({ type: "success", text: data.message });
      setName("");
      setMessage("");
    } catch {
      setStatus({ type: "error", text: "Network error — please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-16 border-t border-border pt-10">
      <h2 className="mb-6 font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground">
        Comments
      </h2>

      {loading ? (
        <p className="text-sm text-muted">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">No comments yet — be the first.</p>
      ) : (
        <ul className="mb-10 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="font-mono text-xs text-muted">
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {c.message}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          required
          maxLength={80}
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <textarea
          required
          maxLength={2000}
          rows={4}
          placeholder="Your comment"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Post comment"}
        </button>
        {status && (
          <p className={`text-sm ${status.type === "success" ? "text-accent" : "text-red-500"}`}>
            {status.text}
          </p>
        )}
        <p className="text-xs text-muted">
          Comments are reviewed before they appear publicly.
        </p>
      </form>
    </div>
  );
}
