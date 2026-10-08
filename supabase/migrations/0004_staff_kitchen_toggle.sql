-- Staff tablet kitchen toggle (Phase 2, task 8).
--
-- Settings are admin-only (0001), but every staff member needs to flip the
-- kitchen between open / drinks only / closed during service. Allow staff
-- to update that one row and nothing else.

create policy "staff update kitchen status" on public.settings
  for update
  using (public.is_staff() and key = 'kitchen_status')
  with check (public.is_staff() and key = 'kitchen_status');
