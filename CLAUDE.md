# Sabetha Golf Club

Rebuild of the Sabetha Golf Club website plus simple systems (pay-to-play, cart board, order-to-course, memberships, staff tablet). Full spec, phases and open questions: [PLAN.md](./PLAN.md). Read it before starting work.

The club has not been pitched yet. Everything runs in demo mode with sandbox payments and clearly marked placeholder data.

## Stack

Next.js (App Router, TypeScript strict) + Tailwind, Supabase (Postgres, auth, Realtime), Square Web Payments SDK (sandbox; Stripe test mode is the fallback), deployed on Vercel. The installed Next.js is newer than most training data: check `node_modules/next/dist/docs/` before relying on memory of its APIs.

## Layout

```
src/app/              routes (App Router)
src/lib/              shared code: payments/ (Square adapter), supabase/ (admin, server, browser clients),
                      env.ts (validated env), pricing.ts (quoteRound), dates.ts, hours.ts
src/content/          settings.ts: placeholder hours, rates, contact (replaced by DB later)
supabase/migrations/  SQL migrations (review before applying)
docs/                 ISSUES.md: Phase 1 task list
public/images/        photos (use next/image)
```

## Commands

```
npm run dev          # local dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (single run)
npm run build        # production build
npm run format       # Prettier (format:check to verify)
npm run check:square # one $1.00 Square SANDBOX payment to prove credentials work
```

Lint, typecheck, test and build must all pass before opening a PR. CI runs the same four on every PR.

## Rules

- **Square sandbox only** until Phase 4. No production keys anywhere.
- **Never commit secrets.** Only `.env.example` (names, no values) is tracked; real values go in `.env.local`.
- **No tee times.** It is a show-up-and-play club. Do not build or suggest a tee sheet.
- **Prices, hours and kitchen status come from settings** (`getSettings()` / the `settings` table), never hardcoded in components.
- **Mark placeholder data** as "Sample" so the demo does not misrepresent the club.
- **Small PRs**, one task each, from a feature branch. Never push to `main`.
- Keep it simple: no extra services unless they clearly earn their place.
- Other hard decisions (PLAN.md section 3): no golfer accounts in v1; walk-ins keep paying at the POS.
- **No email sending.** No email sender service for this project. Confirmations are on-screen pages; membership applications are stored in the DB and reviewed in /admin.
