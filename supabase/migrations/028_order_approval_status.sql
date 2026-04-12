-- Migration 028: Add pending_approval and rejected to order_status enum
--
-- PO orders now start as "pending_approval" and require admin approval
-- before Xero invoices/POs are created and sent to customer/warehouse.

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'rejected';
