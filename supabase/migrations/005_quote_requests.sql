-- Quote Requests table
-- Stores customer requests for bulk/custom pricing

create type quote_status as enum ('pending', 'reviewed', 'responded', 'closed');

create table quote_requests (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users on delete cascade,
  product_id uuid references products on delete set null,
  product_name text not null,
  quantity integer not null default 1,
  packaging_size text,
  delivery_location text,
  message text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_name text,
  status quote_status not null default 'pending',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger quote_requests_updated_at
  before update on quote_requests
  for each row execute procedure update_updated_at();

create index quote_requests_user_id_idx on quote_requests (user_id);
create index quote_requests_status_idx on quote_requests (status);
create index quote_requests_created_at_idx on quote_requests (created_at desc);

-- RLS
alter table quote_requests enable row level security;

create policy "Users can view own quotes"
  on quote_requests for select
  using (auth.uid() = user_id);

create policy "Users can create quotes"
  on quote_requests for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all quotes"
  on quote_requests for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can update all quotes"
  on quote_requests for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
