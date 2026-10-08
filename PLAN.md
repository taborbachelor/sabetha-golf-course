# Sabetha Golf Club — Website Rebuild & Systems Plan

Owner: Tabor (directing). Built with Claude Code.
Status: building on spec. **The club has not been pitched yet.** Everything up to the pitch runs in demo/test mode with placeholder data where real data is unknown.

---

## 1. Goal

Replace https://www.sabethagolfclub.com/ (Wix, info-only, menu is a JPG, no prices for memberships) with a fast, mobile-first site plus simple systems that let golfers:

- pay green fees (9 or 18) ahead of time and just show up
- reserve a cart with that payment
- apply for / pay membership dues online
- order food and drinks out to the hole they're on

…and give clubhouse staff one tablet screen that replaces the paper cart sheet and the honor box.

## 2. Facts from the current site (as of 2026-10-07)

- **9-hole course**, 5,990 yds, white and blue tees. "18 holes" = twice around. Built 1923, est. 1925. ~1 mile north of Sabetha, KS.
- **Green fees:** weekday 9 = $20, 18 = $30; weekend 9 = $25, 18 = $35.
- **Cart rental:** 9 = $15, 18 = $20.
- **Clubhouse hours:** Mon–Tue closed; Wed–Fri 4:30–8pm; Sat 11am–8pm; Sun 11am–7pm. Kitchen may close for events; bar stays open to members.
- **When the clubhouse is closed, non-members register and pay at a box at hole #1.** → Online pay-ahead directly replaces this. This is the strongest pitch point.
- Memberships: no prices online. Inquiry by email to the Club Secretary. Dues paid in full by March 1, or half March 1 / half June 1. Special rates for new members (not a member in 5 yrs) and members under 30. Optional **Cart Shed rental** for members.
- Guests don't need a member to golf; they do need one for the pool.
- Other pages: Pool, Menu (image), Course Videos, Contact, 2026 Tournaments (PDF), clubhouse rental (email), gift cards via **Square**, TextCaster text alerts, Facebook.
- The Square gift-card link strongly suggests **the counter POS is Square.** Confirm with the club before Phase 2 payments work.

## 3. Hard decisions already made

- **No tee times.** It's a show-up-and-play club. Do not build or suggest a tee sheet.
- **No golfer accounts in v1.** Guest checkout using name, phone and email. Less friction, less to build.
- **Walk-ins keep paying at the POS.** The tablet only logs them; it does not take their payment.
- **Food/drinks out to the course already exists** as a service. We are digitizing ordering, not inventing a new service.

## 4. Stack

- **Next.js (App Router, TypeScript) + Tailwind**, deployed on **Vercel** (free tier; preview URL for the demo).
- **Supabase**: Postgres database, staff auth, **Realtime** so the staff tablet updates live without refreshing.
- **Payments: Square Web Payments SDK (sandbox)** is preferred if the club's POS is Square, so online and counter sales land in one dashboard and reconcile automatically. **Fallback: Stripe Checkout (test mode).** Wrap payments behind one small module (`lib/payments`) so switching providers is a contained change.
- Content (prices, hours, menu, settings) lives in the DB and is editable from an admin screen. No CMS.
- QR codes: generated server-side (`qrcode` npm package) from the order ID.

## 5. Phases

### Phase 1 — Public site (the demo)

Pages: Home, Golf (course, rates, rules), Memberships, Menu (real text, not an image), Pool, Events/Tournaments, Clubhouse Rental, Contact/Map, Gift Cards (link to existing Square page).

- Hours/"Open now" badge driven by settings.
- Big, obvious mobile CTAs: **Pay to Play**, **Order to the Course**, **Become a Member**.
- Photos: Tabor supplies (downloaded from the old site plus his own). Put them in `/public/images`; use `next/image`.
- Basic SEO: titles, meta, Open Graph, `LocalBusiness`/`GolfCourse` schema, sitemap.
- **Done when:** the site is live on a Vercel preview URL, Lighthouse mobile ≥ 90, and every piece of info from the old site is present.

### Phase 2 — Systems in demo mode

**2a. Pay to Play**

- Flow: choose date (default today), 9 or 18, number of players, optional cart (count), arrival time ("Now / ~15 min / ~30 min / later today: pick a time"), name, phone, email → pay.
- Weekday/weekend price computed from the date. Prices come from settings.
- Confirmation page (no email; the page is the receipt): name, party size, holes, cart yes/no, **QR code**, order number. The QR is a receipt; the real check is the staff "Paid today" list.
- **Cart inventory:** a cart can only be reserved online if one is available (total carts minus carts out minus carts reserved for that window). Otherwise show "No carts available online, ask at the clubhouse."
- Honor-box replacement: a sign/QR at hole #1 that links straight to Pay to Play.

**2b. Staff tablet (`/staff`, login required)**
One screen, big touch targets, live via Realtime, with an audible chime on new items.

