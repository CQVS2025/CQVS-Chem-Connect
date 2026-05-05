-- Migration 054: supplier write policies for rate sheets + brackets.
--
-- Per supplier contract, each supplier maintains their own freight matrix
-- (distance bands, bulk/pack rates). RLS allows suppliers with
-- can_update_orders = true to CRUD rate sheets and brackets scoped to
-- their own warehouses. Admins keep their existing manage-everything
-- policy from migration 051.
--
-- Note: out of caution we let suppliers update is_active and notes too —
-- the rate sheet is theirs to operate. We keep warehouse_id immutable by
-- relying on a check in the API layer.

create policy "Suppliers insert own rate sheets"
  on supplier_rate_sheets for insert
  with check (
    exists (
      select 1
      from warehouse_users wu
      where wu.warehouse_id = supplier_rate_sheets.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers update own rate sheets"
  on supplier_rate_sheets for update
  using (
    exists (
      select 1
      from warehouse_users wu
      where wu.warehouse_id = supplier_rate_sheets.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  )
  with check (
    exists (
      select 1
      from warehouse_users wu
      where wu.warehouse_id = supplier_rate_sheets.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers delete own rate sheets"
  on supplier_rate_sheets for delete
  using (
    exists (
      select 1
      from warehouse_users wu
      where wu.warehouse_id = supplier_rate_sheets.warehouse_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers read own rate sheets"
  on supplier_rate_sheets for select
  using (
    is_active = true
    or exists (
      select 1
      from warehouse_users wu
      where wu.warehouse_id = supplier_rate_sheets.warehouse_id
        and wu.user_id = auth.uid()
    )
  );

-- Brackets: same scope, joined via the parent rate sheet.
create policy "Suppliers insert own rate brackets"
  on supplier_rate_sheet_brackets for insert
  with check (
    exists (
      select 1
      from supplier_rate_sheets s
      join warehouse_users wu on wu.warehouse_id = s.warehouse_id
      where s.id = supplier_rate_sheet_brackets.rate_sheet_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers update own rate brackets"
  on supplier_rate_sheet_brackets for update
  using (
    exists (
      select 1
      from supplier_rate_sheets s
      join warehouse_users wu on wu.warehouse_id = s.warehouse_id
      where s.id = supplier_rate_sheet_brackets.rate_sheet_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  )
  with check (
    exists (
      select 1
      from supplier_rate_sheets s
      join warehouse_users wu on wu.warehouse_id = s.warehouse_id
      where s.id = supplier_rate_sheet_brackets.rate_sheet_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers delete own rate brackets"
  on supplier_rate_sheet_brackets for delete
  using (
    exists (
      select 1
      from supplier_rate_sheets s
      join warehouse_users wu on wu.warehouse_id = s.warehouse_id
      where s.id = supplier_rate_sheet_brackets.rate_sheet_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );
