-- ============================================================================
-- 0005_sales_rls.sql — who may read and write the sales tables
--
-- The pattern is 0002's: every policy calls a helper, never a fresh join.
--
-- Snapshot tables (uploads, upload_people, performance_rows, person_aliases)
-- have NO write policies at all. Through the API they are read-only; the only
-- writers are commit_upload(), restore_upload() and merge_people() in 0006,
-- which check permissions themselves. That is what makes a snapshot immutable.
-- ============================================================================

alter table public.people           enable row level security;
alter table public.person_aliases   enable row level security;
alter table public.uploads          enable row level security;
alter table public.upload_people    enable row level security;
alter table public.performance_rows enable row level security;
alter table public.targets          enable row level security;
alter table public.app_settings     enable row level security;
alter table public.audit_log        enable row level security;

-- Belt and braces: even without policies, nobody signed in may write these.
revoke insert, update, delete, truncate on public.uploads          from anon, authenticated;
revoke insert, update, delete, truncate on public.upload_people    from anon, authenticated;
revoke insert, update, delete, truncate on public.performance_rows from anon, authenticated;
revoke insert, update, delete, truncate on public.person_aliases   from anon, authenticated;
revoke insert, update, delete, truncate on public.audit_log        from anon, authenticated;
revoke all on public.people, public.person_aliases, public.uploads, public.upload_people,
              public.performance_rows, public.targets, public.app_settings, public.audit_log
  from anon;

-- people: the API may edit these columns and no others. merged_into and
-- first_seen_upload_id are bookkeeping that only merge_people() and
-- commit_upload() maintain.
revoke insert, update, delete, truncate on public.people from authenticated;
grant update (last_name, first_name, name_key, position, area, active, profile_id)
  on public.people to authenticated;

-- app_settings is a singleton: update only.
revoke insert, delete, truncate on public.app_settings from authenticated;

-- people ---------------------------------------------------------------------
drop policy if exists people_select on public.people;
create policy people_select
  on public.people for select to authenticated
  using (public.can_see_person(id));

drop policy if exists people_update on public.people;
create policy people_update
  on public.people for update to authenticated
  using (public.has_permission('people.write'))
  with check (public.has_permission('people.write'));

-- person_aliases --------------------------------------------------------------
drop policy if exists person_aliases_select on public.person_aliases;
create policy person_aliases_select
  on public.person_aliases for select to authenticated
  using (public.has_permission('sales.read'));

-- uploads ---------------------------------------------------------------------
drop policy if exists uploads_select on public.uploads;
create policy uploads_select
  on public.uploads for select to authenticated
  using (public.can_see_uploads());

-- upload_people / performance_rows -------------------------------------------
drop policy if exists upload_people_select on public.upload_people;
create policy upload_people_select
  on public.upload_people for select to authenticated
  using (public.can_see_person(person_id));

drop policy if exists performance_rows_select on public.performance_rows;
create policy performance_rows_select
  on public.performance_rows for select to authenticated
  using (public.can_see_person(person_id));

-- targets ---------------------------------------------------------------------
-- Readable by anyone who can see sales data. Agents see defaults plus their
-- own person-level override, never someone else's.
drop policy if exists targets_select on public.targets;
create policy targets_select
  on public.targets for select to authenticated
  using (
    public.has_permission('sales.read')
    or public.has_permission('targets.write')
    or (
      public.has_permission('sales.self')
      and public.agent_access_enabled()
      and (person_id is null or person_id = public.my_person_id())
    )
  );

drop policy if exists targets_insert on public.targets;
create policy targets_insert
  on public.targets for insert to authenticated
  with check (public.has_permission('targets.write'));

drop policy if exists targets_update on public.targets;
create policy targets_update
  on public.targets for update to authenticated
  using (public.has_permission('targets.write'))
  with check (public.has_permission('targets.write'));

drop policy if exists targets_delete on public.targets;
create policy targets_delete
  on public.targets for delete to authenticated
  using (public.has_permission('targets.write'));

