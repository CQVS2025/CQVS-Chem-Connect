-- Allow admins to delete orders and quotes

create policy "Admins can delete orders"
  on orders for delete
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Admins can delete quotes"
  on quote_requests for delete
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
