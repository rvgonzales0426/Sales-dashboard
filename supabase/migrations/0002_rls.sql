-- ============================================================================
-- 0002_rls.sql — permission helpers and the policies that use them
--
-- The point of this file: every table in your project gets correct policies by
-- calling has_permission('area.verb'), never by repeating a join against
-- profiles. Roles change at runtime; the policies never do.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER so they can read profiles/roles/role_permissions without
-- tripping the very policies they are used inside — a plain subquery against
-- profiles in a profiles policy recurses forever.
--
-- STABLE lets Postgres call them once per statement instead of once per row.
-- ---------------------------------------------------------------------------

create or replace function public.current_role_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.key
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid() and p.is_active;
$$;

comment on function public.current_role_key() is
  'Role key of the signed-in user, or NULL when signed out, deactivated, or unassigned.';

-- The primary check. Everything else is convenience on top of it.
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.is_active
      and (
        -- A superuser role holds every permission, including ones added by a
        -- migration written after the role existed.
        r.is_superuser
        or exists (
          select 1
          from public.role_permissions rp
          where rp.role_id = r.id
            and rp.permission_key = perm
        )
      )
  );
$$;

-- Role-name check, for the rare case where identity matters more than
-- capability. Prefer has_permission() — it survives roles being renamed.
create or replace function public.has_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_key() = any (allowed), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select r.is_superuser
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.id = auth.uid() and p.is_active
    ),
    false
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;

-- One round trip for the client to load its whole permission set on sign-in.
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.key
  from public.permissions p
  where public.is_admin()
  union
  select rp.permission_key
  from public.profiles pr
  join public.role_permissions rp on rp.role_id = pr.role_id
  where pr.id = auth.uid() and pr.is_active;
$$;

