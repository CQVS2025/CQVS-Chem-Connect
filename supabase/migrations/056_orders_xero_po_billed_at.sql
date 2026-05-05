-- Migration 056: track when admin has finished the Xero PO → Bill step.
--
-- The reconciliation view highlights rows where an approved variance claim
-- requires admin to bump the freight line on the Xero Bill. Without a
-- "completed" marker the highlight would persist forever. This column is
-- stamped when admin clicks "Mark as billed in Xero" on the reconciliation
-- row, after they have actually done the Bill adjustment in Xero.

alter table orders
  add column if not exists xero_po_billed_at timestamptz;

comment on column orders.xero_po_billed_at is
  'Stamped when admin confirms the Xero PO has been converted to a Bill (with any approved-claim freight adjustment applied) in Xero. Drives the reconciliation view''s pending/done filter.';
