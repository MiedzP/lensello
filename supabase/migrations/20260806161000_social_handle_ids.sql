-- The platform's own id for a sender, alongside their handle.
--
-- Replying to an Instagram DM is addressed to a scoped user id, not to a
-- handle — the handle is a display name as far as the messaging API is
-- concerned. Without this column an inbound DM can be filed against a client
-- but never answered, which is the more painful half of the feature.
--
-- Nullable because it is unknown for handles recorded before this existed, and
-- for platforms that never supply one. Code that needs it must say so rather
-- than assume, so a reply fails with "reconnect and re-sync" instead of
-- sending to a guessed recipient.

alter table public.client_social_handles
  add column external_user_id text;

comment on column public.client_social_handles.external_user_id is
  'Platform-scoped sender id, required to send a reply. Null when not yet known.';

-- Partial: only rows that have an id participate, and lookups by it are
-- always filtered to a platform.
create index client_social_handles_external_idx
  on public.client_social_handles (platform, external_user_id)
  where external_user_id is not null;
