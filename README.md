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

## Administrator authentication and API access

The admin area uses one configured administrator identity; there is no public registration or password reset endpoint.

Configure these **server-only Vercel environment variables** for every environment (Production, Preview, and Development as applicable):

- `ADMIN_USERNAME`: administrator username or email.
- `ADMIN_PASSWORD_HASH`: scrypt password hash generated locally; never store the plaintext password in Vercel or source control.
- `ADMIN_AUTH_PEPPER`: independent random secret of at least 32 characters, used to HMAC trusted client IPs for login throttling and one-time-code hashes.
- `ADMIN_TOTP_ENCRYPTION_KEY`: independent 32-byte key encoded as 64 hexadecimal characters; used only by the server to encrypt authenticator secrets with AES-256-GCM. Generate with `openssl rand -hex 32`; keep it separate from `ADMIN_AUTH_PEPPER`.
- `DATABASE_URL`: Neon database connection string used for sessions, persistent login throttling, and MFA credential storage.

Generate a password hash locally. Use a password of at least 14 characters and do not paste the plaintext into chat, GitHub, or source control:

```bash
read -s -p "New admin password: " ADMIN_PASSWORD; echo
printf '%s' "$ADMIN_PASSWORD" | node scripts/hash-admin-password.mjs
unset ADMIN_PASSWORD
```

Copy the single hash output into `ADMIN_PASSWORD_HASH`. Generate a separate pepper with `openssl rand -hex 32` and set it as `ADMIN_AUTH_PEPPER`. Do not prefix these variables with `NEXT_PUBLIC_`.

Sign in at `/admin/comments`; the same server-side session authorizes the operations dashboard at `/admin`. Password verification uses scrypt (N=65536, r=8, p=1, 64-byte output). Login failures return generic responses and are limited to five attempts per trusted client IP per 15-minute window. If the trusted Vercel/proxy IP header or database is unavailable, login fails closed.

Before an authenticator is enabled, successful password sign-in creates a random eight-hour session. Enroll at `/admin/mfa` while signed in: the server stores the TOTP secret encrypted with AES-256-GCM, pending enrollment expires after ten minutes, and enrollment is activated only after a valid six-digit code is confirmed. The setup page provides the manual key and standard `otpauth://` URI for Google Authenticator, Microsoft Authenticator, 1Password, and compatible apps.

After enrollment, password sign-in creates only a five-minute, single-use MFA challenge; it does not create an admin session. The authenticator code must be valid and its time-step must not have been used previously. Only then is a new eight-hour session created with `mfa_verified=true`. Analytics, operations, and comment-moderation APIs independently enforce that assurance. Existing password-only sessions are denied admin data access once MFA is enabled. Sessions store only token hashes; browser cookies are HttpOnly, SameSite=Strict, Secure in production, and scoped to `/api`. Sign-out revokes the server-side session.

### API access policy

- **Private — MFA-assured session required after enrollment:** `/api/admin/operations`, `/api/admin/analytics`, and `/api/comments/moderate`.
- **Public by design:** `GET /api/comments` returns approved comments only; `POST /api/comments` accepts moderated submissions and enforces same-origin, request-size, input, and rate limits. The analytics ingestion endpoint, when deployed, is public by design and accepts only bounded same-origin aggregate events.
- **Authentication boundary:** `/api/admin/session` exposes session status, same-origin credential sign-in, and sign-out. `/api/admin/mfa` permits authenticated enrollment and confirmation; `/api/admin/mfa/challenge` accepts only the short-lived challenge cookie and a valid TOTP code. Neither endpoint exposes stored TOTP secrets.
- New API routes must be explicitly added to the access-policy test allowlist or protected with `authorizeAdminSession`.

Before enabling enrollment, set `ADMIN_TOTP_ENCRYPTION_KEY` in the deployment environment and run the idempotent database initializer against the target `DATABASE_URL`. The initializer adds MFA credential, challenge, and session-assurance schema:

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
