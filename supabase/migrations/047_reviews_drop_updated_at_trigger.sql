-- 047_reviews_drop_updated_at_trigger.sql
--
-- The reviews table doesn't have an updated_at column (it tracks state via
-- submitted_at / moderated_at / published_at), so the trigger created in
-- 046 that ran update_updated_at() on every UPDATE crashes with:
--   record "new" has no field "updated_at"
--
-- This migration drops it. 046 has also been corrected for fresh installs;
-- this 047 fixes any DB that already applied 046.

drop trigger if exists reviews_set_published on reviews;
