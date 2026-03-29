-- Product documents table (SDS sheets, safety docs, etc.)
create table product_documents (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size integer not null default 0,
  file_type text not null default '',
  doc_type text not null default 'sds',
  created_at timestamptz not null default now()
);

create index product_documents_product_id_idx on product_documents (product_id);

-- RLS
alter table product_documents enable row level security;

-- Authenticated users can view product documents (download requires login)
create policy "Authenticated users can view product documents"
  on product_documents for select
  using (auth.uid() is not null);

-- Admins can manage product documents
create policy "Admins can insert product documents"
  on product_documents for insert
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can delete product documents"
  on product_documents for delete
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Storage bucket for product documents (private - requires auth to download)
insert into storage.buckets (id, name, public, file_size_limit)
values ('product-documents', 'product-documents', false, 10485760)
on conflict (id) do nothing;

-- Authenticated users can view/download product documents
create policy "Auth users can view product documents"
  on storage.objects for select
  using (bucket_id = 'product-documents' and auth.uid() is not null);

-- Admins can upload product documents
create policy "Admins can upload product documents"
  on storage.objects for insert
  with check (bucket_id = 'product-documents' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Admins can delete product documents
create policy "Admins can delete product documents"
  on storage.objects for delete
  using (bucket_id = 'product-documents' and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
