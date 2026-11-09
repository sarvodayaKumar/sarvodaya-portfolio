# Sarvodaya Kumar — Portfolio

Personal site for [Sarvodaya Kumar](https://github.com/sarvodayaKumar), Senior Software Engineer.

## Run locally

Requires **Node.js 22.6 or newer within Node 22** (pinned in `.nvmrc`).

```bash
nvm use
npm install
npm run dev
```

`npm run dev` starts Next.js **and** watches the resume PDF. Replace `/mnt/d/Download/sarvodayaKumar.pdf` and the Employment section regenerates; open source is left intact.

Open [http://localhost:3000](http://localhost:3000).

## Tests

Run the built-in Node.js test suite (no additional test framework dependency is required):

```bash
npm test
```

The tests exercise comment API service behavior with an in-memory data store, including public comment listing/creation, validation, cooldown and daily limits, moderation authorization/actions, and database-error propagation.

## Browser and accessibility tests

The Playwright suite covers homepage-to-blog navigation, published post routes, the mobile menu with keyboard input, and the comment submission flow. Comment API requests are stubbed in browser tests so the suite does not need a live Neon database.

Install the pinned browser-test tools (kept separate from the application lockfile):

```bash
npm install --no-save --package-lock=false @playwright/test@1.56.1 @axe-core/playwright@4.10.2
npx playwright install chromium
```

Build and run the browser suite:

```bash
DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/portfolio npm run build
npm run test:e2e
```

The Playwright configuration starts the production server on `http://127.0.0.1:3000`. axe-core checks WCAG 2.0/2.1 A and AA rules on the homepage and blog index; critical violations fail the suite, while serious violations are attached as test annotations for remediation. CI uploads traces, screenshots, videos, and the HTML report when browser tests fail.

## Admin comment moderation

Admin sign-in exchanges the server-only `ADMIN_TOKEN` for an eight-hour random session. The browser never stores or sends the admin token after sign-in. Session identifiers are stored only as SHA-256 hashes in the `admin_sessions` table and delivered in an HttpOnly, Secure (in production), SameSite=Strict cookie scoped to `/api`. Sign-out revokes the server-side session. Admin sign-in and moderation mutations validate the request Origin. Failed sign-ins are rate-limited to five attempts per client IP in a rolling 15-minute window; the IP is validated from the trusted Vercel edge header (or a trusted proxy `x-real-ip` header) and stored only as an HMAC keyed with the server-only `ADMIN_TOKEN`. Authentication failures use generic responses, and rate-limit state is stored in `admin_auth_attempts`.

After deploying the session changes, run the database initializer once to create the `admin_sessions` and `admin_auth_attempts` tables:

```bash
npm run db:init-comments
```

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

Write in Markdown. Files that start with `_` are ignored (see `_template.md`). Drafts use `published: false`.
```

Locally the blog is at `/blog`. In production it is served on **blog.sarvodaya.dev** from the same Vercel project.

Add both hostnames on that Vercel project:

1. `sarvodaya.dev` (and `www` if you want it)
2. `blog.sarvodaya.dev`

DNS:

- Apex / www → Vercel
- `blog` CNAME → `cname.vercel-dns.com`

The homepage Blog block updates on refresh in `npm run dev` or the next production build.

## Vercel deployment workflow

Pull requests run a Vercel CLI build-only validation after the unit and browser/accessibility suites pass. The workflow links the existing Vercel project, pulls its Preview environment variables, and runs `vercel build`; it does **not** run `vercel deploy` and does not publish a Preview deployment.

Add a `VERCEL_TOKEN` secret under **GitHub → Settings → Secrets and variables → Actions** for this repository. The token needs access to the `sarvodaya-portfolio` Vercel team and the `sarvodaya-kumar` project.

Vercel Preview deployments are disabled for this project. Production deployment remains handled by Vercel's Git integration when a commit reaches `main` after the pull request is merged. Keep the `main` branch protected and require the unit, Playwright/axe, and Vercel dry-run checks before allowing a merge.

### CI Preview and CD Production deployments

The GitHub Actions workflow separates validation and deployment:

- Pull requests run unit tests and Playwright/axe checks. Only after both jobs pass, CI builds and deploys a Vercel Preview using `vercel build` and `vercel deploy --prebuilt`.
- A push to `main` (normally the merge commit from an approved PR) runs the same test jobs. Only after they pass, the CD job builds with the Production environment and deploys with `vercel deploy --prebuilt --prod`.
- Both jobs use the pinned Vercel CLI version `65.12.1` and require the GitHub Actions secret `VERCEL_TOKEN`.
- Preview deployments are enabled in the Vercel project. Production deployment is performed by the GitHub Actions CD job.

Configure `VERCEL_TOKEN` in GitHub repository Actions secrets. It must have access to the Vercel team `sarvodaya-portfolio` and project `sarvodaya-kumar`. Protect `main` and require the unit and browser checks before merge.
