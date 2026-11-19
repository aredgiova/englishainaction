-- English in Action, phase 1. Auth owns identity; these tables own authorization.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to authenticated,service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', email text not null,
  role text not null default 'student' check (role in ('admin','teacher','student')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index profiles_email_unique on public.profiles (lower(email));
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  title text not null, level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  audience text not null check (audience in ('school','university','professional')),
  current_release_id uuid,
  created_at timestamptz not null default now()
);
create table public.drafts (
  course_id uuid primary key references public.courses(id) on delete cascade,
  revision integer not null default 1 check (revision > 0), document jsonb not null,
  author_id uuid not null references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.releases (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
  revision integer not null, author_id uuid not null references public.profiles(id),
  title text not null, level text not null, audience text not null,
  created_at timestamptz not null default now(), unique(course_id,revision)
);
alter table public.courses add constraint course_current_release_fk foreign key(current_release_id) references public.releases(id);
create table public.lesson_versions (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
  lesson_id text not null, document jsonb not null,
  author_id uuid not null references public.profiles(id), draft_revision integer not null,
  created_at timestamptz not null default now()
);
create table private.answer_keys (
  lesson_version_id uuid primary key references public.lesson_versions(id), keys jsonb not null,
  course_id uuid not null references public.courses(id), lesson_id text not null,
  content_hash text not null, unique(course_id,lesson_id,content_hash)
);
-- Local bootstrap records are written in the same transaction as course creation.
-- This survives interruption without relying on a separate Auth metadata update.
create table private.seed_registry (
  seed_key text primary key,
  course_id uuid not null references public.courses(id)
);
create table public.release_lessons (
  release_id uuid not null references public.releases(id), lesson_id text not null,
  lesson_version_id uuid not null references public.lesson_versions(id),
  unit_id text not null, unit_title text not null, unit_position integer not null, lesson_position integer not null,
  primary key(release_id,lesson_id), unique(release_id,unit_position,lesson_position)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
  student_id uuid not null references public.profiles(id), created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), unique(course_id,student_id)
);
create table public.attempts (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id),
  student_id uuid not null references public.profiles(id), lesson_id text not null,
  lesson_version_id uuid not null references public.lesson_versions(id),
  idempotency_key text not null check(length(idempotency_key) between 8 and 128 and idempotency_key ~ '^[A-Za-z0-9._:-]+$'),
  request_hash text not null, request_body jsonb not null, response jsonb not null,
  created_at timestamptz not null default now(),
  unique(student_id,course_id,lesson_id,idempotency_key)
);
create index attempts_progress on public.attempts(student_id,course_id,lesson_version_id);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), email text not null,
  role text not null check(role in ('teacher','student')),
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  created_by uuid not null references public.profiles(id), auth_user_id uuid references auth.users(id),
  error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index invitation_one_open_email on public.invitations(lower(email)) where status in ('pending','sent');

create function private.fail(p_status integer, p_code text, p_message text) returns void
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode='P0001', message=jsonb_build_object('status',p_status,'code',p_code,'message',p_message)::text;
end; $$;

create function private.actor(p_role text default null) returns public.profiles
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v public.profiles;
begin
  if auth.uid() is null then perform private.fail(401,'unauthenticated','Inicia sesión para continuar.'); end if;
  select * into v from public.profiles where id=auth.uid();
  if v.id is null or not v.active then perform private.fail(403,'account_inactive','La cuenta no está activa.'); end if;
  if p_role is not null and v.role<>p_role then perform private.fail(403,'forbidden','Tu rol no permite esta operación.'); end if;
  return v;
end; $$;