grant execute on function public.current_role_key() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_role(text[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_permissions() to authenticated;

-- ---------------------------------------------------------------------------
-- Guardrails that policies cannot express
--
-- A policy decides whether you may touch a ROW. It cannot say "you may update
-- this row but not these two columns of it". That needs a trigger.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_profile_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();

  -- No end-user JWT: the SQL editor, a migration, or the service-role key
  -- (the invite function). RLS already gates the public API, so let these
  -- through — this is how you seed your first admin.
  if auth.uid() is null then
    return new;
  end if;

  -- Nobody edits their own role or status, superusers included. Prevents both
  -- self-promotion and an admin locking the last door behind them.
  if auth.uid() = new.id then
    if new.role_id is distinct from old.role_id then
      raise exception 'You cannot change your own role.' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'You cannot change your own account status.' using errcode = '42501';
    end if;
  end if;

  -- Everyone else's role and status need users.write, whatever the policy allowed.
  if (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active)
     and not public.has_permission('users.write') then
    raise exception 'You do not have permission to change roles or account status.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_rules on public.profiles;
create trigger profiles_enforce_rules
  before update on public.profiles
  for each row
  execute function public.enforce_profile_rules();

-- System roles are the two the application itself depends on. They can be
-- relabelled and described freely; their identity cannot change.
create or replace function public.enforce_role_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'The % role is built in and cannot be deleted.', old.label
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.is_system then
    if new.key is distinct from old.key then
      raise exception 'The key of a built-in role cannot be changed.' using errcode = '42501';
    end if;
    if new.is_superuser is distinct from old.is_superuser
       or new.is_system is distinct from old.is_system then
      raise exception 'The privileges of a built-in role cannot be changed.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists roles_enforce_rules on public.roles;
create trigger roles_enforce_rules
  before update or delete on public.roles
  for each row
  execute function public.enforce_role_rules();

-- A superuser role already holds everything, so granting or revoking rows for
-- it is meaningless and would imply the checkboxes mean something.
create or replace function public.enforce_role_permission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.role_id, old.role_id);
begin
  if exists (select 1 from public.roles where id = target and is_superuser) then
    raise exception 'A superuser role already has every permission.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists role_permissions_enforce_rules on public.role_permissions;
create trigger role_permissions_enforce_rules
  before insert or update or delete on public.role_permissions
  for each row
  execute function public.enforce_role_permission_rules();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.roles            enable row level security;
alter table public.permissions      enable row level security;
alter table public.role_permissions enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('users.read'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_permission('users.write'))
  with check (id = auth.uid() or public.has_permission('users.write'));

-- Inserts come from handle_new_user(), which is SECURITY DEFINER, so no INSERT
-- policy is needed. Deletes cascade from auth.users, so no DELETE policy —
-- deleting a profile while its auth user lives would break the one-row-per-user
-- invariant.

-- roles ---------------------------------------------------------------------
-- Everyone signed in may READ roles: the app renders role names on user rows
-- and in the account menu. Only roles.write may change them.
drop policy if exists roles_select on public.roles;
create policy roles_select
  on public.roles for select to authenticated
  using (public.is_active_user());

drop policy if exists roles_insert on public.roles;
create policy roles_insert
  on public.roles for insert to authenticated
  with check (public.has_permission('roles.write'));

drop policy if exists roles_update on public.roles;
create policy roles_update
  on public.roles for update to authenticated
  using (public.has_permission('roles.write'))
  with check (public.has_permission('roles.write'));

drop policy if exists roles_delete on public.roles;
create policy roles_delete
  on public.roles for delete to authenticated
  using (public.has_permission('roles.write'));

-- permissions ---------------------------------------------------------------
-- Read-only from the client. The vocabulary is seeded by migration, because
-- code references these keys.
drop policy if exists permissions_select on public.permissions;
create policy permissions_select
  on public.permissions for select to authenticated
  using (public.is_active_user());

-- role_permissions ----------------------------------------------------------
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select
  on public.role_permissions for select to authenticated
  using (public.is_active_user());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write
  on public.role_permissions for all to authenticated
  using (public.has_permission('roles.write'))
  with check (public.has_permission('roles.write'));

-- ============================================================================
-- SEED YOUR FIRST ADMIN
--
-- Sign up through the app first, then run this once with your own email:
--
--     update public.profiles
--     set role_id = (select id from public.roles where key = 'admin')
--     where email = 'you@example.com';
--
-- It works from the SQL editor because the trigger above lets through calls
-- with no end-user JWT.
-- ============================================================================

-- ============================================================================
-- THE PATTERN FOR A NEW TABLE
--
-- 1. Add the permissions your feature needs:
--
--      insert into public.permissions (key, label, description, category)
--      values
--        ('equipment.read',  'View equipment',   'See the equipment list.',  'Equipment'),
--        ('equipment.write', 'Manage equipment', 'Add and edit equipment.',  'Equipment');
--
-- 2. Write policies against them — never a fresh join on profiles:
--
--      create table public.equipment (
--        id          uuid primary key default gen_random_uuid(),
--        owner_id    uuid not null references public.profiles (id) on delete cascade,
--        name        text not null,
--        created_at  timestamptz not null default now()
--      );
--
--      alter table public.equipment enable row level security;
--
--      create policy equipment_select on public.equipment for select to authenticated
--        using (owner_id = auth.uid() or public.has_permission('equipment.read'));
--
--      create policy equipment_insert on public.equipment for insert to authenticated
--        with check (public.has_permission('equipment.write') and owner_id = auth.uid());
--
--      create policy equipment_update on public.equipment for update to authenticated
--        using (owner_id = auth.uid() or public.has_permission('equipment.write'))
--        with check (owner_id = auth.uid() or public.has_permission('equipment.write'));
--
--      create policy equipment_delete on public.equipment for delete to authenticated
--        using (public.has_permission('equipment.write'));
--
-- 3. Add the keys to src/config/permissions.ts so the client can reference them.
--
-- 4. Grant them to roles in the app — no deploy needed.
--
-- Shared reference data (departments, categories, rooms) reads for everyone:
--      using (public.is_active_user())
-- ============================================================================
