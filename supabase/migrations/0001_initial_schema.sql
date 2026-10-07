-- Sabetha Golf Club: initial schema (PLAN.md section 6)
--
-- NOT APPLIED. Review first, then run via the Supabase CLI or SQL editor.
--
-- Access model:
--   * Public visitors: read-only on settings, menu_items, membership_tiers.
--     All other writes (rounds, orders, applications, dues) go through
--     server actions that use the service role key, which bypasses RLS.
--   * Staff: read/update rounds, carts, cart_sessions, orders.
--   * Admin: everything staff can do, plus edit settings, menu, tiers, carts.
--   Role comes from the JWT: auth.jwt() -> 'app_metadata' ->> 'role'
--   ('staff' or 'admin'). app_metadata is only writable server-side.

-- ---------------------------------------------------------------- helpers

create or replace function public.is_staff() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('staff', 'admin');
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- ----------------------------------------------------------------- tables

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  play_date date not null,
  holes smallint not null check (holes in (9, 18)),
  players smallint not null check (players between 1 and 8),
  name text not null,
  phone text not null,
  email text not null,
  arrival_time text,
  amount_cents integer not null check (amount_cents >= 0),
  payment_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  created_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  active boolean not null default true
);

create table public.cart_sessions (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references public.carts (id),
  round_id uuid references public.rounds (id), -- null for walk-ins
  name text not null,
  holes smallint not null check (holes in (9, 18)),
  status text not null default 'reserved'
    check (status in ('reserved', 'ready', 'out', 'returned')),
  reserved_for timestamptz,
  out_at timestamptz,
  returned_at timestamptz,
  source text not null check (source in ('online', 'walkin')),
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price_cents integer not null check (price_cents >= 0),
  is_food boolean not null default true,
  is_alcohol boolean not null default false,
  available boolean not null default true
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  hole smallint not null check (hole between 1 and 9),
  name text not null,
  phone text not null,
  items jsonb not null,
  total_cents integer not null check (total_cents >= 0),
  payment_id text,
  status text not null default 'new'
    check (status in ('new', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  notes text
);

create table public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid references public.membership_tiers (id),
  name text not null,
  address text not null,
  phone text not null,
  email text not null,
  cart_shed boolean not null default false,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.dues_payments (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  email text not null,
  tier_id uuid references public.membership_tiers (id),
  installment text not null check (installment in ('full', 'first', 'second')),
  amount_cents integer not null check (amount_cents >= 0),
  payment_id text,
  created_at timestamptz not null default now()
);

create index rounds_play_date_idx on public.rounds (play_date);
create index cart_sessions_status_idx on public.cart_sessions (status);
create index orders_status_idx on public.orders (status);

-- -------------------------------------------------------------------- RLS

alter table public.settings enable row level security;
alter table public.rounds enable row level security;
alter table public.carts enable row level security;
alter table public.cart_sessions enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.membership_tiers enable row level security;
alter table public.membership_applications enable row level security;
alter table public.dues_payments enable row level security;

-- Public read-only content
create policy "public read settings" on public.settings
  for select using (true);
create policy "public read menu" on public.menu_items
  for select using (available);
create policy "public read tiers" on public.membership_tiers
  for select using (true);

-- Admin edits content
create policy "admin write settings" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write menu" on public.menu_items
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write tiers" on public.membership_tiers
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write carts" on public.carts
  for all using (public.is_admin()) with check (public.is_admin());

-- Staff operate the tablet
create policy "staff read carts" on public.carts
  for select using (public.is_staff());
create policy "staff read rounds" on public.rounds
  for select using (public.is_staff());
create policy "staff update rounds" on public.rounds
  for update using (public.is_staff()) with check (public.is_staff());
create policy "staff read cart_sessions" on public.cart_sessions
  for select using (public.is_staff());
create policy "staff insert cart_sessions" on public.cart_sessions
  for insert with check (public.is_staff()); -- walk-in "Rent cart"
create policy "staff update cart_sessions" on public.cart_sessions
  for update using (public.is_staff()) with check (public.is_staff());
create policy "staff read orders" on public.orders
  for select using (public.is_staff());
create policy "staff update orders" on public.orders
  for update using (public.is_staff()) with check (public.is_staff());

-- Admin reads applications and dues for reconciliation/export
create policy "admin read applications" on public.membership_applications
  for select using (public.is_admin());
create policy "admin update applications" on public.membership_applications
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin read dues" on public.dues_payments
  for select using (public.is_admin());

-- Realtime for the staff tablet (staff RLS above still applies)
alter publication supabase_realtime add table
  public.rounds, public.cart_sessions, public.orders, public.settings;
