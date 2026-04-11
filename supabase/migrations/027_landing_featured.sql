-- Migration 027: Landing page featured product slots
--
-- Lets admins control which products appear in the two landing-page
-- showcase sections:
--   - "hero"     : price ticker on the hero (3 slots)
--   - "featured" : Live Pricing — No Login card grid (6 slots)
--
-- One row per slot. (section, position) is unique so each slot has at
-- most one product. Deleting a product cascades the slot row out of the
-- table so we never dangle a broken reference on the landing page.

create table if not exists landing_featured (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('hero', 'featured')),
  position integer not null check (position >= 1),
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, position)
);

create index if not exists landing_featured_section_idx
  on landing_featured (section, position);

alter table landing_featured enable row level security;

-- Public read: the landing page is anonymous, so anyone can read the
-- current selections. Only admins can mutate.
drop policy if exists "landing_featured_select" on landing_featured;
create policy "landing_featured_select"
  on landing_featured for select
  using (true);

drop policy if exists "landing_featured_admin_write" on landing_featured;
create policy "landing_featured_admin_write"
  on landing_featured for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
