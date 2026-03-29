-- Product images table for multiple images per product
create table product_images (
  id uuid not null default uuid_generate_v4() primary key,
  product_id uuid not null references products on delete cascade,
  image_url text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on product_images (product_id);
create index product_images_cover_idx on product_images (product_id, is_cover);

-- RLS
alter table product_images enable row level security;

-- Anyone can view product images
create policy "Product images are viewable by everyone"
  on product_images for select
  using (true);

-- Only admins can manage product images
create policy "Admins can insert product images"
  on product_images for insert
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can update product images"
  on product_images for update
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can delete product images"
  on product_images for delete
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
