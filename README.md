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
- `ADMIN_PASSWORD_HASH`: bcrypt hash (cost 12) generated locally; never store the plaintext password in Vercel or source control.
- `ADMIN_AUTH_PEPPER`: independent random secret of at least 32 characters, used to HMAC trusted client IPs for login throttling and one-time-code hashes.
- `ADMIN_TOTP_ENCRYPTION_KEY`: independent 32-byte key encoded as 64 hexadecimal characters; used only by the server to encrypt authenticator secrets with AES-256-GCM. Generate with `openssl rand -hex 32`; keep it separate from `ADMIN_AUTH_PEPPER`.
- `RESEND_API_KEY`: server-only Resend API key used to deliver email MFA codes.
- `ADMIN_EMAIL_FROM`: verified Resend sender address, for example `Portfolio Security <security@example.com>`. `ADMIN_USERNAME` must be the administrator's email address to use email fallback.
- `DATABASE_URL`: Neon database connection string used for sessions, persistent login throttling, and MFA credential storage.

Generate a password hash locally. Use a password of at least 14 characters and do not paste the plaintext into chat, GitHub, or source control:

```bash
read -s -p "New admin password: " ADMIN_PASSWORD; echo
printf '%s' "$ADMIN_PASSWORD" | node scripts/hash-admin-password.mjs
unset ADMIN_PASSWORD
```

Copy the bcrypt hash output into `ADMIN_PASSWORD_HASH`. Existing scrypt hashes are no longer accepted; generate and configure a new bcrypt hash before deploying this change. bcrypt accepts at most 72 UTF-8 bytes. Generate a separate pepper with `openssl rand -hex 32` and set it as `ADMIN_AUTH_PEPPER`. Do not prefix these variables with `NEXT_PUBLIC_`.

Sign in at `/admin/comments`; the same server-side session authorizes the operations dashboard at `/admin`. Password verification uses bcrypt with cost 12. Login failures return generic responses and are limited to five attempts per trusted client IP and five attempts per configured administrator account per 15-minute window. The account bucket uses a keyed digest, not the username. MFA factors use independent persistent IP/account buckets so a successful password check cannot reset MFA failures; TOTP, email OTP, and recovery challenges also have per-challenge attempt caps. If the trusted Vercel/proxy IP header or database is unavailable, authentication fails closed.

Password verification creates only a restricted enrollment session. That session is accepted solely by the MFA enrollment endpoints; every protected admin API requires an `mfa_verified=true` session even before enrollment is complete. Sign-in always routes to `/admin/mfa` until an authenticator has been enrolled and verified. Enroll at `/admin/mfa` while in this restricted state: the server stores the TOTP secret encrypted with AES-256-GCM, pending enrollment expires after ten minutes, and enrollment is activated only after a valid six-digit code is confirmed. The setup page provides the manual key and standard `otpauth://` URI for Google Authenticator, Microsoft Authenticator, 1Password, and compatible apps. It also renders the QR code locally in the browser; the TOTP secret is not sent to a third-party QR service.

After enrollment, password sign-in creates only a five-minute, single-use MFA challenge; it does not create an admin session. The authenticator code must be valid and its time-step must not have been used previously. Only then is a new eight-hour session created with `mfa_verified=true`. If the authenticator is unavailable, an email OTP can be requested as an alternate factor; it expires after five minutes, is stored only as a peppered hash, and is limited to three sends and five verification attempts per challenge. The sign-in page also supports passwordless email magic links; tokens are stored as peppered hashes, expire after ten minutes, are single-use, and are bound to the requesting origin. The token is carried in a URL fragment and requires an explicit confirmation click, keeping it out of HTTP request URLs and avoiding automatic email-link scanner consumption. Email delivery requires the Resend environment variables above. Ten recovery codes are issued at enrollment and stored only as keyed hashes; each is single-use, and regeneration requires a fresh TOTP proof. Disabling MFA requires an MFA-assured session created within the previous ten minutes and administrator password reauthentication; this supports authenticator, email OTP, or recovery-code sign-in. It revokes all sessions and requires re-enrollment before admin API access resumes. Authentication audit events record only a bounded event type, success/failure, and a keyed client digest (never passwords, OTPs, recovery codes, tokens, or email addresses); the initializer prunes events older than 90 days. Analytics, operations, and comment-moderation APIs independently enforce that assurance at all times. Password-only and enrollment-only sessions are never accepted by protected admin APIs. Sessions store only token hashes; browser cookies are HttpOnly, SameSite=Strict, Secure in production, and scoped to `/api`. Sign-out revokes the server-side session.