-- app_settings ----------------------------------------------------------------
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select
  on public.app_settings for select to authenticated
  using (public.is_active_user());

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update
  on public.app_settings for update to authenticated
  using (public.has_permission('settings.write'))
  with check (public.has_permission('settings.write'));

-- audit_log -------------------------------------------------------------------
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select
  on public.audit_log for select to authenticated
  using (public.has_permission('audit.read'));

-- ---------------------------------------------------------------------------
-- Guardrails policies cannot express
-- ---------------------------------------------------------------------------

-- Who changed a target or a setting is recorded by the database, not trusted
-- from the client.
create or replace function app_private.stamp_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists targets_stamp_updated_by on public.targets;
create trigger targets_stamp_updated_by
  before insert or update on public.targets
  for each row execute function app_private.stamp_updated_by();

drop trigger if exists app_settings_stamp_updated_by on public.app_settings;
create trigger app_settings_stamp_updated_by
  before update on public.app_settings
  for each row execute function app_private.stamp_updated_by();

-- Renaming a person changes their name_key. Keep the old spelling as an alias
-- so next quarter's workbook, still carrying it, maps to the same person.
create or replace function app_private.people_keep_old_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name_key is distinct from old.name_key then
    insert into public.person_aliases (name_key, person_id, created_by)
    values (old.name_key, new.id, auth.uid())
    on conflict (name_key) do update set person_id = excluded.person_id;
    delete from public.person_aliases where name_key = new.name_key;
  end if;
  return new;
end;
$$;

drop trigger if exists people_keep_old_key on public.people;
create trigger people_keep_old_key
  before update of name_key on public.people
  for each row execute function app_private.people_keep_old_key();

-- ---------------------------------------------------------------------------
-- Audit trail for edits made directly through the API
-- (commit, restore and merge write their own entries in 0006)
-- ---------------------------------------------------------------------------
create or replace function app_private.audit_targets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
  who      text;
begin
  -- merge_people() moves person targets and audits the merge as one entry.
  if current_setting('app.bulk_write', true) = 'on' then
    return coalesce(new, old);
  end if;

  who := case row_data ->> 'scope'
    when 'person' then (
      select concat_ws(', ', last_name, first_name) from public.people
      where id = (row_data ->> 'person_id')::uuid
    )
    when 'position_area' then concat_ws(' · ', upper(row_data ->> 'position'), upper(row_data ->> 'area'))
    else upper(row_data ->> 'position')
  end;

  perform app_private.write_audit(
    'target.' || lower(tg_op),
    'target',
    row_data ->> 'id',
    format('%s target for %s, Q%s %s',
      case tg_op when 'INSERT' then 'Set' when 'UPDATE' then 'Changed' else 'Removed' end,
      coalesce(who, 'unknown'),
      row_data ->> 'period_quarter',
      row_data ->> 'period_year'),
    jsonb_build_object(
      'before', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'after',  case when tg_op <> 'DELETE' then to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists targets_audit on public.targets;
create trigger targets_audit
  after insert or update or delete on public.targets
  for each row execute function app_private.audit_targets();

create or replace function app_private.audit_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform app_private.write_audit(
    'settings.update', 'app_settings', 'singleton', 'Changed sales settings',
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists app_settings_audit on public.app_settings;
create trigger app_settings_audit
  after update on public.app_settings
  for each row execute function app_private.audit_settings();

create or replace function app_private.audit_people()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- commit_upload() and merge_people() write one entry for the whole action
  -- and set this flag so their per-row bookkeeping doesn't flood the log.
  if current_setting('app.bulk_write', true) = 'on' then
    return new;
  end if;
  perform app_private.write_audit(
    'person.update', 'person', new.id::text,
    format('Edited %s, %s', new.last_name, new.first_name),
    jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists people_audit on public.people;
create trigger people_audit
  after update on public.people
  for each row
  when (old.* is distinct from new.*)
  execute function app_private.audit_people();
