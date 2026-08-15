-- Google Drive photo import.
--
-- The studio keeps in-house and personal photography in Google Drive,
-- separate from client shoots — the wedding speeches reel, the family beach
-- album. This lets a staff member browse a folder that has been shared with
-- the service account (see packages/core/src/integrations/live/google-drive.ts,
-- the same sharing pattern as the calendar adapter) and pull specific photos
-- into `assets` so Studio search and campaigns can use them, without ever
-- attaching them to a client's shoot or gallery.
--
-- Two tables, one per Drive folder ever imported from:
--
--  - `drive_import_jobs` is keyed uniquely on `drive_folder_id`, so browsing
--    the same folder twice reuses the same job (and the same import shoot)
--    rather than creating a parallel one.
--  - `drive_import_files` tracks one row per selected file, unique on
--    `(job_id, drive_file_id)`. That uniqueness is what makes importing the
--    same folder twice a no-op for files already imported: selecting a file
--    that already has a row here is a duplicate insert Postgres rejects, and
--    the application code treats a conflict as "already tracked" rather than
--    an error. It is also the resumability record — an import of a few
--    hundred files that gets interrupted resumes by asking this table which
--    files are still `pending` (or `failed` and under the retry cap) rather
--    than starting over.
--
-- Deliberately not stored: which studio member ran which batch of a job.
-- Single-tenant, staff-only data — same access model as everything else.

create table public.drive_import_jobs (
  id                 uuid primary key default gen_random_uuid(),
  drive_folder_id    text not null,
  drive_folder_name  text not null,
  -- The shoot every imported photo from this folder lands under. Cascades:
  -- deleting the shoot (and therefore its photos) also clears the import
  -- bookkeeping, so a re-import of the same folder starts clean rather than
  -- resuming into a shoot that no longer exists.
  shoot_id           uuid not null references public.shoots (id) on delete cascade,
  status             text not null default 'pending'
                        check (status in ('pending','running','completed','completed_with_errors')),
  total_files        integer not null default 0 check (total_files >= 0),
  imported_files      integer not null default 0 check (imported_files >= 0),
  failed_files        integer not null default 0 check (failed_files >= 0),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint drive_import_jobs_folder_key unique (drive_folder_id),
  constraint drive_import_jobs_counts_within_total
    check (imported_files + failed_files <= total_files)
);

comment on table public.drive_import_jobs is
  'One row per Drive folder ever imported from. Reused on re-import so the same folder never creates a second shoot.';

create trigger drive_import_jobs_touch before update on public.drive_import_jobs
  for each row execute function public.touch_updated_at();

create table public.drive_import_files (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.drive_import_jobs (id) on delete cascade,
  drive_file_id  text not null,
  name           text not null,
  mime_type      text not null,
  byte_size      bigint not null default 0 check (byte_size >= 0),
  width          integer check (width is null or width > 0),
  height         integer check (height is null or height > 0),
  modified_time  timestamptz,
  -- No interim "in progress" state on purpose: a crash mid-file must never
  -- leave a row stuck in a status resume will not pick back up. The row only
  -- ever moves once its file has actually landed (`imported`) or definitely
  -- failed (`failed`); a batch that dies mid-download simply leaves the row
  -- `pending`, which is exactly the set the next batch retries.
  status         text not null default 'pending'
                   check (status in ('pending','imported','failed')),
  -- Caps automatic retry on resume. A file that fails repeatedly (corrupt on
  -- Drive's end, a permission edge case) stops being retried on its own but
  -- stays visible with its error, rather than being retried forever every
  -- time somebody reopens the folder.
  attempts       smallint not null default 0 check (attempts >= 0),
  asset_id       uuid references public.assets (id) on delete set null,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- The idempotency key: a given Drive file can appear at most once in a
  -- given job's tracking, however many times it gets (re)selected.
  constraint drive_import_files_job_file_key unique (job_id, drive_file_id),
  -- An imported row must point at the asset it produced; nothing else may.
  constraint drive_import_files_imported_has_asset
    check (status <> 'imported' or asset_id is not null)
);

comment on table public.drive_import_files is
  'One row per Drive file selected for import. Unique on (job_id, drive_file_id): re-selecting an already-tracked file is a no-op, and status drives resumable retry.';

create index drive_import_files_job_idx on public.drive_import_files (job_id);
-- The resume query: pending or retryable-failed files for one job, oldest
-- first, is the hottest read this table has.
create index drive_import_files_pending_idx
  on public.drive_import_files (job_id, created_at)
  where status in ('pending', 'failed');

create trigger drive_import_files_touch before update on public.drive_import_files
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------------------
-- row level security
-- --------------------------------------------------------------------------

alter table public.drive_import_jobs  enable row level security;
alter table public.drive_import_files enable row level security;

create policy drive_import_jobs_staff_all on public.drive_import_jobs
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy drive_import_files_staff_all on public.drive_import_files
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
