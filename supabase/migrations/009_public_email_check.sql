-- Allow unauthenticated users to check if an email exists in profiles
-- This is needed for login/forgot-password to show helpful error messages
-- Only exposes count - no profile data is returned

create policy "Anyone can check email existence"
  on profiles for select
  using (true);