create function private.handle_auth_user() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- User-controlled raw metadata can supply a display name, never a role.
  insert into public.profiles(id,name,email,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',''),new.email,'student');
  return new;
end; $$;
create trigger auth_user_profile after insert on auth.users for each row execute function private.handle_auth_user();

create function private.immutable() returns trigger language plpgsql set search_path = pg_catalog as $$
begin raise exception 'Published records and attempts are immutable'; end; $$;
create trigger release_immutable before update or delete on public.releases for each row execute function private.immutable();
create trigger version_immutable before update or delete on public.lesson_versions for each row execute function private.immutable();
create trigger release_lesson_immutable before update or delete on public.release_lessons for each row execute function private.immutable();
create trigger key_immutable before update or delete on private.answer_keys for each row execute function private.immutable();
create trigger attempt_immutable before update or delete on public.attempts for each row execute function private.immutable();

-- SECURITY DEFINER predicates avoid RLS recursion; they reveal only access booleans.
create function private.is_admin() returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active and role='admin'); $$;
create function private.owns(p_course uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.courses c join public.profiles p on p.id=c.owner_id where c.id=p_course and p.id=auth.uid() and p.active and p.role='teacher'); $$;
create function private.enrolled(p_course uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select exists(select 1 from public.enrollments e join public.profiles p on p.id=e.student_id join public.courses c on c.id=e.course_id
    where e.course_id=p_course and e.student_id=auth.uid() and p.active and p.role='student' and c.current_release_id is not null); $$;
create function private.can_read_course(p_course uuid) returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select private.is_admin() or private.owns(p_course) or private.enrolled(p_course); $$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.drafts enable row level security;
alter table public.releases enable row level security;
alter table public.lesson_versions enable row level security;
alter table private.answer_keys enable row level security;
alter table private.seed_registry enable row level security;
alter table public.release_lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.attempts enable row level security;
alter table public.invitations enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or private.is_admin());
create policy course_read on public.courses for select to authenticated using(private.can_read_course(id));
create policy draft_read on public.drafts for select to authenticated using(private.owns(course_id));
create policy release_read on public.releases for select to authenticated using(private.is_admin() or private.owns(course_id) or
  (private.enrolled(course_id) and exists(select 1 from public.courses c where c.current_release_id=releases.id)));
create policy version_read on public.lesson_versions for select to authenticated using(private.owns(course_id) or
  (private.enrolled(course_id) and exists(select 1 from public.courses c join public.release_lessons r on r.release_id=c.current_release_id where c.id=course_id and r.lesson_version_id=lesson_versions.id)));
create policy release_lesson_read on public.release_lessons for select to authenticated using(exists(select 1 from public.releases r where r.id=release_id));
create policy enrollment_read on public.enrollments for select to authenticated using(student_id=auth.uid() or private.is_admin() or private.owns(course_id));
create policy attempt_read on public.attempts for select to authenticated using(student_id=auth.uid());
create policy invitation_read on public.invitations for select to authenticated using(private.is_admin());
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles,public.courses,public.drafts,public.releases,public.lesson_versions,public.release_lessons,public.enrollments,public.attempts,public.invitations to authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
-- Administrative server credentials are never shipped to browsers.
grant all on all tables in schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

