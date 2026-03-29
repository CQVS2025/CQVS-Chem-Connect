-- Order documents table (for PO attachments)
create table order_documents (
  id uuid not null default uuid_generate_v4() primary key,
  order_id uuid not null references orders on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer not null default 0,
  file_type text not null default '',
  created_at timestamptz not null default now()
);

create index order_documents_order_id_idx on order_documents (order_id);

-- RLS
alter table order_documents enable row level security;

-- Users can view their own order documents
create policy "Users can view own order documents"
  on order_documents for select
  using (
    exists (
      select 1 from orders where orders.id = order_documents.order_id and orders.user_id = auth.uid()
    )
  );

-- Users can upload documents to their own orders
create policy "Users can insert own order documents"
  on order_documents for insert
  with check (
    exists (
      select 1 from orders where orders.id = order_documents.order_id and orders.user_id = auth.uid()
    )
  );

-- Admins can view all order documents
create policy "Admins can view all order documents"
  on order_documents for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Storage bucket for order documents
insert into storage.buckets (id, name, public, file_size_limit)
values ('order-documents', 'order-documents', false, 10485760)
on conflict (id) do nothing;

-- Authenticated users can upload order documents
create policy "Users can upload order documents"
  on storage.objects for insert
  with check (bucket_id = 'order-documents' and auth.uid() is not null);

-- Users and admins can view order documents
create policy "Authenticated users can view order documents"
  on storage.objects for select
  using (bucket_id = 'order-documents' and auth.uid() is not null);
