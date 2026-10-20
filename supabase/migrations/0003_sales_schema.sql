-- ============================================================================
-- 0003_sales_schema.sql — people, upload snapshots, targets, settings, audit
--
-- The workbook upload is the source of truth, so the shape follows it:
--
--   uploads ──< upload_people ──< performance_rows
--                    │
--                    └── people (stable identity across quarters)
--
-- An upload is an immutable snapshot of one quarter. Re-uploading a quarter
-- adds a new version; exactly one version per quarter is current. Only INPUTS
-- are stored (in-house, ethical, calls, targets) — combi, totals, attainment
-- and pace are computed by src/lib/metrics, never persisted.
--
-- Run order: 0001, 0002, then 0003 → 0006.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Vocabulary
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.position_kind as enum ('psr', 'supervisor', 'group_head');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'na' is the group head's "N/A". Adding an area is a migration on purpose:
  -- the parser rejects unknown areas instead of inventing them.
  create type public.area_kind as enum ('north', 'south', 'caraga', 'na');
exception when duplicate_object then null; end $$;

-- Internal helpers live outside the API-exposed schema.
create schema if not exists app_private;
revoke all on schema app_private from public;

-- ---------------------------------------------------------------------------
-- people — one row per real person, matched across uploads by name_key
--
-- name_key is computed by the parser (src/lib/excel/names.ts): accents
-- stripped, lowercased, punctuation and runs of spaces collapsed, as
-- 'last|first'. "Piñuela, Arlene" and "PINUELA ,  arlene" share a key.
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id                   uuid primary key default gen_random_uuid(),
  last_name            text not null check (length(trim(last_name)) between 1 and 120),
  first_name           text not null check (length(trim(first_name)) between 1 and 120),
  name_key             text not null unique check (name_key ~ '^[^|]+\|[^|]+$'),
  -- Current position and area: those of the person's most recent quarter.
  -- Each upload also snapshots them, so history survives a transfer.
  position             public.position_kind not null,
  area                 public.area_kind not null,
  active               boolean not null default true,
  -- Links a sales person to a sign-in, for agent self-view.
  profile_id           uuid unique references public.profiles (id) on delete set null,
  -- Set when an admin merges a duplicate into this person's survivor.
  merged_into          uuid references public.people (id) on delete set null,
  first_seen_upload_id uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (merged_into is distinct from id)
);

comment on table public.people is
  'Sales team members. Identity is name_key; uploads reference people, never names.';

create index if not exists people_area_idx on public.people (area);
create index if not exists people_merged_idx on public.people (merged_into);

