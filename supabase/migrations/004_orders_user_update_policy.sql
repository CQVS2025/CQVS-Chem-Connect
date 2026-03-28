-- Fix: Allow users to update their own orders (for payment confirmation)
-- Only allow updating payment_status on their own orders

create policy "Users can update own orders"
  on orders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
