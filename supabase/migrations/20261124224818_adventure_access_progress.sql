-- The illustrated adventure is a protected practice course, separate from
-- authored/released courses. Completion records are practice progress, not grades.
create table private.adventure_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  changed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create function private.adventure_steps(p_mission_id text) returns text[]
language sql immutable set search_path = pg_catalog as $$
  select case p_mission_id
    when 'hello-explorer' then array[
      'adventure-begins','harbor-problem','greeting-world','meet-explorers',
      'ask-answer','whos-who','pronoun-detective','missing-word',
      'listening-challenge','reading-challenge','speaking-challenge',
      'explorer-card','activate-station','welcome-reward'
    ]::text[]
    when 'my-world' then array[
      'village-arrival','object-lab','a-or-an','this-or-that','object-detective',
      'label-village','whats-missing','my-place','rebuild-map'
    ]::text[]
    else null::text[] end;
$$;

create table private.adventure_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id text not null check (mission_id in ('hello-explorer','my-world')),
  step_id text not null,
  completed_at timestamptz not null default now(),
  primary key(user_id,mission_id,step_id),
  check (step_id = any(private.adventure_steps(mission_id)))
);

alter table private.adventure_access enable row level security;
alter table private.adventure_progress enable row level security;
revoke all on private.adventure_access, private.adventure_progress from public, anon, authenticated;

-- Initial rollout explicitly enables only the currently active teachers/students.
-- No trigger/default grants future accounts access; an administrator chooses it.
insert into private.adventure_access(user_id,enabled)
select id,true from public.profiles where active and role in ('teacher','student');

-- Privileged implementations live in the non-exposed schema. Each operation
-- authenticates against the trusted profile; user-editable Auth metadata is ignored.
create function private.adventure_actor() returns public.profiles
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; permitted boolean;
begin
  a:=private.actor();
  if a.role='admin' then return a; end if;
  -- A simultaneous revocation and progress write serialize on this grant row.
  select enabled into permitted from private.adventure_access where user_id=a.id for share;
  if a.role not in ('teacher','student') or permitted is distinct from true then
    perform private.fail(403,'adventure_forbidden','La administración aún no ha habilitado este curso para tu cuenta.');
  end if;
  return a;
end; $$;

create function private.get_adventure_access() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles;
begin
  a:=private.actor();
  return jsonb_build_object('allowed',a.role='admin' or exists(
    select 1 from private.adventure_access where user_id=a.id and enabled and a.role in ('teacher','student')
  ));
end; $$;

create function private.get_adventure_members() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  perform private.actor('admin');
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'email',p.email,'role',p.role,'active',p.active,'enabled',coalesce(a.enabled,false)
  ) order by lower(p.name),lower(p.email),p.id),'[]'::jsonb)
  from public.profiles p left join private.adventure_access a on a.user_id=p.id
  where p.role in ('teacher','student'));
end; $$;

create function private.set_adventure_access(p_user_id uuid,p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles;
begin
  a:=private.actor('admin');
  if p_enabled is null then perform private.fail(422,'validation_error','Indica si el acceso está habilitado.'); end if;
  perform 1 from public.profiles where id=p_user_id and role in ('teacher','student') for share;
  if not found then perform private.fail(404,'member_not_found','No se encontró la cuenta docente o estudiantil.'); end if;
  insert into private.adventure_access(user_id,enabled,changed_by) values(p_user_id,p_enabled,a.id)
    on conflict(user_id) do update set enabled=excluded.enabled,changed_by=excluded.changed_by,updated_at=now()
    where private.adventure_access.enabled is distinct from excluded.enabled;
  return jsonb_build_object('userId',p_user_id,'enabled',p_enabled);
end; $$;

create function private.get_adventure_progress(p_mission_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; steps text[]; completed jsonb;
begin
  a:=private.adventure_actor(); steps:=private.adventure_steps(p_mission_id);
  if steps is null then perform private.fail(422,'validation_error','La misión no es válida.'); end if;
  select coalesce(jsonb_agg(step_id order by array_position(steps,step_id)),'[]'::jsonb) into completed
    from private.adventure_progress where user_id=a.id and mission_id=p_mission_id;
  return jsonb_build_object('missionId',p_mission_id,'completedStepIds',completed);
end; $$;

create function private.set_adventure_progress(p_mission_id text,p_step_id text,p_completed boolean) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; steps text[];
begin
  a:=private.adventure_actor(); steps:=private.adventure_steps(p_mission_id);
  if steps is null or p_step_id is null or not (p_step_id=any(steps)) or p_completed is null then
    perform private.fail(422,'validation_error','La misión, la parada o su estado no son válidos.');
  end if;
  if p_completed then
    insert into private.adventure_progress(user_id,mission_id,step_id) values(a.id,p_mission_id,p_step_id)
      on conflict(user_id,mission_id,step_id) do nothing;
  else
    delete from private.adventure_progress where user_id=a.id and mission_id=p_mission_id and step_id=p_step_id;
  end if;
  return private.get_adventure_progress(p_mission_id);
end; $$;

create function private.reset_adventure_progress(p_mission_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles;
begin
  a:=private.adventure_actor();
  if private.adventure_steps(p_mission_id) is null then perform private.fail(422,'validation_error','La misión no es válida.'); end if;
  delete from private.adventure_progress where user_id=a.id and mission_id=p_mission_id;
  return jsonb_build_object('missionId',p_mission_id,'completedStepIds','[]'::jsonb);
end; $$;

-- Public RPC wrappers are invokers: only the explicit private entry points are
-- executable, and those check the actor before reading or changing private rows.
create function public.api_adventure_access() returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.get_adventure_access(); $$;
create function public.api_adventure_members() returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.get_adventure_members(); $$;
create function public.api_set_adventure_access(p_user_id uuid,p_enabled boolean) returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.set_adventure_access(p_user_id,p_enabled); $$;
create function public.api_adventure_progress(p_mission_id text) returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.get_adventure_progress(p_mission_id); $$;
create function public.api_set_adventure_progress(p_mission_id text,p_step_id text,p_completed boolean) returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.set_adventure_progress(p_mission_id,p_step_id,p_completed); $$;
create function public.api_reset_adventure_progress(p_mission_id text) returns jsonb
language sql security invoker set search_path = pg_catalog as $$ select private.reset_adventure_progress(p_mission_id); $$;

revoke all on function private.adventure_steps(text),private.adventure_actor(),
  private.get_adventure_access(),private.get_adventure_members(),private.set_adventure_access(uuid,boolean),
  private.get_adventure_progress(text),private.set_adventure_progress(text,text,boolean),private.reset_adventure_progress(text)
  from public,anon,authenticated;
grant execute on function private.get_adventure_access(),private.get_adventure_members(),private.set_adventure_access(uuid,boolean),
  private.get_adventure_progress(text),private.set_adventure_progress(text,text,boolean),private.reset_adventure_progress(text)
  to authenticated;
revoke all on function public.api_adventure_access(),public.api_adventure_members(),public.api_set_adventure_access(uuid,boolean),
  public.api_adventure_progress(text),public.api_set_adventure_progress(text,text,boolean),public.api_reset_adventure_progress(text)
  from public,anon,authenticated;
grant execute on function public.api_adventure_access(),public.api_adventure_members(),public.api_set_adventure_access(uuid,boolean),
  public.api_adventure_progress(text),public.api_set_adventure_progress(text,text,boolean),public.api_reset_adventure_progress(text)
  to authenticated;