- **Paid today**: online payments, with name, party, 9/18, and cart.
- **Carts board**: every cart by number, with status _Available / Reserved (name, arrival) / Out (name, since) / Returned_.
  - Online reservation → staff assign a cart #, put the key in, place the "Reserved for ___" sign, tap **Ready**.
  - Walk-in → **Rent cart** button: name, cart #, 9/18 (payment taken at the POS). Tap **Returned** when the cart comes back. _This replaces the paper sheet._
- **Orders queue** (from 2c): _New → Preparing → Out for delivery → Delivered_.
- **Kitchen toggle**: _Kitchen open_ (food + drinks) / _Drinks only_ / _Ordering closed_.

**2c. Order to the Course**

- Golfer opens `/order` (QR stickers on carts and tee boxes), picks their **hole number (1–9)**, adds items from the menu, enters name and phone, and pays online.
- Menu is filtered by the kitchen toggle. If ordering is closed or the clubhouse is closed, show that clearly and don't take orders.
- Alcohol items carry a "21+, ID checked at delivery" flag that is shown to staff.
- Golfer sees a simple status page that updates live.

**2d. Memberships**

- Membership page lists tiers (placeholder prices until the club provides real ones), including the new-member and under-30 rates and the Cart Shed add-on.
- **Online application form** → saved to the DB and shown in the admin screen for the Club Secretary to review (no email sending). The board/secretary still approves.
- **Online dues payment** for approved members: pay in full, or the first/second half. Reference by member name/email; no member login in v1.

**2e. Admin (`/admin`, staff-admin role)**
Edit prices, hours, menu items, number of carts, membership tiers, and kitchen-toggle defaults. View and export orders (CSV) so they can reconcile with the POS.

- **Phase 2 done when:** using sandbox payments, someone can pay for a round with a cart on a phone, watch it appear on the tablet, mark the cart ready, place a drink order from hole 5, and walk it through to Delivered. All end to end on the preview URL.

### Phase 3 — Pitch

- Demo on a phone plus a tablet in front of the manager/board.
- Lead with the honor-box replacement and the paper cart sheet. These are problems they already feel.
- Bring the open questions (section 7) and get answers.

### Phase 4 — Go live (only after club buy-in)

- Club creates or connects its own Square (or Stripe) account. Switch keys to production.
- Load real prices, menu, membership tiers, and cart count.
- Staff logins, 15-minute training, printed QR signs for hole #1, carts and tee boxes.
- Point the domain at Vercel (they're on Wix today; transfer DNS or the domain).
- Register that domain for Apple Pay with Square (see [DEMO.md, "Wallets"](./docs/DEMO.md#wallets-apple-pay-and-google-pay)).
- Soft launch for a couple of weekends, then announce it via TextCaster, the newsletter and Facebook.

## 6. Data model (starting point)

- `settings` (key/value: prices, hours, kitchen_status, cart_count, etc.)
- `rounds`: id, date, holes (9/18), players, name, phone, email, arrival_time, amount, payment_id, status
- `carts`: id, number, active
- `cart_sessions`: id, cart_id, round_id (nullable for walk-ins), name, holes, status (reserved/ready/out/returned), reserved_for, out_at, returned_at, source (online/walkin)
- `menu_items`: id, name, category, price, is_food, is_alcohol, available
- `orders`: id, hole, name, phone, items (jsonb), total, payment_id, status, timestamps
- `membership_tiers`: id, name, price, notes
- `membership_applications`: id, tier_id, name, address, phone, email, cart_shed, status
- `dues_payments`: id, member_name, email, tier_id, installment (full/first/second), amount, payment_id
- Supabase RLS: public can only insert through server actions/API; staff role reads/updates; admin role edits settings.

## 7. Questions for the club (Phase 3)

1. Is the counter POS Square? Do they want online payments in the same account?
2. Membership tiers and prices; does the board need to approve new members?
3. How many rental carts? Are any reserved for members, or for Cart Shed use?
4. No-show / refund policy for prepaid rounds and carts.
5. Who watches the tablet and delivers orders? What happens at a busy moment?
6. Kitchen and bar hours vs. clubhouse hours. Is on-course ordering only available while the clubhouse is open?
7. Do members pay green fees, or is golf included in dues? (This decides whether members need to use Pay to Play.)
8. Is an online processing fee (~3%) acceptable, or should it be built into prices?
9. Who owns the domain and the Wix account?

## 8. Out of scope for v1 (possible later)

Tee times (decided no) · golfer/member accounts and logins · member house tabs · POS integration beyond CSV export · SMS notifications (could reuse TextCaster) · tournament registration and payment · pool passes · clubhouse rental booking calendar · gift card sales (keep the Square link).

## 9. Working rules for the build

- Ship Phase 1 to a preview URL before starting Phase 2.
- Keep it simple: no extra services unless they clearly earn their place.
- All payments stay in sandbox/test mode until Phase 4.
- Mark any placeholder data clearly (e.g. "Sample price") so the demo doesn't misrepresent the club.
