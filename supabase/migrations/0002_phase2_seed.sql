-- Phase 2 schema tweaks and demo seed data.
--
-- Everything seeded here is DEMO data for the pitch. Rows the club hasn't
-- confirmed are marked is_sample = true (cart count, drinks, membership
-- prices). The food menu is transcribed from the club's real menu.

-- ------------------------------------------------------------ schema

-- A party can reserve more than one cart; inventory needs a real time.
alter table public.rounds
  add column carts smallint not null default 0 check (carts between 0 and 4),
  add column arrive_at timestamptz,
  add column code text unique;

-- Short, human-friendly codes staff can read off a phone ("R-7K3Q").
-- Receipts are still looked up by the unguessable id, never by code.
alter table public.orders
  add column code text unique;

alter table public.carts
  add column is_sample boolean not null default false;

alter table public.menu_items
  add column sort_order integer not null default 0,
  add column is_sample boolean not null default false;

alter table public.membership_tiers
  add column sort_order integer not null default 0,
  add column is_sample boolean not null default false;

create index rounds_arrive_at_idx on public.rounds (arrive_at);

-- Carts board on the tablet updates live too.
alter publication supabase_realtime add table public.carts;

-- ------------------------------------------------------------ seed

insert into public.settings (key, value) values
  ('kitchen_status', '"open"'),
  ('cart_shed_price_cents', '0');

-- SAMPLE: the club hasn't said how many rental carts it has.
insert into public.carts (number, is_sample)
select n, true from generate_series(1, 8) as n;

-- Food: transcribed from the club's printed menu (src/content/menu.ts).
insert into public.menu_items (name, category, price_cents, is_food, is_alcohol, sort_order) values
  ('Chicken Strips, 2 piece',  'Lunch',  575, true, false, 10),
  ('Chicken Strips, 4 piece',  'Lunch', 1050, true, false, 11),
  ('Hot Dog',                  'Lunch',  200, true, false, 12),
  ('Ham and Cheddar Slider',   'Lunch',  650, true, false, 13),
  ('Fantail Shrimp, 3 piece',  'Lunch',  625, true, false, 14),
  ('Fantail Shrimp, 6 piece',  'Lunch', 1125, true, false, 15),
  ('Fried Pickles',            'Fryer',  750, true, false, 20),
  ('Mushrooms',                'Fryer',  825, true, false, 21),
  ('Mozzarella Sticks',        'Fryer',  825, true, false, 22),
  ('Bottle Neck Beer Fries',   'Fryer',  700, true, false, 23),
  ('Onion Straws',             'Fryer',  700, true, false, 24),
  ('Cheeseballs',              'Fryer',  825, true, false, 25),
  ('Pepper Jack Cheeseballs',  'Fryer',  825, true, false, 26),
  ('Cheeseburger',             'Dinner', 995, true, false, 30),
  ('Fried Chicken Sandwich',   'Dinner',1050, true, false, 31),
  ('Tenderloin Sandwich',      'Dinner', 995, true, false, 32),
  ('Kids Cheeseburger',        'Kids',   800, true, false, 40),
  ('Kids Mini Corn Dogs',      'Kids',   575, true, false, 41),
  ('Kids Grilled Cheese',      'Kids',   525, true, false, 42);

-- SAMPLE: the printed menu has no drinks. Placeholders for the demo.
insert into public.menu_items (name, category, price_cents, is_food, is_alcohol, sort_order, is_sample) values
  ('Bottled water',            'Drinks', 150, false, false, 50, true),
  ('Soda (can)',               'Drinks', 175, false, false, 51, true),
  ('Gatorade',                 'Drinks', 300, false, false, 52, true),
  ('Domestic beer (can)',      'Drinks', 400, false, true,  53, true),
  ('Seltzer (can)',            'Drinks', 500, false, true,  54, true);

-- SAMPLE: the club doesn't publish membership prices.
insert into public.membership_tiers (name, price_cents, notes, sort_order, is_sample) values
  ('Family',     60000, 'Golf, pool and clubhouse for your household', 10, true),
  ('Single',     40000, 'Golf, pool and clubhouse for one adult', 20, true),
  ('Under 30',   25000, 'Special rate for members under 30', 30, true),
  ('New member', 30000, 'Not a member in the last 5 years', 40, true);
