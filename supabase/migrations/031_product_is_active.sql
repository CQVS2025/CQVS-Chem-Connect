-- Migration 031: Active/inactive flag for products
--
-- Allows admin to hide products from the marketplace without deleting them.
-- Inactive products are invisible to customers on all public pages
-- (product listing, product detail, landing page, search).
-- They remain fully visible and editable in the admin dashboard.

alter table products
  add column if not exists is_active boolean not null default true;

-- All existing products default to active — no behaviour change.
