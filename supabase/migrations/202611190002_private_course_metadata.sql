-- courses contains mutable draft metadata. Students read publication snapshots.
-- Definer predicates keep publication RLS independent of the now-private row.
create function private.can_read_current_release(p_course uuid, p_release uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select private.enrolled(p_course) and exists(
    select 1 from public.courses c where c.id=p_course and c.current_release_id=p_release
  ); $$;

create function private.can_read_current_version(p_course uuid, p_version uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private as $$
  select private.enrolled(p_course) and exists(
    select 1 from public.courses c join public.release_lessons r on r.release_id=c.current_release_id
    where c.id=p_course and r.lesson_version_id=p_version
  ); $$;

revoke all on function private.can_read_current_release(uuid,uuid), private.can_read_current_version(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_read_current_release(uuid,uuid), private.can_read_current_version(uuid,uuid) to authenticated;

alter policy course_read on public.courses using(private.is_admin() or private.owns(id));
alter policy release_read on public.releases using(
  private.is_admin() or private.owns(course_id) or private.can_read_current_release(course_id,id)
);
alter policy version_read on public.lesson_versions using(
  private.owns(course_id) or private.can_read_current_version(course_id,id)
);

-- Revision shown to a student also belongs to the published snapshot.
create or replace function public.api_courses() returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare a public.profiles; result jsonb;
begin
  a:=private.actor();
  select coalesce(jsonb_agg(jsonb_build_object('courseId',c.id,'title',case when a.role='student' then r.title else c.title end,
    'level',case when a.role='student' then r.level else c.level end,'audience',case when a.role='student' then r.audience else c.audience end,
    'ownerId',c.owner_id,'published',c.current_release_id is not null,
    'revision',case when a.role='student' then r.revision else d.revision end,'releaseId',c.current_release_id)
    || case when a.role='student' then jsonb_build_object('progress',private.progress(c.id,a.id)) else '{}'::jsonb end order by c.created_at,c.id),'[]'::jsonb)
  into result from public.courses c join public.drafts d on d.course_id=c.id left join public.releases r on r.id=c.current_release_id
  where a.role='admin' or (a.role='teacher' and c.owner_id=a.id) or (a.role='student' and private.enrolled(c.id));
  return result;
end; $$;
