-- Campaigns module: schema hardening.
--
-- The `campaigns` and `campaign_posts` tables themselves are created in
-- 20260731150000_init.sql, together with RLS and the staff policies. This migration adds
-- no new tables (so no new policies are needed) — it adds the invariants and
-- indexes the campaigns module depends on, so a bug in the app layer cannot
-- leave the data in a state the UI cannot explain.

-- --------------------------------------------------------------------------
-- campaign_posts invariants
-- --------------------------------------------------------------------------

-- A failed publish must say why it failed. Without this, a post can sit in the
-- UI as "Failed" with nothing to act on, which is indistinguishable from a bug.
alter table public.campaign_posts
  add constraint campaign_posts_failed_needs_reason
  check (status <> 'failed' or failure_reason is not null);

-- Instagram carousels cap at 10 images and the other platforms are stricter, so
-- 10 is the safe ceiling for every platform we publish to. The publish action
-- enforces this too; the constraint is what makes it true.
alter table public.campaign_posts
  add constraint campaign_posts_asset_limit
  check (cardinality(asset_ids) <= 10);

-- Instagram's caption limit is 2200 characters and is the tightest of the four.
-- Rejecting an over-long caption at write time beats a publish failing later.
alter table public.campaign_posts
  add constraint campaign_posts_caption_length
  check (length(caption) <= 2200);

-- --------------------------------------------------------------------------
-- read paths
-- --------------------------------------------------------------------------

-- The campaign detail view reads every post for one campaign in insertion
-- order; 0001's index covers only (campaign_id).
create index if not exists campaign_posts_campaign_created_idx
  on public.campaign_posts (campaign_id, created_at);

-- "Publish all approved" and the per-campaign post counters filter on status.
create index if not exists campaign_posts_status_idx
  on public.campaign_posts (status);

-- The campaigns index lists newest first.
create index if not exists campaigns_created_at_idx
  on public.campaigns (created_at desc);
