# Phase 2 tasks (systems in demo mode)

Each item is one small PR, merged when CI and the Vercel preview pass. Square stays in **sandbox**; no real money moves. Spec: [PLAN.md](../PLAN.md) section 5, Phase 2.

**Phase 2 is done when**, using sandbox payments on the deployed site, someone can pay for a round with a cart on a phone, watch it appear on the staff tablet, mark the cart ready, place a drink order from hole 5, and walk it through to Delivered.

## Ground rules

- Prices are always computed on the server from settings. The browser never sends an amount.
- Public visitors never write to Supabase directly. Server actions validate input and write with the service-role key; RLS stays locked down (see `supabase/migrations/0001_initial_schema.sql`).
- Every payment goes through `src/lib/payments` (Square sandbox). Swapping to Stripe later should only touch that folder.
- Receipts and status pages use unguessable IDs (UUIDs), never sequential numbers.
- No email or SMS sending. Confirmations are on-screen pages.

## Tasks

1. **Foundation**: Supabase server/admin/browser clients, env validation, `lib/payments` with a Square sandbox adapter (create payment, idempotency keys), and `quoteRound()` pricing with tests. _Done when:_ tests cover weekday/weekend, 9/18, players and carts, and a sandbox test payment succeeds from a script.
2. **Seed data and schema tweaks** (migration `0002`): sample carts, the menu from `src/content/menu.ts` plus clearly labelled sample drinks (alcohol flagged), sample membership tiers, settings rows (kitchen status, cart count), `rounds.carts` (party may want more than one cart), short human-readable order codes. Applied to the demo database. _Done when:_ the migration is applied and the tables have the seed rows.
3. **Pay to Play form**: date (default today), 9/18, players, carts, arrival time, name/phone/email; live price from `quoteRound()`; cart availability check. No payment yet. _Done when:_ the form validates on a phone and shows the right total.
4. **Pay to Play checkout**: Square Web Payments SDK card form, server action that re-quotes, re-checks carts, charges, and saves the round and cart reservations; confirmation page with QR code and order code. _Done when:_ a sandbox card pays and the confirmation page shows the QR.
5. **Staff login**: Supabase email/password auth at `/staff/login`, `/staff` protected, staff/admin role from `app_metadata`. _Done when:_ a staff user can sign in and a signed-out visitor is redirected.
6. **Staff tablet: Paid today and Carts board**: live via Supabase Realtime with a chime; assign cart #, Ready, Out, Returned; walk-in **Rent cart**. _Done when:_ a round paid on a phone appears on the tablet without refreshing, and a walk-in rental replaces the paper sheet flow.
7. **Order to the Course**: `/order?hole=5` QR-friendly page, hole picker, menu filtered by kitchen status and clubhouse hours, cart, name/phone, Square payment, live status page. _Done when:_ a sandbox drink order from hole 5 succeeds and its status page updates live.
8. **Staff orders queue and kitchen toggle**: New → Preparing → Out for delivery → Delivered, 21+ badge, chime; Kitchen open / Drinks only / Ordering closed. _Done when:_ the order from task 7 walks through to Delivered and the toggle changes what `/order` offers.
9. **Membership application**: online form saved to the database; listed in admin for the Club Secretary. _Done when:_ an application appears in admin.
10. **Dues payment**: pay in full or first/second half against a tier, referenced by name/email. _Done when:_ a sandbox dues payment is recorded.
11. **Admin**: edit prices, hours, menu items, cart count, membership tiers and kitchen default; settings move from `src/content/settings.ts` to the database (cached, refreshed on save); CSV export of rounds and orders. _Done when:_ changing a price in admin changes it on the public site.
12. **Honor-box QR signs**: printable QR sheets for hole #1 (Pay to Play), carts and tee boxes (Order to the Course, with hole number). _Done when:_ the sheets print cleanly and the codes open the right pages.
13. **End-to-end demo check**: run the Phase 2 "done when" on the deployed site with a phone and a tablet-sized browser; fix anything that breaks. _Done when:_ the full walkthrough passes and is written up for the pitch.
