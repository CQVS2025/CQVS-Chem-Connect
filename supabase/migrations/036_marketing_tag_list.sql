-- ============================================
-- list_marketing_contact_tags
-- ============================================
-- Returns every distinct tag applied to non-deleted contacts, with the
-- number of contacts carrying each tag. Used by the campaign-builder
-- UI to suggest tags instead of asking users to free-type from memory.
--
-- Uses the existing GIN index on marketing_contacts.tags (migration 032).
-- At current scale (<200 contacts) this is sub-millisecond; remains
-- cheap into the tens-of-thousands.

create or replace function list_marketing_contact_tags()
returns table(tag text, count bigint)
language sql
security definer
stable
as $$
  select unnest(tags) as tag, count(*)::bigint
  from public.marketing_contacts
  where deleted_at is null
    and cardinality(tags) > 0
  group by 1
  order by 2 desc, 1 asc;
$$;

grant execute on function list_marketing_contact_tags() to authenticated, service_role;
