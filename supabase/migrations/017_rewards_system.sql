-- ============================================
-- Milestone 3: Rewards & Loyalty System
-- ============================================

-- 1. Reward Tiers (Bronze, Silver, Gold)
create table reward_tiers (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null unique,
  display_name text not null,
  min_monthly_spend numeric(10,2) not null,
  reward_description text not null default '',
  reward_detail text not null default '',
  estimated_monthly_savings numeric(10,2) default 0,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reward_tiers_updated_at
  before update on reward_tiers
  for each row execute procedure update_updated_at();

-- Seed default tiers
insert into reward_tiers (name, display_name, min_monthly_spend, reward_description, reward_detail, estimated_monthly_savings, sort_order) values
  ('bronze', 'Bronze', 2000, 'Free 200L drum of Truck Wash Standard every month', 'Unlock recurring free product starting at just $2,000/mo', 350, 1),
  ('silver', 'Silver', 5000, 'Free IBC (1,000L) of your most-used product every month', 'Your high-volume commitment earns premium monthly rewards', 1200, 2),
  ('gold', 'Gold', 10000, 'Free freight on ALL orders + free product every quarter', 'Maximum rewards tier with freight and product benefits', 2500, 3);

-- 2. Customer Rewards Tracking
create table customer_rewards (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  current_tier text default 'none',
  current_month_spend numeric(10,2) default 0,
  annual_spend numeric(10,2) default 0,
  total_stamps integer default 0,
  stamps_redeemed integer default 0,
  referral_count integer default 0,
  first_order_incentive_used boolean default false,
  first_order_incentive_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_rewards_updated_at
  before update on customer_rewards
  for each row execute procedure update_updated_at();

create index customer_rewards_user_id_idx on customer_rewards (user_id);
create index customer_rewards_tier_idx on customer_rewards (current_tier);

-- Auto-create customer_rewards row when profile is created
create or replace function handle_new_customer_rewards()
returns trigger as $$
begin
  if new.role = 'customer' then
    insert into public.customer_rewards (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created_rewards
  after insert on profiles
  for each row execute procedure handle_new_customer_rewards();

-- 3. Referrals
create table referrals (
  id uuid not null default uuid_generate_v4() primary key,
  referrer_id uuid references auth.users on delete set null,
  referrer_name text not null,
  referred_site_name text not null,
  referred_contact_name text not null,
  referred_email text,
  referred_phone text not null,
  status text not null default 'pending',
  reward_given boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger referrals_updated_at
  before update on referrals
  for each row execute procedure update_updated_at();

create index referrals_referrer_id_idx on referrals (referrer_id);
create index referrals_status_idx on referrals (status);

-- 4. Product Bundles
create table product_bundles (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  description text,
  discount_percent numeric(5,2) not null default 10,
  min_products integer default 3,
  badge_text text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger product_bundles_updated_at
  before update on product_bundles
  for each row execute procedure update_updated_at();

-- Bundle to product mapping
create table bundle_products (
  id uuid not null default uuid_generate_v4() primary key,
  bundle_id uuid references product_bundles on delete cascade not null,
  product_id uuid references products on delete cascade not null,
  created_at timestamptz not null default now(),
  unique(bundle_id, product_id)
);

-- Seed default bundles
insert into product_bundles (name, description, discount_percent, min_products, badge_text, sort_order) values
  ('The Essentials', 'Core cleaning products for daily operations', 10, 3, '10% OFF', 1),
  ('The Premium', 'High-performance products for demanding jobs', 10, 3, '10% OFF', 2),
  ('The Fleet', 'Everything your fleet needs to stay clean', 10, 3, '10% OFF', 3),
  ('The Full Site', 'Complete site coverage with maximum savings', 15, 5, '15% OFF', 4);

-- 5. Promotions
create table promotions (
  id uuid not null default uuid_generate_v4() primary key,
  name text not null,
  headline text,
  description text,
  type text not null default 'seasonal',
  season text,
  discount_type text not null default 'percentage',
  discount_value numeric(10,2) default 0,
  promotion_type_detail text,
  min_order_value numeric(10,2) default 0,
  eligible_product_ids uuid[] default '{}',
  display_style text default 'card',
  fine_print text,
  buy_quantity integer default 0,
  start_date date,
  end_date date,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger promotions_updated_at
  before update on promotions
  for each row execute procedure update_updated_at();

-- Seed seasonal promotions
insert into promotions (name, description, type, season, discount_type, discount_value, min_order_value, start_date, end_date) values
  ('Summer Wash Deal', 'Buy 3 IBCs of Truck Wash, get the 4th at half price', 'seasonal', 'summer', 'percentage', 50, 0, '2026-11-01', '2027-01-31'),
  ('Winter Freight Free', 'Free freight on all orders over $1,000', 'seasonal', 'winter', 'free_freight', 0, 1000, '2026-06-01', '2026-08-31'),
  ('EOFY Bonus Credit', '15% bonus credit on orders over $5,000', 'seasonal', 'eofy', 'bonus_credit', 15, 5000, '2026-06-01', '2026-06-30');

-- 7. Rebate Tiers
create table rebate_tiers (
  id uuid not null default uuid_generate_v4() primary key,
  min_annual_spend numeric(10,2) not null,
  max_annual_spend numeric(10,2),
  rebate_percent numeric(5,2) not null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- Seed rebate tiers
insert into rebate_tiers (min_annual_spend, max_annual_spend, rebate_percent, sort_order) values
  (25000, 49999.99, 5, 1),
  (50000, 99999.99, 7.5, 2),
  (100000, null, 10, 3);

-- 8. Early Access Signups
create table early_access_signups (
  id uuid not null default uuid_generate_v4() primary key,
  email text not null,
  user_id uuid references auth.users on delete set null,
  product_slug text,
  created_at timestamptz not null default now(),
  unique(email, product_slug)
);

-- 9. Stamp Card Records
create table stamp_records (
  id uuid not null default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  order_id uuid references orders on delete set null,
  stamps_earned integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create index stamp_records_user_id_idx on stamp_records (user_id);

-- ============================================
-- Row Level Security
-- ============================================

-- Reward tiers - publicly readable
alter table reward_tiers enable row level security;
create policy "Reward tiers are viewable by everyone" on reward_tiers for select using (true);
create policy "Admins can manage reward tiers" on reward_tiers for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Customer rewards - users see own, admins see all
alter table customer_rewards enable row level security;
create policy "Users can view own rewards" on customer_rewards for select using (auth.uid() = user_id);
create policy "Users can insert own rewards" on customer_rewards for insert with check (auth.uid() = user_id);
create policy "Users can update own rewards" on customer_rewards for update using (auth.uid() = user_id);
create policy "Admins can manage all rewards" on customer_rewards for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Referrals - users see own, admins see all
alter table referrals enable row level security;
create policy "Users can view own referrals" on referrals for select using (auth.uid() = referrer_id);
create policy "Users can insert referrals" on referrals for insert with check (auth.uid() = referrer_id);
create policy "Admins can manage all referrals" on referrals for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Product bundles - publicly readable
alter table product_bundles enable row level security;
create policy "Bundles are viewable by everyone" on product_bundles for select using (true);
create policy "Admins can manage bundles" on product_bundles for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

alter table bundle_products enable row level security;
create policy "Bundle products are viewable by everyone" on bundle_products for select using (true);
create policy "Admins can manage bundle products" on bundle_products for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Promotions - publicly readable
alter table promotions enable row level security;
create policy "Promotions are viewable by everyone" on promotions for select using (true);
create policy "Admins can manage promotions" on promotions for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Rebate tiers - publicly readable
alter table rebate_tiers enable row level security;
create policy "Rebate tiers are viewable by everyone" on rebate_tiers for select using (true);
create policy "Admins can manage rebate tiers" on rebate_tiers for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Early access signups
alter table early_access_signups enable row level security;
create policy "Users can view own signups" on early_access_signups for select using (auth.uid() = user_id);
create policy "Anyone can sign up for early access" on early_access_signups for insert with check (true);
create policy "Admins can manage signups" on early_access_signups for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Stamp records
alter table stamp_records enable row level security;
create policy "Users can view own stamps" on stamp_records for select using (auth.uid() = user_id);
create policy "Admins can manage stamps" on stamp_records for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
