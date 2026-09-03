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

1. Push this repo to GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy. `public/_redirects` already handles SPA client-side routing.

No environment variables are needed yet. The receipt-scanning proxy (M5) will
add a Pages Function under `functions/` plus an API key secret.

## Project layout

```
src/
  db/        Dexie database, schema types, CRUD helpers, export/import
  hooks/     useLiveQuery wrappers (expenses, period setting)
  lib/       date ranges, number formatting, category metadata
  components/ Layout (tab bar), shared UI primitives
  pages/     Dashboard, Expenses, AddExpense, Budgets, Goals, Settings
```
