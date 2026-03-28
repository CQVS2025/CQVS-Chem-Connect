-- Add company_logo_url column to profiles
alter table profiles add column if not exists company_logo_url text;

-- Create storage bucket for company logos
insert into storage.buckets (id, name, public, file_size_limit)
values ('company-logos', 'company-logos', true, 2097152)
on conflict (id) do nothing;

-- Anyone can view company logos (public bucket)
create policy "Company logos are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'company-logos');

-- Authenticated users can upload their own logo
create policy "Users can upload company logos"
  on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and auth.uid() is not null
  );

-- Users can update their own logo
create policy "Users can update company logos"
  on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and auth.uid() is not null
  );

-- Users can delete their own logo
create policy "Users can delete company logos"
  on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and auth.uid() is not null
  );
