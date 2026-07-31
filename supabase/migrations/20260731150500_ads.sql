-- Ads module.
--
-- 20260731150000_init.sql already models `ads` and `ad_metrics`, including the three
-- constraints this module leans on and must not duplicate:
--
--   * ad_metrics_unique_day (ad_id, day)  — the ON CONFLICT target that makes
--     "Sync performance" idempotent. Re-syncing an overlapping window updates
--     the existing day rows instead of inserting duplicates.
--   * ad_metrics_clicks_within_impressions — clicks <= impressions. The sync
--     path clamps adapter output before writing so a misbehaving adapter
--     produces a corrected row rather than a failed transaction.
--   * ads_active_is_complete — no 'active'/'review' ad without a headline,
--     primary text, and a non-zero daily budget. The status action checks the
--     same three things first so the user gets a sentence, not a 23514.
--
-- No new tables here, so no new RLS policies are needed: `ads` and
-- `ad_metrics` already have RLS enabled with the `*_staff_all` policies from
-- 0001. Everything below is an index supporting a read or write path that the
-- module actually has.

-- /ads filters by platform alongside status (status is already indexed).
create index if not exists ads_platform_idx on public.ads (platform);

-- Launching records the adapter's external id. One Lensello ad maps to exactly
-- one platform ad: a second row claiming the same external id would silently
-- double-count every metric the sync pulls for it. Partial, so the many
-- not-yet-launched drafts do not all collide on NULL.
create unique index if not exists ads_external_id_key
  on public.ads (external_id)
  where external_id is not null;

-- The per-ad daily series on /ads/[adId] reads newest-first. The unique
-- constraint's index is ascending on the same columns and would be scanned
-- backwards; this matches the read order directly.
create index if not exists ad_metrics_ad_day_idx
  on public.ad_metrics (ad_id, day desc);