create function private.only_keys(p_object jsonb,p_keys text[]) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p_object)='object' then not exists(select 1 from jsonb_object_keys(p_object) k where not k=any(p_keys)) else false end; $$;
create function private.valid_id(p_id jsonb) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(jsonb_typeof(p_id)='string' and length(p_id#>>'{}') between 1 and 80 and (p_id#>>'{}') ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$',false); $$;
create function private.nonblank(p_text text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select coalesce(p_text ~ '[^[:space:]]',false); $$;

create function private.check_document(p_doc jsonb,p_publish boolean) returns void
language plpgsql set search_path = pg_catalog, public, private as $$
declare u jsonb; l jsonb; b jsonb; a jsonb; o jsonb; units text[] := '{}'; lessons text[] := '{}'; ids text[]; opts text[]; block_ids text[]; required_count integer;
begin
  if not private.only_keys(p_doc,array['title','level','audience','units']) then perform private.fail(422,'validation_error','El documento contiene campos no admitidos.'); end if;
  if jsonb_typeof(p_doc) is distinct from 'object' or jsonb_typeof(p_doc->'title') is distinct from 'string'
    or length(p_doc->>'title')>200 or (p_doc->>'level') not in ('A1','A2','B1','B2','C1','C2')
    or p_doc->>'level' is null or (p_doc->>'audience') not in ('school','university','professional')
    or p_doc->>'audience' is null or jsonb_typeof(p_doc->'units') is distinct from 'array' then
    perform private.fail(422,'validation_error','El documento necesita título, nivel, público y unidades válidos.');
  end if;
  if pg_column_size(p_doc)>1048576 or jsonb_array_length(p_doc->'units')>100 then perform private.fail(422,'validation_error','El borrador excede el tamaño máximo.'); end if;
  if p_publish and (not private.nonblank(p_doc->>'title') or jsonb_array_length(p_doc->'units')=0) then
    perform private.fail(422,'invalid_publication','Añade un título y al menos una unidad.'); end if;
  for u in select value from jsonb_array_elements(p_doc->'units') loop
    if not private.only_keys(u,array['id','title','lessons']) or not private.valid_id(u->'id') or (u->>'id')=any(units)
      or jsonb_typeof(u->'title') is distinct from 'string' or jsonb_typeof(u->'lessons') is distinct from 'array' then
      perform private.fail(422,'validation_error','Las unidades necesitan identificadores únicos, título y lecciones.'); end if;
    units:=array_append(units,u->>'id');
    if length(u->>'title')>200 or jsonb_array_length(u->'lessons')>100 then perform private.fail(422,'validation_error','La unidad excede el tamaño máximo.'); end if;
    if p_publish and (not private.nonblank(u->>'title') or jsonb_array_length(u->'lessons')=0) then perform private.fail(422,'invalid_publication','Cada unidad necesita título y una lección completa.'); end if;
    for l in select value from jsonb_array_elements(u->'lessons') loop
      if not private.only_keys(l,array['id','title','objective','blocks','activities']) or not private.valid_id(l->'id') or (l->>'id')=any(lessons)
        or jsonb_typeof(l->'title') is distinct from 'string' or jsonb_typeof(l->'objective') is distinct from 'string'
        or jsonb_typeof(l->'blocks') is distinct from 'array' or jsonb_typeof(l->'activities') is distinct from 'array' then
        perform private.fail(422,'validation_error','Las lecciones necesitan identificadores únicos, título, objetivo, bloques y actividades.'); end if;
      lessons:=array_append(lessons,l->>'id');
      if length(l->>'title')>200 or length(l->>'objective')>4000 or jsonb_array_length(l->'blocks')>100 or jsonb_array_length(l->'activities')>100 then perform private.fail(422,'validation_error','La lección excede el tamaño máximo.'); end if;
      if p_publish and (not private.nonblank(l->>'title') or not private.nonblank(l->>'objective') or jsonb_array_length(l->'blocks')=0 or jsonb_array_length(l->'activities')=0) then
        perform private.fail(422,'invalid_publication','Cada lección necesita título, objetivo, contenido y práctica.'); end if;
      block_ids:='{}';
      for b in select value from jsonb_array_elements(l->'blocks') loop
        if not private.only_keys(b,array['id','type','text']) or b->>'type' is distinct from 'text' or not private.valid_id(b->'id') or (b->>'id')=any(block_ids) or jsonb_typeof(b->'text') is distinct from 'string' or length(b->>'text')>20000 then
          perform private.fail(422,'validation_error','El bloque de texto no es válido.'); end if;
        block_ids:=array_append(block_ids,b->>'id');
        if p_publish and not private.nonblank(b->>'text') then perform private.fail(422,'invalid_publication','Completa el contenido de la lección.'); end if;
      end loop;
      ids:='{}'; required_count:=0;
      for a in select value from jsonb_array_elements(l->'activities') loop
        if not private.only_keys(a,array['id','type','required','prompt','options','correctOptionId','feedback']) or a->>'type' is distinct from 'choice' or not private.valid_id(a->'id') or (a->>'id')=any(ids)
          or jsonb_typeof(a->'prompt') is distinct from 'string' or jsonb_typeof(a->'required') is distinct from 'boolean'
          or jsonb_typeof(a->'options') is distinct from 'array' or jsonb_typeof(a->'correctOptionId') is distinct from 'string'
          or jsonb_typeof(a->'feedback') is distinct from 'object' or jsonb_typeof(a->'feedback'->'correct') is distinct from 'string'
          or jsonb_typeof(a->'feedback'->'incorrect') is distinct from 'string' then
          perform private.fail(422,'validation_error','La actividad de opción única no es válida.'); end if;
        if not private.only_keys(a->'feedback',array['correct','incorrect']) or length(a->>'prompt')>4000 or length(a->>'correctOptionId')>80 or length(a->'feedback'->>'correct')>2000 or length(a->'feedback'->>'incorrect')>2000 or jsonb_array_length(a->'options')>20 then
          perform private.fail(422,'validation_error','La actividad excede los límites o contiene campos no admitidos.'); end if;
        ids:=array_append(ids,a->>'id'); opts:='{}';
        for o in select value from jsonb_array_elements(a->'options') loop
          if not private.only_keys(o,array['id','text']) or not private.valid_id(o->'id') or (o->>'id')=any(opts) or jsonb_typeof(o->'text') is distinct from 'string' or length(o->>'text')>2000 then
            perform private.fail(422,'validation_error','Las opciones necesitan identificadores únicos y texto.'); end if;
          opts:=array_append(opts,o->>'id');
          if p_publish and not private.nonblank(o->>'text') then perform private.fail(422,'invalid_publication','Completa cada opción.'); end if;
        end loop;
        if (a->>'required')::boolean then required_count:=required_count+1; end if;
        if p_publish and (not private.nonblank(a->>'prompt') or cardinality(opts)<2 or not (a->>'correctOptionId')=any(opts)
          or not private.nonblank(a->'feedback'->>'correct') or not private.nonblank(a->'feedback'->>'incorrect')) then
          perform private.fail(422,'invalid_publication','Completa las opciones, la solución y el feedback de cada actividad.'); end if;
      end loop;
      if p_publish and required_count=0 then perform private.fail(422,'invalid_publication','Cada lección necesita una actividad obligatoria.'); end if;
    end loop;
  end loop;
end; $$;

create function private.progress(p_course uuid,p_student uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  with current_lessons as (
    select r.lesson_id,r.unit_position,r.lesson_position,
      exists(select 1 from public.attempts a where a.student_id=p_student and a.course_id=p_course and a.lesson_version_id=r.lesson_version_id) completed
    from public.courses c join public.release_lessons r on r.release_id=c.current_release_id where c.id=p_course
  ) select jsonb_build_object('completed',count(*) filter(where completed),'total',count(*),
    'nextLessonId',(select lesson_id from current_lessons where not completed order by unit_position,lesson_position limit 1)) from current_lessons; $$;

create function public.api_me() returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; begin a:=private.actor(); return jsonb_build_object('id',a.id,'name',a.name,'email',a.email,'role',a.role); end; $$;

create function public.api_courses() returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; result jsonb;
begin
  a:=private.actor();
  select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'title',case when a.role='student' then r.title else c.title end,
    'level',case when a.role='student' then r.level else c.level end,'audience',case when a.role='student' then r.audience else c.audience end,
    'ownerId',c.owner_id,'published',c.current_release_id is not null,'revision',d.revision,'releaseId',c.current_release_id)
    || case when a.role='student' then jsonb_build_object('progress',private.progress(c.id,a.id)) else '{}'::jsonb end order by c.created_at,c.id),'[]'::jsonb)
  into result from public.courses c join public.drafts d on d.course_id=c.id left join public.releases r on r.id=c.current_release_id
  where a.role='admin' or (a.role='teacher' and c.owner_id=a.id) or (a.role='student' and private.enrolled(c.id));
  return result;
end; $$;

create function public.api_create_course(p_document jsonb) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; c uuid; doc jsonb;
begin
  a:=private.actor('teacher'); doc:=p_document||jsonb_build_object('units',coalesce(p_document->'units','[]'::jsonb));
  perform private.check_document(doc,false);
  if not private.nonblank(doc->>'title') then perform private.fail(422,'validation_error','Escribe el título del curso.'); end if;
  insert into public.courses(owner_id,title,level,audience) values(a.id,doc->>'title',doc->>'level',doc->>'audience') returning id into c;
  insert into public.drafts(course_id,document,author_id) values(c,doc,a.id);
  return jsonb_build_object('courseId',c,'revision',1);
end; $$;

create function public.api_get_draft(p_course_id uuid) returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; d public.drafts;
begin
  a:=private.actor('teacher');
  if not private.owns(p_course_id) then perform private.fail(404,'not_found','No se encontró el curso.'); end if;
  select * into d from public.drafts where course_id=p_course_id;
  return jsonb_build_object('courseId',p_course_id,'revision',d.revision,'document',d.document);
end; $$;

create function public.api_save_draft(p_course_id uuid,p_expected_revision integer,p_document jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; d public.drafts;
begin
  a:=private.actor('teacher');
  perform 1 from public.courses where id=p_course_id and owner_id=a.id for update;
  if not found then perform private.fail(404,'not_found','No se encontró el curso.'); end if;
  select * into d from public.drafts where course_id=p_course_id for update;
  if p_expected_revision is distinct from d.revision then perform private.fail(409,'revision_conflict','El borrador cambió. Recarga antes de guardar.'); end if;
  perform private.check_document(p_document,false);
  update public.drafts set document=p_document,revision=revision+1,author_id=a.id,updated_at=now() where course_id=p_course_id;
  update public.courses set title=p_document->>'title',level=p_document->>'level',audience=p_document->>'audience' where id=p_course_id;
  return jsonb_build_object('revision',d.revision+1);
end; $$;

create function public.api_publish(p_course_id uuid,p_expected_revision integer) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; d public.drafts; release_id uuid; version_id uuid; u jsonb; l jsonb; unit_pos integer:=0; lesson_pos integer;
  safe_blocks jsonb; safe_activities jsonb; keys jsonb; v_content_hash text;
begin
  a:=private.actor('teacher');
  perform 1 from public.courses where id=p_course_id and owner_id=a.id for update;
  if not found then perform private.fail(404,'not_found','No se encontró el curso.'); end if;
  -- Repeating an already-published revision is safe even after later draft edits.
  select r.id into release_id from public.releases r where r.course_id=p_course_id and r.revision=p_expected_revision;
  if found then return jsonb_build_object('data',jsonb_build_object('releaseId',release_id),'created',false); end if;
  select * into d from public.drafts where course_id=p_course_id for update;
  if d.revision is distinct from p_expected_revision then perform private.fail(409,'revision_conflict','La revisión solicitada ya no es el borrador vigente.'); end if;
  perform private.check_document(d.document,true);
  insert into public.releases(course_id,revision,author_id,title,level,audience)
    values(p_course_id,d.revision,a.id,d.document->>'title',d.document->>'level',d.document->>'audience') returning id into release_id;
  for u in select value from jsonb_array_elements(d.document->'units') loop
    unit_pos:=unit_pos+1; lesson_pos:=0;
    for l in select value from jsonb_array_elements(u->'lessons') loop
      lesson_pos:=lesson_pos+1; v_content_hash:=encode(sha256(convert_to(l::text,'UTF8')),'hex');
      select k.lesson_version_id into version_id from private.answer_keys k where k.course_id=p_course_id and k.lesson_id=l->>'id' and k.content_hash=v_content_hash;
      if not found then
        select jsonb_agg(jsonb_build_object('id',b->>'id','type','text','text',b->>'text')) into safe_blocks from jsonb_array_elements(l->'blocks') b;
        select jsonb_agg(jsonb_build_object('id',x->>'id','type','choice','prompt',x->>'prompt','required',x->'required',
          'options',(select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text')) from jsonb_array_elements(x->'options') o))),
          jsonb_agg(jsonb_build_object('activityId',x->>'id','correctOptionId',x->>'correctOptionId','feedback',x->'feedback'))
          into safe_activities,keys from jsonb_array_elements(l->'activities') x;
        insert into public.lesson_versions(course_id,lesson_id,document,author_id,draft_revision)
          values(p_course_id,l->>'id',jsonb_build_object('id',l->>'id','title',l->>'title','objective',l->>'objective','blocks',safe_blocks,'activities',safe_activities),a.id,d.revision)
          returning id into version_id;
        insert into private.answer_keys(lesson_version_id,keys,course_id,lesson_id,content_hash) values(version_id,keys,p_course_id,l->>'id',v_content_hash);
      end if;
      insert into public.release_lessons(release_id,lesson_id,lesson_version_id,unit_id,unit_title,unit_position,lesson_position)
        values(release_id,l->>'id',version_id,u->>'id',u->>'title',unit_pos,lesson_pos);
    end loop;
  end loop;
  update public.courses set current_release_id=release_id where id=p_course_id;
  return jsonb_build_object('data',jsonb_build_object('releaseId',release_id),'created',true);
end; $$;

create function public.api_enroll(p_course_id uuid,p_student_email text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; s public.profiles; enrollment_id uuid; made boolean;
begin
  a:=private.actor('admin');
  perform 1 from public.courses where id=p_course_id and current_release_id is not null for update;
  if not found then perform private.fail(404,'not_found','No se encontró un curso publicado.'); end if;
  select p.* into s from public.profiles p join auth.users u on u.id=p.id
    where lower(p.email)=lower(btrim(p_student_email)) and p.active and p.role='student' and u.email_confirmed_at is not null;
  if not found then perform private.fail(404,'student_not_found','No se encontró una cuenta estudiantil activa.'); end if;
  insert into public.enrollments(course_id,student_id,created_by) values(p_course_id,s.id,a.id) on conflict(course_id,student_id) do nothing returning id into enrollment_id;
  made:=found;
  if not made then select e.id into enrollment_id from public.enrollments e where e.course_id=p_course_id and e.student_id=s.id; end if;
  return jsonb_build_object('data',jsonb_build_object('enrollmentId',enrollment_id,'courseId',p_course_id,'studentId',s.id),'created',made);
end; $$;

create function public.api_outline(p_course_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; r public.releases; units jsonb;
begin
  a:=private.actor('student');
  if not private.enrolled(p_course_id) then perform private.fail(404,'not_found','No se encontró el curso.'); end if;
  select x.* into r from public.courses c join public.releases x on x.id=c.current_release_id where c.id=p_course_id;
  select jsonb_agg(jsonb_build_object('id',q.unit_id,'title',q.unit_title,'lessons',q.lessons) order by q.unit_position) into units from (
    select rl.unit_id,rl.unit_title,rl.unit_position,jsonb_agg(jsonb_build_object('id',rl.lesson_id,'title',v.document->>'title','lessonVersionId',v.id,
      'completed',exists(select 1 from public.attempts t where t.student_id=a.id and t.course_id=p_course_id and t.lesson_version_id=v.id)) order by rl.lesson_position) lessons
    from public.release_lessons rl join public.lesson_versions v on v.id=rl.lesson_version_id where rl.release_id=r.id group by rl.unit_id,rl.unit_title,rl.unit_position
  ) q;
  return jsonb_build_object('courseId',p_course_id,'title',r.title,'level',r.level,'audience',r.audience,'releaseId',r.id,'units',units,'courseProgress',private.progress(p_course_id,a.id));
end; $$;

create function public.api_lesson(p_course_id uuid,p_lesson_id text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; v public.lesson_versions;
begin
  a:=private.actor('student');
  if not private.enrolled(p_course_id) then perform private.fail(404,'not_found','No se encontró la lección.'); end if;
  select x.* into v from public.courses c join public.release_lessons r on r.release_id=c.current_release_id join public.lesson_versions x on x.id=r.lesson_version_id where c.id=p_course_id and r.lesson_id=p_lesson_id;
  if not found then perform private.fail(404,'not_found','No se encontró la lección.'); end if;
  return (v.document-'id')||jsonb_build_object('courseId',p_course_id,'lessonId',p_lesson_id,'lessonVersionId',v.id);
end; $$;

create function public.api_attempt(p_course_id uuid,p_lesson_id text,p_key text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; previous public.attempts; v public.lesson_versions; keys jsonb; answer jsonb; activity jsonb; key jsonb;
  seen text[]:='{}'; correct integer:=0; total integer:=0; ok boolean; items jsonb:='[]'; result jsonb; attempt_id uuid:=gen_random_uuid(); progress jsonb;
begin
  a:=private.actor('student');
  if p_key is null or length(p_key) not between 8 and 128 or p_key !~ '^[A-Za-z0-9._:-]+$' then perform private.fail(422,'validation_error','Envía una Idempotency-Key válida.'); end if;
  -- Course lock serializes publication and submissions, including duplicate retries.
  perform 1 from public.courses where id=p_course_id for update;
  select * into previous from public.attempts where student_id=a.id and course_id=p_course_id and lesson_id=p_lesson_id and idempotency_key=p_key;
  if found then
    if previous.request_body is distinct from p_body then perform private.fail(409,'idempotency_conflict','La clave ya se utilizó con otro contenido.'); end if;
    return jsonb_build_object('data',previous.response,'created',false);
  end if;
  if not private.enrolled(p_course_id) then perform private.fail(404,'not_found','No se encontró la lección.'); end if;
  if jsonb_typeof(p_body) is distinct from 'object' or jsonb_typeof(p_body->'lessonVersionId') is distinct from 'string' or jsonb_typeof(p_body->'answers') is distinct from 'array'
    or exists(select 1 from jsonb_object_keys(p_body) k where k not in ('lessonVersionId','answers')) then
    perform private.fail(422,'validation_error','Envía la versión y las respuestas de la lección.'); end if;
  if (p_body->>'lessonVersionId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or jsonb_array_length(p_body->'answers')>100 then perform private.fail(422,'validation_error','La versión o la cantidad de respuestas no es válida.'); end if;
  select x.* into v from public.courses c join public.release_lessons r on r.release_id=c.current_release_id join public.lesson_versions x on x.id=r.lesson_version_id where c.id=p_course_id and r.lesson_id=p_lesson_id;
  if not found then perform private.fail(404,'not_found','No se encontró la lección.'); end if;
  if v.id is distinct from (p_body->>'lessonVersionId')::uuid then perform private.fail(409,'lesson_changed','La lección cambió. Recarga su versión vigente.'); end if;
  select k.keys into keys from private.answer_keys k where k.lesson_version_id=v.id;
  for answer in select value from jsonb_array_elements(p_body->'answers') loop
    if jsonb_typeof(answer) is distinct from 'object' or jsonb_typeof(answer->'activityId') is distinct from 'string' or jsonb_typeof(answer->'optionId') is distinct from 'string'
      or exists(select 1 from jsonb_object_keys(answer) k where k not in ('activityId','optionId')) or answer->>'activityId'=any(seen) then
      perform private.fail(422,'validation_error','Envía una respuesta única y válida por actividad.'); end if;
    select x into activity from jsonb_array_elements(v.document->'activities') x where x->>'id'=answer->>'activityId';
    if not found or not exists(select 1 from jsonb_array_elements(activity->'options') o where o->>'id'=answer->>'optionId') then perform private.fail(422,'validation_error','La actividad o la opción no pertenece a esta lección.'); end if;
    seen:=array_append(seen,answer->>'activityId');
  end loop;
  for activity in select value from jsonb_array_elements(v.document->'activities') loop
    if (activity->>'required')::boolean and not (activity->>'id')=any(seen) then perform private.fail(422,'validation_error','Responde todas las actividades obligatorias.'); end if;
    select x into answer from jsonb_array_elements(p_body->'answers') x where x->>'activityId'=activity->>'id';
    if found then
      select x into key from jsonb_array_elements(keys) x where x->>'activityId'=activity->>'id';
      ok:=answer->>'optionId'=key->>'correctOptionId'; total:=total+1; if ok then correct:=correct+1; end if;
      items:=items||jsonb_build_array(jsonb_build_object('activityId',activity->>'id','correct',ok,'feedback',key->'feedback'->>case when ok then 'correct' else 'incorrect' end));
    end if;
  end loop;
  -- Compute the committed snapshot including this valid submission, irrespective of score.
  with current_lessons as (
    select rl.lesson_id,rl.unit_position,rl.lesson_position,rl.lesson_version_id=v.id or exists(select 1 from public.attempts t where t.student_id=a.id and t.course_id=p_course_id and t.lesson_version_id=rl.lesson_version_id) completed
    from public.courses c join public.release_lessons rl on rl.release_id=c.current_release_id where c.id=p_course_id
  ) select jsonb_build_object('completed',count(*) filter(where completed),'total',count(*),'nextLessonId',(select lesson_id from current_lessons where not completed order by unit_position,lesson_position limit 1)) into progress from current_lessons;
  result:=jsonb_build_object('attemptId',attempt_id,'score',jsonb_build_object('correct',correct,'total',total),'items',items,'courseProgress',progress);
  insert into public.attempts(id,course_id,student_id,lesson_id,lesson_version_id,idempotency_key,request_hash,request_body,response)
    values(attempt_id,p_course_id,a.id,p_lesson_id,v.id,p_key,encode(sha256(convert_to(p_body::text,'UTF8')),'hex'),p_body,result);
  return jsonb_build_object('data',result,'created',true);
end; $$;

create function public.api_reserve_invitation(p_email text,p_role text) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; invitation_id uuid; v_email text:=lower(btrim(p_email));
begin
  a:=private.actor('admin');
  if p_role is null or p_role not in ('student','teacher') or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 then perform private.fail(422,'validation_error','Revisa el correo y el rol de la invitación.'); end if;
  if exists(select 1 from public.profiles p where lower(p.email)=v_email) then perform private.fail(409,'account_exists','Ya existe una cuenta con este correo.'); end if;
  begin
    insert into public.invitations(email,role,created_by) values(v_email,p_role,a.id) returning id into invitation_id;
  exception when unique_violation then perform private.fail(409,'invitation_pending','Ya existe una invitación para este correo.'); end;
  return jsonb_build_object('invitationId',invitation_id,'email',v_email,'role',p_role,'status','pending');
end; $$;

create function public.api_finish_invitation(p_invitation_id uuid,p_auth_user_id uuid,p_error text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; invitation public.invitations;
begin
  a:=private.actor('admin');
  select * into invitation from public.invitations where id=p_invitation_id and created_by=a.id for update;
  if not found then perform private.fail(404,'not_found','No se encontró la invitación.'); end if;
  if invitation.status='sent' and invitation.auth_user_id=p_auth_user_id and p_error is null then
    return jsonb_build_object('invitationId',invitation.id,'email',invitation.email,'role',invitation.role,'status','sent'); end if;
  if invitation.status<>'pending' then perform private.fail(409,'invitation_finished','La invitación ya se procesó.'); end if;
  if p_error is not null then
    update public.invitations set status='failed',error=left(p_error,500),updated_at=now() where id=invitation.id;
    return jsonb_build_object('invitationId',invitation.id,'email',invitation.email,'role',invitation.role,'status','failed');
  end if;
  if not exists(select 1 from auth.users u where u.id=p_auth_user_id and lower(u.email)=invitation.email) then perform private.fail(422,'invitation_mismatch','La identidad no corresponde a la invitación.'); end if;
  update public.profiles set role=invitation.role,active=true where id=p_auth_user_id and lower(email)=invitation.email;
  if not found then perform private.fail(422,'invitation_mismatch','No se encontró el perfil de la invitación.'); end if;
  update public.invitations set status='sent',auth_user_id=p_auth_user_id,updated_at=now() where id=invitation.id;
  return jsonb_build_object('invitationId',invitation.id,'email',invitation.email,'role',invitation.role,'status','sent');
end; $$;

-- Definer helpers are not callable from PostgREST; only narrow authenticated RPCs are exposed.
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_admin(),private.owns(uuid),private.enrolled(uuid),private.can_read_course(uuid) to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.api_me(),public.api_courses(),public.api_create_course(jsonb),public.api_get_draft(uuid),public.api_save_draft(uuid,integer,jsonb),public.api_publish(uuid,integer),public.api_enroll(uuid,text),public.api_outline(uuid),public.api_lesson(uuid,text),public.api_attempt(uuid,text,text,jsonb),public.api_reserve_invitation(text,text),public.api_finish_invitation(uuid,uuid,text) to authenticated;
grant execute on all functions in schema public to service_role;