-- "This spelling is that person" — written when a preview maps a new name onto
-- an existing person, and when two people are merged.
create table if not exists public.person_aliases (
  name_key   text primary key check (name_key ~ '^[^|]+\|[^|]+$'),
  person_id  uuid not null references public.people (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists person_aliases_person_idx on public.person_aliases (person_id);

-- ---------------------------------------------------------------------------
-- uploads — one immutable snapshot of one quarter
-- ---------------------------------------------------------------------------
create table if not exists public.uploads (
  id                uuid primary key default gen_random_uuid(),
  period_year       integer not null check (period_year between 2000 and 2100),
  period_quarter    smallint not null check (period_quarter between 1 and 4),
  version           integer not null check (version > 0),
  -- Path inside the private 'workbooks' bucket. Null only for seeded data.
  file_path         text unique,
  original_filename text not null,
  file_sha256       text check (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_size         integer check (file_size > 0),
  sheet_name        text,
  uploaded_by       uuid references public.profiles (id) on delete set null,
  uploaded_at       timestamptz not null default now(),
  -- 'warnings' when the preview raised non-blocking warnings. Errors never
  -- reach this table — they block the commit.
  status            text not null default 'clean' check (status in ('clean', 'warnings')),
  is_current        boolean not null default false,
  row_count         integer not null check (row_count >= 0),
  -- Which of the quarter's three months had any data (1 = first month).
  months_with_data  smallint[] not null default '{}',
  warning_count     integer not null default 0,
  warnings          jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array'),
  unique (period_year, period_quarter, version)
);

comment on table public.uploads is
  'Versioned quarter snapshots. One is_current row per quarter; older versions stay restorable.';

create unique index if not exists uploads_one_current_idx
  on public.uploads (period_year, period_quarter)
  where is_current;

create index if not exists uploads_period_idx
  on public.uploads (period_year desc, period_quarter desc, version desc);

alter table public.people
  drop constraint if exists people_first_seen_upload_fk;
alter table public.people
  add constraint people_first_seen_upload_fk
  foreign key (first_seen_upload_id) references public.uploads (id) on delete set null;

-- ---------------------------------------------------------------------------
-- upload_people — who was in this snapshot, as what, where, with which targets
--
-- Targets here are the ones printed in the workbook (the TARGETS columns).
-- Admin-edited targets live in public.targets and take precedence.
-- ---------------------------------------------------------------------------
create table if not exists public.upload_people (
  upload_id         uuid not null references public.uploads (id) on delete cascade,
  person_id         uuid not null references public.people (id) on delete restrict on update cascade,
  position          public.position_kind not null,
  area              public.area_kind not null,
  source_row        integer,
  source_last_name  text not null,
  source_first_name text not null,
  target_inhouse    numeric(14, 2) check (target_inhouse >= 0),
  target_ethical    numeric(14, 2) check (target_ethical >= 0),
  target_combi      numeric(14, 2) check (target_combi >= 0),
  target_calls      integer check (target_calls >= 0),
  primary key (upload_id, person_id)
);

create index if not exists upload_people_person_idx on public.upload_people (person_id);

-- ---------------------------------------------------------------------------
-- performance_rows — the inputs, one row per person per month WITH DATA
--
-- A month with no data at all has no rows, which is how the dashboard tells
-- "no data yet" from "zero".
-- Collections may be negative (returns and adjustments); calls may not.
-- ---------------------------------------------------------------------------
create table if not exists public.performance_rows (
  upload_id uuid not null,
  person_id uuid not null,
  month     smallint not null check (month between 1 and 3),
  inhouse   numeric(14, 2) not null default 0,
  ethical   numeric(14, 2) not null default 0,
  calls     integer not null default 0 check (calls >= 0),
  primary key (upload_id, person_id, month),
  foreign key (upload_id, person_id)
    references public.upload_people (upload_id, person_id)
    on delete cascade on update cascade
);

create index if not exists performance_rows_person_idx on public.performance_rows (person_id);

-- ---------------------------------------------------------------------------
-- targets — the admin layer, so targets are never stuck in a spreadsheet
--
-- Resolution, per field, first non-null wins (src/lib/metrics/targets.ts):
--   1. scope 'person'         for this person and quarter
--   2. the workbook's own target (upload_people.target_*)
--   3. scope 'position_area'  e.g. PSR in Caraga
--   4. scope 'position'       e.g. every PSR
-- Values are QUARTER targets. Monthly = quarter / 3.
-- ---------------------------------------------------------------------------
create table if not exists public.targets (
  id             uuid primary key default gen_random_uuid(),
  period_year    integer not null check (period_year between 2000 and 2100),
  period_quarter smallint not null check (period_quarter between 1 and 4),
  scope          text not null check (scope in ('person', 'position_area', 'position')),
  person_id      uuid references public.people (id) on delete cascade,
  position       public.position_kind,
  area           public.area_kind,
  inhouse        numeric(14, 2) check (inhouse >= 0),
  ethical        numeric(14, 2) check (ethical >= 0),
  combi          numeric(14, 2) check (combi >= 0),
  calls          integer check (calls >= 0),
  note           text,
  updated_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (
    (scope = 'person' and person_id is not null and position is null and area is null)
    or (scope = 'position_area' and person_id is null and position is not null and area is not null)
    or (scope = 'position' and person_id is null and position is not null and area is null)
  )
);

-- One target row per scope per quarter.
create unique index if not exists targets_person_once_idx
  on public.targets (period_year, period_quarter, person_id)
  where scope = 'person';
create unique index if not exists targets_position_area_once_idx
  on public.targets (period_year, period_quarter, position, area)
  where scope = 'position_area';
create unique index if not exists targets_position_once_idx
  on public.targets (period_year, period_quarter, position)
  where scope = 'position';

create index if not exists targets_person_idx on public.targets (person_id);

-- ---------------------------------------------------------------------------
-- app_settings — one row of tunables, editable in Administration
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id                     boolean primary key default true check (id),
  -- Pace bands, as a share of expected-to-date. ≥ on_pace is on pace;
  -- ≥ at_risk is at risk; below is behind.
  on_pace_threshold      numeric(5, 4) not null default 1.0 check (on_pace_threshold > 0),
  at_risk_threshold      numeric(5, 4) not null default 0.70 check (at_risk_threshold > 0),
  -- The "calls low" tell-tale lights below this share of expected calls.
  calls_low_threshold    numeric(5, 4) not null default 0.70 check (calls_low_threshold > 0),
  -- Agents see their own cockpit only while this is on.
  agent_access_enabled   boolean not null default false,
  -- When a person has in-house and ethical targets but no combi target:
  -- 'sum' derives combi from the parts, 'none' leaves combi unset.
  combi_target_fallback  text not null default 'sum' check (combi_target_fallback in ('sum', 'none')),
  -- Is the workbook's CALLS target a quarter figure (480) or a monthly one (160)?
  file_calls_target_basis text not null default 'quarter'
    check (file_calls_target_basis in ('quarter', 'month')),
  -- People without a target are left out of attainment and rankings, but
  -- still count toward raw totals.
  rank_requires_target   boolean not null default true,
  wall_rotate_seconds    integer not null default 20 check (wall_rotate_seconds between 5 and 600),
  updated_by             uuid references public.profiles (id) on delete set null,
  updated_at             timestamptz not null default now(),
  check (at_risk_threshold < on_pace_threshold)
);

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- audit_log — uploads, restores, target edits, merges, settings changes
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  summary     text not null,
  details     jsonb not null default '{}'
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- Day / Night display mode follows the person, not the device.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists display_mode text not null default 'system'
  check (display_mode in ('day', 'night', 'system'));

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping (touch_updated_at() comes from 0001)
-- ---------------------------------------------------------------------------
drop trigger if exists people_touch_updated_at on public.people;
create trigger people_touch_updated_at
  before update on public.people
  for each row execute function public.touch_updated_at();

drop trigger if exists targets_touch_updated_at on public.targets;
create trigger targets_touch_updated_at
  before update on public.targets
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch_updated_at on public.app_settings;
create trigger app_settings_touch_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();