### API access policy

- **Private — MFA-assured session required at all times:** `/api/admin/operations`, `/api/admin/analytics`, and `/api/comments/moderate`.
- **Public by design:** `GET /api/comments` returns approved comments only; `POST /api/comments` accepts moderated submissions and enforces same-origin, request-size, input, and rate limits. The analytics ingestion endpoint, when deployed, is public by design and accepts only bounded same-origin aggregate events.
- **Authentication boundary:** `/api/admin/session` exposes session status, same-origin credential sign-in, and sign-out. `/api/admin/mfa` permits restricted enrollment and reauthenticated disable; `/api/admin/mfa/challenge` verifies TOTP, `/api/admin/mfa/email` verifies email OTP only for password-originated challenges, and `/api/admin/mfa/recovery` redeems a recovery code or regenerates codes with an MFA-assured session plus fresh TOTP. Email magic-link challenges explicitly disallow email OTP so mailbox access alone cannot satisfy both sign-in factors. `/api/admin/email-link` issues and consumes origin-bound passwordless links. These routes expose no stored TOTP secrets.
- New API routes must be explicitly added to the access-policy test allowlist or protected with `authorizeAdminSession`.

Before enabling enrollment, set `ADMIN_TOTP_ENCRYPTION_KEY` and the other admin secrets in Vercel. The idempotent initializer adds MFA credentials, session assurance, email OTP/magic-link challenges, recovery-code hashes, authentication throttles, and redacted audit-event schema.

- **Production:** use GitHub Actions → **Production database migration (manual)**. It requires the exact confirmation phrase `RUN-PRODUCTION-ADMIN-MFA-MIGRATION`, the `production` GitHub Environment, and the existing `VERCEL_TOKEN` repository secret. The workflow checks out reviewed `main`, pulls only the Production environment, and runs the idempotent initializer. It never deploys the application.
- **Local development:** pull the intended Development database environment and run `npm run db:init-comments` manually. Never point a local command at Production by accident.

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

## Deployment and CI policy

GitHub Actions is the source of truth for pull-request validation. CI does not call Vercel, link a Vercel project, pull Vercel environment variables, or create Preview/Production deployments. The required checks are independent of Vercel quotas and credentials:

- Comment API and unit tests
- ESLint
- Production Next.js build and TypeScript validation
- Playwright and axe accessibility regression
- CodeQL (JavaScript/TypeScript, security-extended queries)
- Gitleaks secret scanning
- npm high/critical vulnerability audit
- Lighthouse performance and accessibility budgets

Production deployment remains a separate release operation and must only happen after review, merge, and production database migration. No CI workflow in this PR deploys to Vercel. Vercel's daily deployment quota therefore cannot fail a GitHub CI check.

The Vercel project stores runtime-only admin credentials as sensitive server environment variables. GitHub Actions does not need `VERCEL_TOKEN`, production database credentials, or admin secrets for PR validation. Do not add runtime credentials to GitHub Actions unless a separately reviewed workflow genuinely needs them.

Before production release, verify that the Production and Preview Vercel environments have the required runtime variables, run the idempotent database initializer against the intended Neon database, confirm the verified email sender and Resend API key if email fallback is enabled, and complete a fresh MFA enrollment. Keep `main` protected and require all CI/security checks before merge.
