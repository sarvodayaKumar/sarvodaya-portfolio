# Sarvodaya Kumar — Portfolio

Personal site for [Sarvodaya Kumar](https://github.com/sarvodayaKumar), Senior Software Engineer.

## Run locally

Requires **Node.js 20.9+** (pinned to **v26.8.1** via `.nvmrc`).

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
