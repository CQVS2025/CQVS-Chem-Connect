-- Migration 053: snapshot the supplier freight quote on the order at quote time.
--
-- Per supplier contract, the matrix-calculated freight is locked when the
-- buyer pays. Mid-flight matrix updates by the supplier do not retroactively
-- change in-flight orders, and the supplier is paid exactly the snapshotted
-- amount. The snapshot stores the per-line breakdown (rate sheet id, bracket
-- bounds, rate, distance, units, freight) so disputes have an audit trail.
--
-- The dollar amount itself remains in orders.shipping; this column is the
-- audit artifact.

alter table orders
  add column if not exists freight_quote_snapshot jsonb;

comment on column orders.freight_quote_snapshot is
  'Snapshot of the supplier-managed freight quote at order-creation time. Includes per-line breakdown, rate sheet ids, bracket bounds, rate, distance, units, and freight. Locked at quote — never updated post-creation.';
