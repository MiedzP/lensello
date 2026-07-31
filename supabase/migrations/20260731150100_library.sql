-- Library module: read-path and tag-mutation support.
--
-- Deliberately additive and table-free: no new tables, columns, or constraints,
-- so this migration introduces no new RLS surface. `public.shoots` and
-- `public.assets` keep the `*_staff_all` policies from 20260731150000_init.sql, and every
-- function below is SECURITY INVOKER, so each statement inside it is still
-- evaluated against the caller's RLS context. Nothing here can be used to read
-- or write a row the caller could not already reach directly.

-- --------------------------------------------------------------------------
-- indexes
-- --------------------------------------------------------------------------

-- The shoot detail grid pages assets newest-first within one shoot. 0001 has
-- `assets_shoot_idx (shoot_id)`, which still needs a sort; the composite lets
-- Postgres walk the index in output order.
create index if not exists assets_shoot_created_idx
  on public.assets (shoot_id, created_at desc);

-- Same read, ordered by rating — the culling view.
create index if not exists assets_shoot_rating_idx
  on public.assets (shoot_id, rating desc, created_at desc);

-- --------------------------------------------------------------------------
-- shoots index summary
-- --------------------------------------------------------------------------

-- The shoots index needs, per shoot: how many assets, how many selects, and a
-- cover thumbnail. Doing that in SQL keeps the index page to a fixed number of
-- round trips and avoids shipping one row per photo to the app just to count
-- them.
--
-- The cover falls back to the newest asset when `cover_asset_id` is unset, so a
-- freshly uploaded shoot still shows a thumbnail.
create or replace function public.library_shoot_summaries()
returns table (
  shoot_id           uuid,
  asset_count        bigint,
  select_count       bigint,
  cover_storage_path text
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select
    s.id,
    coalesce(counts.asset_count, 0),
    coalesce(counts.select_count, 0),
    coalesce(cover.storage_path, newest.storage_path)
  from public.shoots s
  left join lateral (
    select count(*)                                  as asset_count,
           count(*) filter (where a.is_select)       as select_count
      from public.assets a
     where a.shoot_id = s.id
  ) counts on true
  left join public.assets cover
    on cover.id = s.cover_asset_id
  left join lateral (
    select a.storage_path
      from public.assets a
     where a.shoot_id = s.id
     order by a.created_at desc
     limit 1
  ) newest on true;
$$;

comment on function public.library_shoot_summaries() is
  'Per-shoot asset count, select count, and cover storage path for the library index.';

-- --------------------------------------------------------------------------
-- tag mutations
-- --------------------------------------------------------------------------

-- `assets.tags` is a text[], so adding a tag to a multi-selection would
-- otherwise be a read-modify-write per row. These do it in one statement, which
-- is both fewer round trips and atomic.
--
-- `p_shoot_id` is not redundant with `p_asset_ids`: it pins the mutation to the
-- shoot the caller is actually looking at, so a forged asset id from another
-- shoot is a no-op rather than an edit.
create or replace function public.library_add_asset_tag(
  p_shoot_id  uuid,
  p_asset_ids uuid[],
  p_tag       text
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_tag     text := btrim(p_tag);
  v_updated integer;
begin
  if v_tag = '' then
    return 0;
  end if;

  update public.assets
     set tags = tags || array[v_tag]
   where shoot_id = p_shoot_id
     and id = any (p_asset_ids)
     and not (v_tag = any (tags));

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.library_add_asset_tag(uuid, uuid[], text) is
  'Appends a tag to the given assets within one shoot, skipping rows that already have it.';

create or replace function public.library_remove_asset_tag(
  p_shoot_id  uuid,
  p_asset_ids uuid[],
  p_tag       text
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_updated integer;
begin
  update public.assets
     set tags = array_remove(tags, p_tag)
   where shoot_id = p_shoot_id
     and id = any (p_asset_ids)
     and p_tag = any (tags);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

comment on function public.library_remove_asset_tag(uuid, uuid[], text) is
  'Removes a tag from the given assets within one shoot.';

-- --------------------------------------------------------------------------
-- execute grants
-- --------------------------------------------------------------------------

-- Default EXECUTE for a new function is PUBLIC. RLS would already deny an
-- anonymous caller every row, but there is no reason for `anon` to be able to
-- call these at all.
revoke execute on function public.library_shoot_summaries() from public;
revoke execute on function public.library_add_asset_tag(uuid, uuid[], text) from public;
revoke execute on function public.library_remove_asset_tag(uuid, uuid[], text) from public;

grant execute on function public.library_shoot_summaries() to authenticated;
grant execute on function public.library_add_asset_tag(uuid, uuid[], text) to authenticated;
grant execute on function public.library_remove_asset_tag(uuid, uuid[], text) to authenticated;
