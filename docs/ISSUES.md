# Phase 1 tasks (public site)

Each item is one small PR. Order matters where noted. All values come from `getSettings()`; no hardcoded prices or hours. Phase 1 is done when the site is live on a Vercel preview, Lighthouse mobile is 90 or higher, and every piece of info from the old site is present.

1. **Site shell**: root layout, header nav, footer, mobile menu, base typography and colors. _Done when:_ nav works on a 400px screen and every link target exists (stub pages ok).
2. **Open-now badge**: `isOpenNow(settings, date)` helper with tests, plus a badge component. _Done when:_ tests cover closed days, before/after hours, and the badge renders in the header.
3. **Home**: hero, hours, rates summary, three big CTAs (Pay to Play, Order to the Course, Become a Member). _Done when:_ CTAs are above the fold on mobile; Pay and Order link to "coming soon" pages.
4. **Golf page**: course facts (9 holes, 5,990 yds, tees, history), green fees and cart rental from settings, rules, "pay at the box on hole 1 when the clubhouse is closed" note. _Done when:_ weekday/weekend 9 and 18 prices all show.
5. **Memberships page**: how it works, dues deadlines (March 1, or half March 1 / half June 1), new-member and under-30 rates, Cart Shed, placeholder tiers labelled "Sample". _Done when:_ no real price is implied and apply CTA is a stub.
6. **Menu page**: real text menu replacing the JPG, grouped by category, alcohol flagged. _Done when:_ every item from the current menu image is transcribed.
7. **Pool page**: hours, rules, guest policy (guests need a member for the pool).
8. **Events and Tournaments**: 2026 tournaments as text (from the PDF), plus where to find updates.
9. **Clubhouse Rental page**: rental info and the email contact.
10. **Contact and map**: address, directions (~1 mile north of Sabetha), phone/email placeholders, embedded map, Facebook, TextCaster text alerts.
11. **Gift Cards**: page linking to the existing Square gift card page.
12. **Photos**: add images to `public/images`, use `next/image` with alt text and sizes. _Done when:_ no layout shift and images are optimized.
13. **SEO**: per-page titles and descriptions, Open Graph, `GolfCourse`/`LocalBusiness` JSON-LD, `sitemap.ts`, `robots.ts`.
14. **Vercel preview**: connect the repo, set env vars, confirm the preview deploys from PRs. _Done when:_ a preview URL is shared with Tabor.
15. **Performance pass**: run Lighthouse mobile and fix what is below 90. _Done when:_ scores are 90+ for performance, accessibility, best practices and SEO.
16. **Content audit**: compare every page of sabethagolfclub.com against the new site. _Done when:_ a checklist shows nothing missing.
