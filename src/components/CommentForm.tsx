"use client";

import { useState, type FormEvent } from "react";
import { profile } from "@/data/profile";

export default function CommentForm({ postTitle, postUrl }: { postTitle: string; postUrl: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const subject = `Comment on: ${postTitle}`;
    const body = [
      `Post: ${postUrl}`,
      `Name: ${name}`,
      email ? `Email: ${email}` : null,
      "",
      message,
    ]
      .filter((line) => line !== null)
      .join("\n");

    window.location.href = `mailto:${profile.links.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="mt-16 border-t border-border pt-10">
      <h2 className="mb-2 font-[family-name:var(--font-syne)] text-xl font-semibold text-foreground">
        Leave a comment
      </h2>
      <p className="mb-6 text-sm text-muted">
        Comments are sent directly to {profile.name.split(" ")[0]} by email — they aren&apos;t
        posted publicly on this page.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            type="text"
            required
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <input
            type="email"
            placeholder="Your email (optional, for a reply)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <textarea
          required
          rows={4}
          placeholder="Your comment"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
        >
          Send comment
        </button>
      </form>
    </div>
  );
}
