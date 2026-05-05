-- Migration 052: supplier write policies for audit log + notification state
--
-- Migration 051 enabled RLS on order_supplier_audit_log and
-- order_supplier_notification_state but only granted admins write
-- access. The supplier dispatch endpoint runs under the supplier's
-- own auth context, so its INSERT into the audit table was silently
-- rejected — the "Show dispatch audit log" panel always rendered
-- "No dispatch changes recorded yet". This migration grants suppliers
-- the writes they need, scoped to warehouses they're assigned to.

create policy "Suppliers insert own audit log"
  on order_supplier_audit_log for insert
  with check (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_audit_log.order_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers read own notification state"
  on order_supplier_notification_state for select
  using (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_notification_state.order_id
        and wu.user_id = auth.uid()
    )
  );

create policy "Suppliers write own notification state"
  on order_supplier_notification_state for insert
  with check (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_notification_state.order_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );

create policy "Suppliers update own notification state"
  on order_supplier_notification_state for update
  using (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_notification_state.order_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  )
  with check (
    exists (
      select 1
      from orders o
      join warehouse_users wu on wu.warehouse_id = o.warehouse_id
      where o.id = order_supplier_notification_state.order_id
        and wu.user_id = auth.uid()
        and wu.can_update_orders = true
    )
  );
