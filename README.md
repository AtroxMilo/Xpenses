# Xpenses

A local-first expense tracker web app. Record what you spend, tag it, and see
week-over-week / month-over-month where your money goes. Installable to the
iPhone home screen as a PWA.

## Status — MVP

| Milestone | Scope | State |
| --------- | ----- | ----- |
| M1 | Add / edit / delete expenses, categories, tags, search | ✅ done |
| M2 | Dashboard: period total, ▲/▼ vs previous period, daily-spend chart, by-category breakdown | ✅ done |
| M3 | Budgets (overall + per category) and Goals with progress | ✅ done |
| M4 | PWA polish + deploy to Cloudflare Pages | 🔜 in progress |
| M5 | Receipt scanning → AI line-item extraction (serverless proxy + vision model) | ⏳ planned |

Currency is intentionally not modelled — every amount is a plain number.
All data lives in the browser (IndexedDB via Dexie). Use **Settings → Export
backup** regularly; cloud sync with email is a later milestone.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview  # serve the production build
```

Stack: Vite + React + TypeScript · Tailwind CSS v4 · Dexie (IndexedDB) ·
React Router · Recharts · vite-plugin-pwa.

## Deploy — Cloudflare Pages

### Option A — one command (no GitHub repo needed)

```bash
npx wrangler login      # one time, opens a browser
npm run deploy          # runs the build, then `wrangler deploy`
```

Re-run `npm run deploy` any time to ship an update.

### Option B — connect Git (auto-deploy on push)

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Compute → Workers & Pages → Create → Pages tab →
   Connect to Git**, pick the repo.
3. Build settings:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`

`wrangler.jsonc` serves `dist/` as static assets with SPA fallback
(`not_found_handling: "single-page-application"`) — no `_redirects` file, no
Worker script. Receipt scanning needs no server key: users supply their own
AI key in Settings and it is stored only in their browser.

## Project layout

```
src/
  db/        Dexie database, schema types, CRUD helpers, export/import
  hooks/     useLiveQuery wrappers (expenses, period setting)
  lib/       date ranges, number formatting, category metadata
  components/ Layout (tab bar), shared UI primitives
  pages/     Dashboard, Expenses, AddExpense, Budgets, Goals, Settings
```
