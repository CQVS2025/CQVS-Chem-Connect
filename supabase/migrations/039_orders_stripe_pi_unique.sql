-- ============================================
-- orders.stripe_payment_intent_id uniqueness
-- ============================================
-- Prevents the finalize race - the client-side POST /api/orders/finalize
-- and the payment_intent.succeeded webhook can both observe an empty
-- orders table for the same PI, then both insert, producing duplicate
-- orders (seen in local testing Apr 2026 - ORD-000082/083 for one PI).
--
-- With this partial unique index the loser's INSERT fails with 23505
-- and `finalizeStripeOrder` in lib/orders/finalize.ts catches it and
-- returns the winner's order row. Side effects only run once.
--
-- Partial: PO orders have null here and must stay permitted; only card
-- orders carry a non-null PaymentIntent id.
--
-- Order of operations inside the migration:
--   1. Collapse any existing duplicates (keep the earliest created).
--   2. Drop their order_items explicitly (FK is on-delete-cascade but we
--      still list it for clarity and to keep the intent auditable).
--   3. Create the unique index.

-- Step 1: identify duplicates.
create temporary table _orders_pi_losers as
with ranked as (
  select id,
         row_number() over (
           partition by stripe_payment_intent_id
           order by created_at asc, id asc
         ) as rn
  from public.orders
  where stripe_payment_intent_id is not null
)
select id from ranked where rn > 1;

-- Step 2: delete duplicate rows. Items cascade via the existing FK.
delete from public.orders
where id in (select id from _orders_pi_losers);

drop table _orders_pi_losers;

-- Step 3: enforce uniqueness going forward.
create unique index if not exists uq_orders_stripe_payment_intent_id
  on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
