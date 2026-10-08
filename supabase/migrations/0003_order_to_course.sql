-- Order to the Course (Phase 2, task 7).
--
-- Orders are saved as 'pending' before the card is charged, then become
-- 'new' once paid (what the kitchen sees) or 'cancelled' if the charge
-- fails, the same pattern as Pay to Play rounds.

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('pending', 'new', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')
);
alter table public.orders alter column status set default 'pending';

-- Staff need to see "21+, check ID" at a glance without opening the items.
alter table public.orders add column has_alcohol boolean not null default false;

create index orders_created_at_idx on public.orders (created_at);

-- Demo switch: let orders through outside clubhouse hours (for showing the
-- system off at a pitch held when the clubhouse is closed). Off by default.
insert into public.settings (key, value) values ('ignore_hours_for_demo', 'false');
