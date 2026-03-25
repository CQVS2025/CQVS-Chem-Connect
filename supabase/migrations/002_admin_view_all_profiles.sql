-- Migration: Allow admins to view all profiles without infinite recursion
-- Uses auth.jwt() to check role from the JWT metadata instead of querying profiles table

-- First drop existing policy if it exists
drop policy if exists "Admins can view all profiles" on profiles;

-- Create a safe admin select policy using JWT metadata
-- This requires that the role is stored in the user's raw_user_meta_data
create policy "Admins can view all profiles"
  on profiles for select
  using (
    auth.uid() = id
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Also allow admins to update any profile (for status/role changes)
drop policy if exists "Admins can update all profiles" on profiles;

create policy "Admins can update all profiles"
  on profiles for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
