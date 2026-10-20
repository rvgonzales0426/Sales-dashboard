-- ============================================================================
-- 0004_sales_permissions.sql — the sales vocabulary, two roles, and the
-- visibility helpers every sales policy is written against
--
-- Roles stay rows (see 0001). This file seeds two of them so a fresh project
-- starts usable; admins can rename them, re-grant them, or invent others.
--
--   admin    is_superuser — upload, edit targets, everything (already exists)
--   manager  sales.read   — sees every person's numbers
--   agent    sales.self   — sees their own cockpit, only while agent access
--                           is switched on in Sales settings
-- ============================================================================

insert into public.permissions (key, label, description, category)
values
  ('sales.read',     'View sales performance', 'See every team member''s numbers: cockpit, areas and leaderboard.', 'Sales'),
  ('sales.self',     'View own performance',   'See your own cockpit while agent access is switched on.',          'Sales'),
  ('uploads.write',  'Upload workbooks',       'Upload, commit and restore performance workbooks.',               'Uploads'),
  ('uploads.read',   'View upload history',    'See past uploads and download the original files.',               'Uploads'),
  ('targets.write',  'Edit targets',           'Set targets per person, position and area.',                      'Sales administration'),
  ('people.write',   'Manage people',          'Edit sales team members and merge duplicates.',                   'Sales administration'),
  ('audit.read',     'View audit log',         'See who uploaded, restored, merged or changed targets.',          'Sales administration'),
  ('settings.write', 'Change sales settings',  'Pace thresholds, agent access and wall-display timing.',          'Sales administration')
on conflict (key) do nothing;

insert into public.roles (key, label, description, is_superuser, is_system, rank)
values
  ('manager', 'Manager', 'Sees every team member''s performance. Cannot upload.', false, false, 50),
  ('agent',   'Agent',   'Sees their own cockpit when agent access is on.',       false, false, 20)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on (r.key, p.key) in (('manager', 'sales.read'), ('agent', 'sales.self'))
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
--
-- SECURITY DEFINER for the same reason as 0002: they read tables whose own
-- policies call them.
-- ---------------------------------------------------------------------------

create or replace function public.agent_access_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select agent_access_enabled from public.app_settings where id), false);
$$;

-- The sales person linked to the signed-in account, if any.
create or replace function public.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.people p
  where p.profile_id = auth.uid()
    and p.merged_into is null
  limit 1;
$$;

-- The one visibility rule for per-person sales data.
create or replace function public.can_see_person(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('sales.read')
      or (
        target is not null
        and public.has_permission('sales.self')
        and public.agent_access_enabled()
        and target = public.my_person_id()
      );
$$;

-- Upload metadata (period, version, months with data) is not sensitive, but
-- still needs some sales access.
create or replace function public.can_see_uploads()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('sales.read')
      or public.has_permission('uploads.read')
      or public.has_permission('uploads.write')
      or (public.has_permission('sales.self') and public.agent_access_enabled());
$$;

revoke execute on function public.agent_access_enabled() from public, anon;
revoke execute on function public.my_person_id() from public, anon;
revoke execute on function public.can_see_person(uuid) from public, anon;
revoke execute on function public.can_see_uploads() from public, anon;

grant execute on function public.agent_access_enabled() to authenticated;
grant execute on function public.my_person_id() to authenticated;
grant execute on function public.can_see_person(uuid) to authenticated;
grant execute on function public.can_see_uploads() to authenticated;

-- ---------------------------------------------------------------------------
-- Audit writer. Every audited action goes through here so entries look alike.
-- ---------------------------------------------------------------------------
create or replace function app_private.write_audit(
  p_action    text,
  p_entity    text,
  p_entity_id text,
  p_summary   text,
  p_details   jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, actor_email, action, entity, entity_id, summary, details)
  values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    p_action,
    p_entity,
    p_entity_id,
    p_summary,
    coalesce(p_details, '{}')
  );
end;
$$;

revoke all on function app_private.write_audit(text, text, text, text, jsonb) from public;
