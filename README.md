# Sarvodaya Kumar — Portfolio

Personal site for [Sarvodaya Kumar](https://github.com/sarvodayaKumar), Senior Software Engineer.

## Run locally

Requires **Node.js 22** (pinned in `.nvmrc` so Vercel and local match).

```bash
nvm use
npm install
npm run dev
```

`npm run dev` starts Next.js **and** watches the resume PDF. Replace `/mnt/d/Download/sarvodayaKumar.pdf` and the Employment section regenerates; open source is left intact.

Open [http://localhost:3000](http://localhost:3000).

## What updates from where

| Content | Source |
| --- | --- |
| Employment, skills, summary, certs, education | Resume PDF |
| Open source roles, PRs, GitHub/LinkedIn, projects | `content/profile.overrides.json` |

```bash
npm run resume:sync          # one-shot
npm run resume:watch         # watch only
npm run dev:next             # Next.js without resume watch
```

Another PDF:

```bash
RESUME_PATH=/path/to/resume.pdf npm run resume:sync
```

Replace `public/profile.png` with a headshot if you have one.

## Blog

Posts are Markdown files in `content/blog/`.

```md
---
title: Your title
date: 2026-09-12
summary: One or two sentences.
published: true
---

Write in Markdown. Files that start with `_` are ignored (see `_template.md`).
Drafts use `published: false`.
```

Locally the blog is at `/blog`. In production it is served on **blog.sarvodaya.dev** from the same Vercel project.

Add both hostnames on that Vercel project:

1. `sarvodaya.dev` (and `www` if you want it)
2. `blog.sarvodaya.dev`

DNS:

- Apex / www → Vercel
- `blog` CNAME → `cname.vercel-dns.com`

The homepage Blog block updates on refresh in `npm run dev` or the next production build.

