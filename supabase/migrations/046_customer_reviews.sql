-- 046_customer_reviews.sql
--
-- Customer Reviews feature — full schema landing in one migration.
--
-- Adds:
--   * products.reviews_enabled        — per-product opt-out flag
--   * review_tokens                    — magic-link tokens for the public submit flow
--   * reviews                          — review records (pending / approved / rejected)
--   * review_photos                    — up to 3 images per review
--   * review_audit_log                 — immutable moderation + Privacy-Act-deletion trail
--   * review_jobs                      — queued post-delivery review-request emails
--   * trigger to schedule a review_job when an order transitions to 'delivered'
--   * RPC `due_review_jobs()`         — daily cron picks up rows where send_at <= now()
--   * RLS policies + the review-photos storage bucket
--
-- Re-runnable via IF NOT EXISTS where Postgres allows.

-- ============================================================================
-- 1. products.reviews_enabled
-- ============================================================================
alter table products
  add column if not exists reviews_enabled boolean not null default true;

-- ============================================================================
-- 2. review_tokens
-- ============================================================================
create table if not exists review_tokens (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  product_id uuid not null references products on delete cascade,
  token_hash text not null unique,            -- sha256 of the signed token; never store the raw value
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,            -- issued_at + 60 days
  consumed_at timestamptz,                    -- set when a review is submitted against this token
  attempt_count integer not null default 0,   -- rate-limit counter
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_tokens_order_id_idx     on review_tokens (order_id);
create index if not exists review_tokens_product_id_idx   on review_tokens (product_id);
create index if not exists review_tokens_expires_at_idx   on review_tokens (expires_at);
create index if not exists review_tokens_consumed_at_idx  on review_tokens (consumed_at);

-- One token per (order, product) — re-issuing replaces the prior row (handled in app code).
create unique index if not exists review_tokens_order_product_uniq
  on review_tokens (order_id, product_id);

-- ============================================================================
-- 3. reviews
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type review_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_source') then
    create type review_source as enum ('magic_link', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_rejection_reason') then
    create type review_rejection_reason as enum (
      'pii', 'libel', 'off_topic', 'suspected_fake', 'profanity', 'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'review_name_format') then
    create type review_name_format as enum (
      'first_initial',     -- "Marcus T."
      'initials',          -- "M. T."
      'anonymous_city',    -- "Anonymous from Brisbane"
      'role_state'         -- "Plant Manager, NSW concrete plant"
    );
  end if;
end $$;

create table if not exists reviews (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  order_id uuid references orders on delete set null,
  token_id uuid references review_tokens on delete set null,

  source review_source not null,
  name_format review_name_format not null default 'first_initial',
  display_name text not null,
  reviewer_city text,
  reviewer_state text,
  reviewer_role text,                       -- only set when name_format = 'role_state'

  rating smallint not null check (rating between 1 and 5),
  headline text not null,
  body text not null,
  consent_given boolean not null,

  status review_status not null default 'pending',
  rejection_reason review_rejection_reason,
  rejection_notes text,                     -- required when rejection_reason = 'other'

  submitted_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users,
  published_at timestamptz                  -- set on approve; cleared on un-approve / delete
);

create index if not exists reviews_product_id_idx     on reviews (product_id);
create index if not exists reviews_status_idx         on reviews (status);
create index if not exists reviews_published_at_idx   on reviews (published_at desc);
create index if not exists reviews_product_status_idx on reviews (product_id, status);

-- (No updated_at trigger on reviews — the table tracks state via
--  submitted_at, moderated_at, and published_at instead. An earlier
--  draft attached the shared update_updated_at() trigger here, which
--  fails because the table has no updated_at column.)

-- ============================================================================
-- 4. review_photos
-- ============================================================================
create table if not exists review_photos (
  id uuid not null default uuid_generate_v4() primary key,
  review_id uuid not null references reviews on delete cascade,
  storage_path text not null,                -- 'reviews/<review_id>/<uuid>.jpg'
  public_url text not null,
  position smallint not null check (position between 1 and 3),
  created_at timestamptz not null default now(),
  unique (review_id, position)
);

create index if not exists review_photos_review_id_idx on review_photos (review_id);

-- ============================================================================
-- 5. review_audit_log — immutable moderation + Privacy-Act trail
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_audit_action') then
    create type review_audit_action as enum (
      'submitted',
      'approved',
      'rejected',
      'hard_deleted',
      'manually_entered'
    );
  end if;
end $$;

create table if not exists review_audit_log (
  id uuid not null default uuid_generate_v4() primary key,
  review_id uuid,                            -- nullable so hard_deleted entries survive review row deletion
  product_id uuid,
  action review_audit_action not null,
  actor_id uuid references auth.users,
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists review_audit_log_review_id_idx on review_audit_log (review_id);
create index if not exists review_audit_log_action_idx    on review_audit_log (action);
create index if not exists review_audit_log_created_at_idx on review_audit_log (created_at desc);

-- ============================================================================
-- 6. review_jobs — the scheduled email queue
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_job_kind') then
    create type review_job_kind as enum ('initial', 'reminder');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_job_status') then
    create type review_job_status as enum ('pending', 'sent', 'skipped', 'failed');
  end if;
end $$;

create table if not exists review_jobs (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  product_id uuid not null references products on delete cascade,
  kind review_job_kind not null,
  send_at timestamptz not null,              -- delivered_at + 7d (initial) / + 14d (reminder)
  status review_job_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_jobs_send_at_status_idx on review_jobs (send_at, status);
create index if not exists review_jobs_order_id_idx       on review_jobs (order_id);

-- One pending job per (order, product, kind) — replaces if status flipped to anything else.
create unique index if not exists review_jobs_order_product_kind_pending_uniq
  on review_jobs (order_id, product_id, kind)
  where status = 'pending';

-- ============================================================================
-- 7. RPC: due_review_jobs() — cron picks up due rows
-- ============================================================================
create or replace function due_review_jobs()
returns setof review_jobs
language sql
security definer
set search_path = public
as $$
  select *
    from review_jobs
   where status = 'pending'
     and send_at <= now()
   order by send_at asc
   limit 100;
$$;

grant execute on function due_review_jobs() to service_role;

-- ============================================================================
-- 8. Trigger: queue a review_job when an order transitions to 'delivered'
-- ============================================================================
create or replace function queue_review_jobs_for_delivery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delivered_at timestamptz := new.created_at;
  rec record;
begin
  -- Only react to transitions INTO 'delivered'
  if new.status <> 'delivered' then
    return new;
  end if;

  -- For each order line whose product has reviews_enabled = true, queue
  -- an initial (+7d) and reminder (+14d) job. The unique-pending index
  -- prevents duplicates if the same delivered status is logged twice.
  for rec in
    select oi.product_id
      from order_items oi
      join products p on p.id = oi.product_id
     where oi.order_id = new.order_id
       and p.reviews_enabled = true
     group by oi.product_id
  loop
    insert into review_jobs (order_id, product_id, kind, send_at)
    values (new.order_id, rec.product_id, 'initial', delivered_at + interval '7 days')
    on conflict (order_id, product_id, kind) where status = 'pending' do nothing;

    insert into review_jobs (order_id, product_id, kind, send_at)
    values (new.order_id, rec.product_id, 'reminder', delivered_at + interval '14 days')
    on conflict (order_id, product_id, kind) where status = 'pending' do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists order_delivered_queue_review_jobs on order_status_history;
create trigger order_delivered_queue_review_jobs
  after insert on order_status_history
  for each row execute procedure queue_review_jobs_for_delivery();

-- ============================================================================
-- 9. RPC: helpers used by the product page (server-only via service role)
-- ============================================================================

-- Approved-review aggregate per product. Returns 0 / null when no approved
-- reviews exist (caller decides whether to gate at >=3).
create or replace function product_review_aggregate(p_product_id uuid)
returns table (review_count integer, average_rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::integer as review_count,
    coalesce(round(avg(rating)::numeric, 1), 0)::numeric as average_rating
  from reviews
  where product_id = p_product_id
    and status = 'approved';
$$;

grant execute on function product_review_aggregate(uuid) to anon, authenticated, service_role;

-- ============================================================================
-- 10. RLS policies
-- ============================================================================

alter table review_tokens enable row level security;
alter table reviews enable row level security;
alter table review_photos enable row level security;
alter table review_audit_log enable row level security;
alter table review_jobs enable row level security;

-- review_tokens: service-role-only. Public submit page validates via
-- service-role API route; never exposed directly to anon / authenticated.

create policy "review_tokens service role only"
  on review_tokens for all
  using ((auth.jwt() ->> 'role') = 'service_role')
  with check ((auth.jwt() ->> 'role') = 'service_role');

-- reviews: anon and authenticated can SELECT only approved rows.
-- Writes (insert / update / delete) only via service-role API routes.

create policy "Approved reviews are public"
  on reviews for select
  using (status = 'approved');

create policy "Admins can view all reviews"
  on reviews for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can update reviews"
  on reviews for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can delete reviews"
  on reviews for delete
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- review_photos: photos for approved reviews are public; otherwise admin-only.

create policy "Photos for approved reviews are public"
  on review_photos for select
  using (
    exists (
      select 1 from reviews
       where reviews.id = review_photos.review_id
         and reviews.status = 'approved'
    )
  );

create policy "Admins can view all review photos"
  on review_photos for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can manage review photos"
  on review_photos for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- review_audit_log: admin-read-only. Inserts via service-role only.

create policy "Admins can view audit log"
  on review_audit_log for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- review_jobs: admin-read-only (debugging). Writes via service-role only.

create policy "Admins can view review jobs"
  on review_jobs for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================================================
-- 11. Storage bucket: review-photos
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do update set public = excluded.public;

-- Public read on photos. Writes go through a service-role API route
-- (app/api/reviews/upload), so we don't grant anon write directly.
-- Drop-then-create pattern keeps the migration re-runnable without
-- relying on `IF NOT EXISTS` (Supabase's parser rejects that on policies).
drop policy if exists "Public read review photos" on storage.objects;
create policy "Public read review photos"
  on storage.objects for select
  using (bucket_id = 'review-photos');

drop policy if exists "Service role can manage review photos" on storage.objects;
create policy "Service role can manage review photos"
  on storage.objects for all
  using (bucket_id = 'review-photos' and (auth.jwt() ->> 'role') = 'service_role')
  with check (bucket_id = 'review-photos' and (auth.jwt() ->> 'role') = 'service_role');
