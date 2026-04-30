-- 048_review_share_links.sql
--
-- Phase 2 addition: public review share links.
--
-- Adds:
--   * 'public_link' value to the existing review_source enum
--   * reviews.verified_buyer column (drives the badge + the verified-only
--     aggregate math used for the headline rating + JSON-LD)
--   * review_share_links table (one row per generated public link)
--   * review_share_submission_attempts table (per-IP rate-limit tracking)
--   * RLS policies for both new tables
--
-- Phase 1 reviews are all magic_link or manual, both verified, so the
-- backfill is straightforward.

-- ============================================================================
-- 1. Extend the source enum
-- ============================================================================
alter type review_source add value if not exists 'public_link';

-- ============================================================================
-- 2. verified_buyer column on reviews
-- ============================================================================
alter table reviews
  add column if not exists verified_buyer boolean not null default false;

-- Backfill existing rows. Both magic_link and manual entries are verified.
update reviews
   set verified_buyer = true
 where source in ('magic_link', 'manual')
   and verified_buyer = false;

-- Index for the verified-only aggregate query (very common path).
create index if not exists reviews_product_status_verified_idx
  on reviews (product_id, status, verified_buyer);

-- ============================================================================
-- 3. review_share_links table
-- ============================================================================
create table if not exists review_share_links (
  id uuid not null default uuid_generate_v4() primary key,
  slug text not null unique,
  product_id uuid not null references products on delete cascade,
  created_by uuid references auth.users,
  expires_at timestamptz,                    -- nullable: null = no expiry
  max_uses integer,                          -- nullable: null = unlimited
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists review_share_links_active_slug_idx
  on review_share_links (slug)
  where is_active = true;

create index if not exists review_share_links_product_id_idx
  on review_share_links (product_id);

create index if not exists review_share_links_created_at_idx
  on review_share_links (created_at desc);

-- ============================================================================
-- 4. review_share_submission_attempts (per-IP rate-limit tracking)
-- ============================================================================
create table if not exists review_share_submission_attempts (
  id uuid not null default uuid_generate_v4() primary key,
  ip_hash text not null,                     -- sha256 of IP, never raw
  share_link_id uuid references review_share_links on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists review_share_submission_attempts_ip_idx
  on review_share_submission_attempts (ip_hash, created_at desc);

-- ============================================================================
-- 5. RLS
-- ============================================================================

alter table review_share_links enable row level security;
alter table review_share_submission_attempts enable row level security;

drop policy if exists "Admins can view share links" on review_share_links;
create policy "Admins can view share links"
  on review_share_links for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage share links" on review_share_links;
create policy "Admins can manage share links"
  on review_share_links for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- review_share_submission_attempts is service-role-only.
-- No policies exposed to anon / authenticated; the service role bypasses RLS
-- entirely from the public submit endpoint.
