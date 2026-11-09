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

Run the built-in Node.js test suite:

```bash
npm test
```

The tests cover comment behavior, administrator credential verification and session handling, plus an API access-policy inventory test that fails if a new API route is not explicitly classified.

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

## Administrator authentication and API access

The admin area uses one configured administrator identity; there is no public registration or password reset endpoint.

Configure these **server-only Vercel environment variables** for every environment (Production, Preview, and Development as applicable):

- `ADMIN_USERNAME`: administrator username or email.
- `ADMIN_PASSWORD_HASH`: scrypt password hash generated locally; never store the plaintext password in Vercel or source control.
- `ADMIN_AUTH_PEPPER`: independent random secret of at least 32 characters, used to HMAC trusted client IPs for login throttling.
- `DATABASE_URL`: Neon database connection string used for sessions and persistent login throttling.

Generate a password hash locally. Use a password of at least 14 characters and do not paste the plaintext into chat, GitHub, or source control:

```bash
read -s -p "New admin password: " ADMIN_PASSWORD; echo
printf '%s' "$ADMIN_PASSWORD" | node scripts/hash-admin-password.mjs
unset ADMIN_PASSWORD
```

Copy the single hash output into `ADMIN_PASSWORD_HASH`. Generate a separate pepper with `openssl rand -hex 32` and set it as `ADMIN_AUTH_PEPPER`. Do not prefix these variables with `NEXT_PUBLIC_`.

Sign in at `/admin/comments`; the same server-side session authorizes the operations dashboard at `/admin`. Password verification uses scrypt (N=65536, r=8, p=1, 64-byte output). Login failures return generic responses and are limited to five attempts per trusted client IP per 15-minute window. If the trusted Vercel/proxy IP header or database is unavailable, login fails closed.

Successful sign-in creates a random eight-hour session. Only its SHA-256 hash is stored in `admin_sessions`; the browser receives an HttpOnly, SameSite=Strict cookie (Secure in production) scoped to `/api`. Sign-out revokes the server-side session. Admin API handlers independently validate the session on every request; hiding admin pages in the UI is not an authorization boundary.

### API access policy

- **Private — session required:** `/api/admin/operations`, `/api/admin/analytics` (when analytics is deployed), and `/api/comments/moderate`.
- **Public by design:** `GET /api/comments` returns approved comments only; `POST /api/comments` accepts moderated submissions and enforces same-origin, request-size, input, and rate limits. The analytics ingestion endpoint, when deployed, is public by design and accepts only bounded same-origin aggregate events.
- **Authentication boundary:** `/api/admin/session` exposes only session status, same-origin credential sign-in, and same-origin sign-out. It never exposes secrets or admin data.
- New API routes must be explicitly added to the access-policy test allowlist or protected with `authorizeAdminSession`.

After deploying the session/database changes, run the idempotent database initializer once against the target `DATABASE_URL`:

```bash
npm run db:init-comments
```

## What updates from where

| Content | Source |
| --- | --- |
| Employment, skills, summary, certs, education | Resume PDF |
| Open source roles, PRs, GitHub/LinkedIn, projects | `content/profile.overrides.json` |

```bash
npm run resume:sync
npm run resume:watch
npm run dev:next
```

## Blog

Posts are Markdown files in `content/blog/`. Posts that start with `_` are ignored; drafts use `published: false`.

Locally the blog is at `/blog`. In production it is served on **blog.sarvodaya.dev** from the same Vercel project.

## Vercel deployment workflow

Pull requests run CI validation and a Vercel CLI build-only validation. Production deployment is handled by the GitHub Actions CD workflow after an approved merge to `main`. Keep `main` protected and require unit, browser/accessibility, security, and build checks before merging.
