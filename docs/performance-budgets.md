# Lighthouse CI and performance budgets

GitHub Actions runs Lighthouse CI for pull requests and pushes to `main` against a production build of the site. The representative routes are the homepage (`/`) and blog index (`/blog`). Each route is measured twice and the machine-readable Lighthouse reports are uploaded as the `lighthouse-reports` workflow artifact for 14 days, including when an assertion fails.

## Initial budgets

| Metric | Initial threshold | Enforcement |
| --- | ---: | --- |
| Largest Contentful Paint (LCP) | <= 4,000 ms | Fail |
| Cumulative Layout Shift (CLS) | <= 0.10 | Fail |
| Accessibility score | >= 0.90 | Fail |
| JavaScript transfer size | <= 1,500,000 bytes (1.5 MB) | Fail |
| Performance score | >= 0.75 | Warning |

These are initial CI guardrails, not a claim that field Core Web Vitals meet Google's "good" thresholds. The first measurements establish a repeatable baseline; review the uploaded reports and tighten the budgets as the site is optimized. The performance score is warning-only initially because shared GitHub-hosted runners, CPU contention, and network simulation can cause lab-score variance. LCP, CLS, accessibility, and JavaScript payload budgets remain blocking.

## Local verification

Use Node.js 22 (the version range declared in `package.json`):

```bash
npm ci
npm install --no-save --package-lock=false @lhci/cli@0.14.0 playwright@1.56.1
npx playwright install chromium
DATABASE_URL=postgresql://ci:ci@127.0.0.1:5432/portfolio npm run build
CHROME_PATH="$(find "$HOME/.cache/ms-playwright" -type f -name chrome -print -quit)"
export CHROME_PATH
npx lhci autorun --config=./lighthouserc.json
```

Lighthouse starts the production server itself using the command in `lighthouserc.json`. Reports are written to `.lighthouseci/`.

## Lab versus field data

This workflow measures lab performance in a controlled CI environment. It does not collect or infer real-user Core Web Vitals. When sufficient real-user data is available, review field LCP, INP, and CLS separately through an approved real-user monitoring source and define field targets independently of these Lighthouse assertions.
