-- 0005: club settings move into the database (Phase 2 task 11).
--
-- Seeds the admin-editable settings with the current SAMPLE values from
-- src/content/settings.ts (copied from sabethagolfclub.com, 2026-10-07).
-- The app reads these through getSettings() and falls back to the code
-- defaults for any row that is missing or invalid. Admins edit them in
-- /admin (RLS: "admin write settings" from 0001).
--
-- Prices are whole dollars. Hours: index 0 = Sunday, null = closed.
-- `on conflict do nothing` so re-running never overwrites admin edits.

insert into public.settings (key, value) values
  ('green_fees', '{"weekday": {"9": 20, "18": 30}, "weekend": {"9": 25, "18": 35}}'),
  ('cart_rental', '{"9": 15, "18": 20}'),
  ('clubhouse_hours', '[
    {"open": "11:00", "close": "19:00"},
    null,
    null,
    {"open": "16:30", "close": "20:00"},
    {"open": "16:30", "close": "20:00"},
    {"open": "16:30", "close": "20:00"},
    {"open": "11:00", "close": "20:00"}
  ]'),
  ('book_ahead_days', '14'),
  ('round_minutes', '{"9": 120, "18": 240}'),
  ('pool_guest_fee', '4'),
  ('clubhouse_rental', '{"cleanupDeposit": 100, "selfCleanRefund": 50, "outsideCateringFee": 100}')
on conflict (key) do nothing;
