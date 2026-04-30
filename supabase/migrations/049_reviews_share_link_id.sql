-- 049_reviews_share_link_id.sql
--
-- Adds a direct FK from reviews to review_share_links so the moderation
-- queue can filter reviews by their originating share link without
-- joining through the audit log.
--
-- Phase 2 spec section 7.2 lists "View submissions" as a per-row action
-- on the Share links tab. That feature needs this column to query
-- efficiently.

alter table reviews
  add column if not exists share_link_id uuid
    references review_share_links on delete set null;

create index if not exists reviews_share_link_id_idx
  on reviews (share_link_id)
  where share_link_id is not null;
