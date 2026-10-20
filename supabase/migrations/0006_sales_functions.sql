-- ============================================================================
-- 0006_sales_functions.sql — the only writers of snapshot data
--
--   commit_upload(payload)    re-validates a parsed workbook and writes a new
--                             version of its quarter, atomically
--   restore_upload(id)        makes an older version current again
--   merge_people(keep, merge) folds a duplicate person into the survivor
--
-- The browser parses and previews the workbook (src/lib/excel). These
-- functions do not trust that work: every row is checked again here, inside
-- the same transaction that writes it. A failed check writes nothing.
--
-- Money arrives as integer CENTAVOS ("inhouse_centavos": 1892828) so no
-- floating-point value ever crosses the wire.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Payload readers with messages a person can act on
-- ---------------------------------------------------------------------------
create or replace function app_private.read_centavos(
  j jsonb, k text, ctx text, allow_negative boolean
)
returns numeric
language plpgsql
immutable
as $$
declare
  v jsonb := j -> k;
  n numeric;
begin
  if j is null or v is null or v = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' then
    raise exception '%: % must be a number.', ctx, k using errcode = '22023';
  end if;
  n := (v #>> '{}')::numeric;
  if n <> trunc(n) then
    raise exception '%: % must be a whole number of centavos.', ctx, k using errcode = '22023';
  end if;
  if abs(n) >= 100000000000000 then
    raise exception '%: % is too large to be a real amount.', ctx, k using errcode = '22023';
  end if;
  if n < 0 and not allow_negative then
    raise exception '%: % cannot be negative.', ctx, k using errcode = '22023';
  end if;
  return n / 100;
end;
$$;

create or replace function app_private.read_calls(j jsonb, k text, ctx text)
returns integer
language plpgsql
immutable
as $$
declare
  v jsonb := j -> k;
  n numeric;
begin
  if j is null or v is null or v = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(v) <> 'number' then
    raise exception '%: calls must be a number.', ctx using errcode = '22023';
  end if;
  n := (v #>> '{}')::numeric;
  if n <> trunc(n) then
    raise exception '%: calls must be a whole number.', ctx using errcode = '22023';
  end if;
  if n < 0 then
    raise exception '%: calls cannot be negative.', ctx using errcode = '22023';
  end if;
  if n >= 10000000 then
    raise exception '%: % calls is not a believable number.', ctx, n using errcode = '22023';
  end if;
  return n::integer;
end;
$$;

revoke all on function app_private.read_centavos(jsonb, text, text, boolean) from public;
revoke all on function app_private.read_calls(jsonb, text, text) from public;

-- ---------------------------------------------------------------------------
-- commit_upload
--
-- payload = {
--   period_year, period_quarter,
--   file_path, original_filename, file_sha256, file_size, sheet_name,
--   months_with_data: [1, 2],
--   warnings: [{ code, message, row?, cell? }],
--   people: [{
--     name_key, last_name, first_name, position, area, source_row,
--     person_id?,                       -- set when the preview matched a new
--                                       -- spelling to an existing person
--     targets?: { inhouse_centavos, ethical_centavos, combi_centavos, calls },
--     months: [{ month, inhouse_centavos, ethical_centavos, calls }]
--   }]
-- }
-- ---------------------------------------------------------------------------
create or replace function public.commit_upload(payload jsonb)
returns public.uploads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year       integer;
  v_quarter    integer;
  v_path       text;
  v_filename   text;
  v_months     smallint[];
  v_warnings   jsonb;
  v_people     jsonb;
  v_version    integer;
  v_upload_id  uuid;
  v_is_latest  boolean;
  v_entry      jsonb;
  v_ord        bigint;
  v_month      jsonb;
  v_month_no   integer;
  v_month_seen integer[];
  v_ctx        text;
  v_key        text;
  v_last       text;
  v_first      text;
  v_position   public.position_kind;
  v_area       public.area_kind;
  v_person_id  uuid;
  v_explicit   uuid;
  v_seen_keys  text[] := '{}';
  v_seen_ids   uuid[] := '{}';
  v_seen_ctx   text[] := '{}';
  v_dupe_at    integer;
  v_created    integer := 0;
  result       public.uploads;
begin
  if not public.has_permission('uploads.write') then
    raise exception 'You do not have permission to upload workbooks.' using errcode = '42501';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'The upload is empty.' using errcode = '22023';
  end if;

  -- Period -------------------------------------------------------------------
  begin
    v_year := (payload ->> 'period_year')::integer;
    v_quarter := (payload ->> 'period_quarter')::integer;
  exception when others then
    raise exception 'The period must be a year and a quarter number.' using errcode = '22023';
  end;
  if v_year is null or v_year not between 2000 and 2100 then
    raise exception 'Choose a year between 2000 and 2100.' using errcode = '22023';
  end if;
  if v_quarter is null or v_quarter not between 1 and 4 then
    raise exception 'The quarter must be 1, 2, 3 or 4.' using errcode = '22023';
  end if;

  -- File ---------------------------------------------------------------------
  v_filename := nullif(trim(payload ->> 'original_filename'), '');
  if v_filename is null then
    raise exception 'The original file name is missing.' using errcode = '22023';
  end if;

  v_path := nullif(payload ->> 'file_path', '');
  if v_path is not null then
    if v_path !~ ('^' || v_year || '-Q' || v_quarter || '/[0-9a-f-]{36}\.xlsx$') then
      raise exception 'The stored file does not belong to Q% %.', v_quarter, v_year using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'workbooks' and name = v_path) then
      raise exception 'The workbook file was not stored. Upload it again.' using errcode = '22023';
    end if;
    if exists (select 1 from public.uploads where file_path = v_path) then
      raise exception 'This file was already committed. Upload the workbook again to make a new version.'
        using errcode = '22023';
    end if;
  elsif auth.uid() is not null then
    -- Only a seed script (no end-user session) may commit without a file.
    raise exception 'The workbook file is missing. Upload it again.' using errcode = '22023';
  end if;

  -- Months with data ---------------------------------------------------------
  if jsonb_typeof(payload -> 'months_with_data') is distinct from 'array' then
    raise exception 'months_with_data must be a list.' using errcode = '22023';
  end if;
  begin
    select coalesce(array_agg(distinct (m #>> '{}')::smallint order by (m #>> '{}')::smallint), '{}')
    into v_months
    from jsonb_array_elements(payload -> 'months_with_data') as m;
  exception when others then
    raise exception 'months_with_data must hold month numbers 1 to 3.' using errcode = '22023';
  end;
  if exists (select 1 from unnest(v_months) as m where m not between 1 and 3) then
    raise exception 'months_with_data must hold month numbers 1 to 3.' using errcode = '22023';
  end if;

  -- Warnings -----------------------------------------------------------------
  v_warnings := coalesce(payload -> 'warnings', '[]');
  if jsonb_typeof(v_warnings) <> 'array' or jsonb_array_length(v_warnings) > 2000 then
    raise exception 'The warning list is malformed.' using errcode = '22023';
  end if;

  -- People -------------------------------------------------------------------
  v_people := payload -> 'people';
  if jsonb_typeof(v_people) is distinct from 'array' or jsonb_array_length(v_people) = 0 then
    raise exception 'The workbook has no people to import.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_people) > 2000 then
    raise exception 'The workbook has more than 2,000 people. Split it by area.' using errcode = '22023';
  end if;

  -- One commit per quarter at a time, so two admins cannot both become v3.
  perform pg_advisory_xact_lock(hashtextextended('upload:' || v_year || ':' || v_quarter, 0));
  perform set_config('app.bulk_write', 'on', true);

  select coalesce(max(version), 0) + 1
  into v_version
  from public.uploads
  where period_year = v_year and period_quarter = v_quarter;

  -- Only the most recent quarter refreshes each person's current area.
  v_is_latest := not exists (
    select 1 from public.uploads
    where period_year * 4 + period_quarter > v_year * 4 + v_quarter
  );

  insert into public.uploads (
    period_year, period_quarter, version, file_path, original_filename,
    file_sha256, file_size, sheet_name, uploaded_by, status, is_current,
    row_count, months_with_data, warning_count, warnings
  )
  values (
    v_year, v_quarter, v_version, v_path, v_filename,
    nullif(payload ->> 'file_sha256', ''),
    nullif(payload ->> 'file_size', '')::integer,
    nullif(payload ->> 'sheet_name', ''),
    auth.uid(),
    case when jsonb_array_length(v_warnings) > 0 then 'warnings' else 'clean' end,
    false,
    jsonb_array_length(v_people),
    v_months,
    jsonb_array_length(v_warnings),
    v_warnings
  )
  returning id into v_upload_id;

  for v_entry, v_ord in
    select e, ord from jsonb_array_elements(v_people) with ordinality as t(e, ord)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception 'Person % in the upload is malformed.', v_ord using errcode = '22023';
    end if;

    v_ctx := 'Row ' || coalesce(v_entry ->> 'source_row', v_ord::text);
    v_last := nullif(regexp_replace(trim(coalesce(v_entry ->> 'last_name', '')), '\s+', ' ', 'g'), '');
    v_first := nullif(regexp_replace(trim(coalesce(v_entry ->> 'first_name', '')), '\s+', ' ', 'g'), '');
    if v_last is null or v_first is null then
      raise exception '%: both last name and first name are required.', v_ctx using errcode = '22023';
    end if;
    if length(v_last) > 120 or length(v_first) > 120 then
      raise exception '%: the name is longer than 120 characters.', v_ctx using errcode = '22023';
    end if;
    v_ctx := format('%s (%s, %s)', v_ctx, v_last, v_first);

    v_key := v_entry ->> 'name_key';
    if v_key is null or v_key !~ '^[^|]+\|[^|]+$' or v_key <> lower(v_key) or v_key <> trim(v_key) then
      raise exception '%: the name key is malformed.', v_ctx using errcode = '22023';
    end if;
    if v_key = any (v_seen_keys) then
      raise exception '% appears more than once. Each person needs exactly one row.', v_ctx
        using errcode = '22023';
    end if;
    v_seen_keys := v_seen_keys || v_key;

    begin
      v_position := (v_entry ->> 'position')::public.position_kind;
    exception when invalid_text_representation then
      raise exception '%: "%" is not a known position. Use PSR, Supervisor or Group head.',
        v_ctx, v_entry ->> 'position' using errcode = '22023';
    end;
    begin
      v_area := (v_entry ->> 'area')::public.area_kind;
    exception when invalid_text_representation then
      raise exception '%: "%" is not a known area. Use North, South, Caraga or N/A.',
        v_ctx, v_entry ->> 'area' using errcode = '22023';
    end;
    if v_position is null or v_area is null then
      raise exception '%: position and area are both required.', v_ctx using errcode = '22023';
    end if;

    if v_entry -> 'targets' is not null
       and jsonb_typeof(v_entry -> 'targets') not in ('object', 'null') then
      raise exception '%: targets are malformed.', v_ctx using errcode = '22023';
    end if;

    -- Who is this? An explicit match from the preview, then a remembered
    -- alias, then the person's own key. Otherwise they are new.
    begin
      v_explicit := nullif(v_entry ->> 'person_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception '%: the matched person id is not valid.', v_ctx using errcode = '22023';
    end;

    v_person_id := null;
    if v_explicit is not null then
      select coalesce(p.merged_into, p.id) into v_person_id from public.people p where p.id = v_explicit;
      if v_person_id is null then
        raise exception '%: the person this row was matched to no longer exists. Re-open the preview.',
          v_ctx using errcode = '22023';
      end if;
      if not exists (select 1 from public.people where id = v_person_id and name_key = v_key) then
        insert into public.person_aliases (name_key, person_id, created_by)
        values (v_key, v_person_id, auth.uid())
        on conflict (name_key) do update set person_id = excluded.person_id;
      end if;
    else
      select a.person_id into v_person_id from public.person_aliases a where a.name_key = v_key;
      if v_person_id is null then
        select coalesce(p.merged_into, p.id) into v_person_id from public.people p where p.name_key = v_key;
      end if;
    end if;

    if v_person_id is null then
      insert into public.people (last_name, first_name, name_key, position, area, first_seen_upload_id)
      values (v_last, v_first, v_key, v_position, v_area, v_upload_id)
      returning id into v_person_id;
      v_created := v_created + 1;
    elsif v_is_latest then
      update public.people
      set position = v_position, area = v_area, active = true
      where id = v_person_id
        and (position, area, active) is distinct from (v_position, v_area, true);
    end if;

    v_dupe_at := array_position(v_seen_ids, v_person_id);
    if v_dupe_at is not null then
      raise exception '% and % are the same person. Remove one row or undo the match.',
        v_seen_ctx[v_dupe_at], v_ctx using errcode = '22023';
    end if;
    v_seen_ids := v_seen_ids || v_person_id;
    v_seen_ctx := v_seen_ctx || v_ctx;

    insert into public.upload_people (
      upload_id, person_id, position, area, source_row, source_last_name, source_first_name,
      target_inhouse, target_ethical, target_combi, target_calls
    )
    values (
      v_upload_id, v_person_id, v_position, v_area,
      nullif(v_entry ->> 'source_row', '')::integer,
      v_last, v_first,
      app_private.read_centavos(v_entry -> 'targets', 'inhouse_centavos', v_ctx || ' target', false),
      app_private.read_centavos(v_entry -> 'targets', 'ethical_centavos', v_ctx || ' target', false),
      app_private.read_centavos(v_entry -> 'targets', 'combi_centavos', v_ctx || ' target', false),
      app_private.read_calls(v_entry -> 'targets', 'calls', v_ctx || ' target')
    );

    if jsonb_typeof(coalesce(v_entry -> 'months', '[]')) <> 'array' then
      raise exception '%: months are malformed.', v_ctx using errcode = '22023';
    end if;

    v_month_seen := '{}';
    for v_month in select m from jsonb_array_elements(coalesce(v_entry -> 'months', '[]')) as m loop
      begin
        v_month_no := (v_month ->> 'month')::integer;
      exception when others then
        v_month_no := null;
      end;
      if v_month_no is null or not (v_month_no = any (v_months)) then
        raise exception '%: month % is not one of the months with data.', v_ctx, v_month ->> 'month'
          using errcode = '22023';
      end if;
      if v_month_no = any (v_month_seen) then
        raise exception '%: month % is listed twice.', v_ctx, v_month_no using errcode = '22023';
      end if;
      v_month_seen := v_month_seen || v_month_no;

      insert into public.performance_rows (upload_id, person_id, month, inhouse, ethical, calls)
      values (
        v_upload_id, v_person_id, v_month_no,
        coalesce(app_private.read_centavos(v_month, 'inhouse_centavos', v_ctx, true), 0),
        coalesce(app_private.read_centavos(v_month, 'ethical_centavos', v_ctx, true), 0),
        coalesce(app_private.read_calls(v_month, 'calls', v_ctx), 0)
      );
    end loop;
  end loop;

  update public.uploads
  set is_current = false
  where period_year = v_year and period_quarter = v_quarter and is_current;

  update public.uploads set is_current = true where id = v_upload_id
  returning * into result;

  perform app_private.write_audit(
    'upload.commit', 'upload', v_upload_id::text,
    format('Uploaded %s for Q%s %s — version %s, %s %s', v_filename, v_quarter, v_year,
      v_version, jsonb_array_length(v_people),
      case when jsonb_array_length(v_people) = 1 then 'person' else 'people' end),
    jsonb_build_object(
      'period_year', v_year, 'period_quarter', v_quarter, 'version', v_version,
      'row_count', jsonb_array_length(v_people), 'new_people', v_created,
      'warning_count', jsonb_array_length(v_warnings), 'file_path', v_path
    )
  );

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- restore_upload — make an older version the current one. Nothing is copied
-- or deleted; the flag moves.
-- ---------------------------------------------------------------------------
create or replace function public.restore_upload(p_upload_id uuid)
returns public.uploads
language plpgsql
security definer
set search_path = public
as $$
declare
  target       public.uploads;
  prev_version integer;
  result       public.uploads;
begin
  if not public.has_permission('uploads.write') then
    raise exception 'You do not have permission to restore uploads.' using errcode = '42501';
  end if;

  select * into target from public.uploads where id = p_upload_id;
  if not found then
    raise exception 'That upload no longer exists.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('upload:' || target.period_year || ':' || target.period_quarter, 0)
  );

  if target.is_current then
    return target;
  end if;

  update public.uploads
  set is_current = false
  where period_year = target.period_year and period_quarter = target.period_quarter and is_current
  returning version into prev_version;

  update public.uploads set is_current = true where id = p_upload_id
  returning * into result;

  perform app_private.write_audit(
    'upload.restore', 'upload', p_upload_id::text,
    format('Restored version %s of Q%s %s%s', target.version, target.period_quarter,
      target.period_year, coalesce(format(' (replacing version %s)', prev_version), '')),
    jsonb_build_object(
      'period_year', target.period_year, 'period_quarter', target.period_quarter,
      'version', target.version, 'previous_version', prev_version
    )
  );

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- merge_people — the duplicate's history moves to the survivor, and its
-- spelling becomes an alias so the next workbook maps straight to the
-- survivor.
-- ---------------------------------------------------------------------------
create or replace function public.merge_people(p_keep uuid, p_merge uuid)
returns public.people
language plpgsql
security definer
set search_path = public
as $$
declare
  keeper    public.people;
  duplicate public.people;
  clash     record;
  moved     integer;
  result    public.people;
begin
  if not public.has_permission('people.write') then
    raise exception 'You do not have permission to merge people.' using errcode = '42501';
  end if;
  if p_keep is null or p_merge is null or p_keep = p_merge then
    raise exception 'Choose two different people to merge.' using errcode = '22023';
  end if;

  select * into keeper from public.people where id = p_keep for update;
  select * into duplicate from public.people where id = p_merge for update;
  if keeper.id is null or duplicate.id is null then
    raise exception 'One of those people no longer exists.' using errcode = '22023';
  end if;
  if keeper.merged_into is not null or duplicate.merged_into is not null then
    raise exception 'One of those people has already been merged into someone else.' using errcode = '22023';
  end if;

  -- Two rows in the same snapshot are, by definition, two different people.
  select u.period_year, u.period_quarter, u.version into clash
  from public.upload_people a
  join public.upload_people b on b.upload_id = a.upload_id and b.person_id = p_merge
  join public.uploads u on u.id = a.upload_id
  where a.person_id = p_keep
  limit 1;
  if found then
    raise exception '% % and % % both appear in the Q% % upload (version %), so they cannot be the same person.',
      keeper.first_name, keeper.last_name, duplicate.first_name, duplicate.last_name,
      clash.period_quarter, clash.period_year, clash.version
      using errcode = '22023';
  end if;

  perform set_config('app.bulk_write', 'on', true);

  -- performance_rows follow through ON UPDATE CASCADE.
  update public.upload_people set person_id = p_keep where person_id = p_merge;
  get diagnostics moved = row_count;

  -- Where both have a person target for the same quarter, the survivor's wins.
  delete from public.targets t
  where t.scope = 'person' and t.person_id = p_merge
    and exists (
      select 1 from public.targets k
      where k.scope = 'person' and k.person_id = p_keep
        and k.period_year = t.period_year and k.period_quarter = t.period_quarter
    );
  update public.targets set person_id = p_keep where scope = 'person' and person_id = p_merge;

  update public.person_aliases set person_id = p_keep where person_id = p_merge;
  insert into public.person_aliases (name_key, person_id, created_by)
  values (duplicate.name_key, p_keep, auth.uid())
  on conflict (name_key) do update set person_id = excluded.person_id;

  update public.people set merged_into = p_keep where merged_into = p_merge;
  update public.people set merged_into = p_keep, active = false, profile_id = null where id = p_merge;
  if keeper.profile_id is null and duplicate.profile_id is not null then
    update public.people set profile_id = duplicate.profile_id where id = p_keep;
  end if;

  select * into result from public.people where id = p_keep;

  perform app_private.write_audit(
    'person.merge', 'person', p_keep::text,
    format('Merged %s, %s into %s, %s', duplicate.last_name, duplicate.first_name,
      keeper.last_name, keeper.first_name),
    jsonb_build_object('kept', to_jsonb(keeper), 'merged', to_jsonb(duplicate), 'quarters_moved', moved)
  );

  return result;
end;
$$;

revoke execute on function public.commit_upload(jsonb) from public, anon;
revoke execute on function public.restore_upload(uuid) from public, anon;
revoke execute on function public.merge_people(uuid, uuid) from public, anon;
grant execute on function public.commit_upload(jsonb) to authenticated;
grant execute on function public.restore_upload(uuid) to authenticated;
grant execute on function public.merge_people(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: the original .xlsx of every upload, kept for audit
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workbooks', 'workbooks', false, 10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists workbooks_insert on storage.objects;
create policy workbooks_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'workbooks' and public.has_permission('uploads.write'));

drop policy if exists workbooks_select on storage.objects;
create policy workbooks_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'workbooks'
    and (public.has_permission('uploads.read') or public.has_permission('uploads.write'))
  );

-- ---------------------------------------------------------------------------
-- Realtime: cockpits and wall displays refetch when a quarter's current
-- version changes.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'uploads'
     ) then
    alter publication supabase_realtime add table public.uploads;
  end if;
end $$;
