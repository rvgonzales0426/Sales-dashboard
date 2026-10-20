-- ============================================================================
-- 0001_profiles.sql — roles, permissions, and profiles
--
-- Dynamic RBAC: roles are ROWS, not an enum, so an admin can create one at
-- runtime without a deploy. Permissions are a fixed vocabulary that code
-- references by string key; roles are bags of those permissions.
--
--   profiles.role_id -> roles -> role_permissions -> permissions
--
-- Run order: 0001 then 0002.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- permissions — the vocabulary
--
-- These keys appear in application code (src/config/permissions.ts) and in RLS
-- policies, so they are seeded by migration, not created at runtime. Adding a
-- permission is a migration; handing one to a role is a click.
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  key         text primary key,
  label       text not null,
  description text,
  -- Groups the checkboxes in the role editor.
  category    text not null default 'General',
  created_at  timestamptz not null default now()
);

comment on table public.permissions is
  'Fixed vocabulary of capabilities. Seeded by migration; referenced by key in code.';

-- ---------------------------------------------------------------------------
-- roles — runtime-manageable
--
-- is_superuser: holds every permission implicitly, including ones added by a
--   later migration. Exactly one seeded role has it.
-- is_system: cannot be deleted, renamed, or have its key changed. Protects the
--   two roles the application itself depends on.
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  label        text not null,
  description  text,
  is_superuser boolean not null default false,
  is_system    boolean not null default false,
  -- Display order, and the basis for coarse "outranks" comparisons.
  rank         integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists roles_rank_idx on public.roles (rank desc);

-- ---------------------------------------------------------------------------
-- role_permissions — the grant matrix
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create index if not exists role_permissions_role_idx on public.role_permissions (role_id);

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users row
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  -- Nullable so deleting a role never deletes people. A profile with no role
  -- has no permissions, which is the safe failure direction.
  role_id     uuid references public.roles (id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Application-level user record. Extends auth.users, which stays untouched.';

create index if not exists profiles_role_idx on public.profiles (role_id);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- Seed: the two roles the application depends on
--
-- Add project-specific roles through the Roles page at runtime, or here if you
-- want every clone of the template to start with them.
-- ---------------------------------------------------------------------------
insert into public.roles (key, label, description, is_superuser, is_system, rank)
values
  ('admin', 'Admin', 'Full access, including user and role management.', true, true, 100),
  ('user',  'User',  'Standard access to their own data.',               false, true, 10)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: the template's own permissions
--
-- Add a row here for each capability your project needs, then grant it to
-- roles in the app. Keep keys in the form '<area>.<verb>'.
-- ---------------------------------------------------------------------------
insert into public.permissions (key, label, description, category)
values
  ('users.read',   'View users',        'See the user directory.',                    'Users'),
  ('users.write',  'Manage users',      'Change a user''s role or deactivate them.',  'Users'),
  ('users.invite', 'Invite users',      'Send invitations to new people.',            'Users'),
  ('roles.read',   'View roles',        'See roles and what each one can do.',        'Access control'),
  ('roles.write',  'Manage roles',      'Create roles and change their permissions.', 'Access control')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists roles_touch_updated_at on public.roles;
create trigger roles_touch_updated_at
  before update on public.roles
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Create the profile row automatically on signup
--
-- SECURITY DEFINER because the row is written before the new user has a
-- session of their own.
--
-- Note what this does NOT do: it never reads a role out of raw_user_meta_data.
-- That metadata is caller-controlled — anyone calling signUp() can put
-- {"role":"admin"} in it. New accounts always get the 'user' role, and role
-- changes go through someone holding users.write.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role_id uuid;
begin
  select id into default_role_id from public.roles where key = 'user';

  insert into public.profiles (id, email, full_name, role_id)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    default_role_id
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Keep profiles.email in step when the user changes it in Supabase Auth.
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Backfill: gives existing auth users a profile if you add this to a live
-- project. Harmless on a fresh one.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, email, full_name, role_id)
select
  u.id,
  u.email,
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
  (select id from public.roles where key = 'user')
from auth.users u
on conflict (id) do nothing;
