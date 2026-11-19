import 'server-only';
import type { Profile, CourseSummary, Draft, Outline, Lesson, AttemptResult, CourseDocument } from './contracts';
import { sessionRepository } from './repository';
import { DomainError } from './errors';
import { createAdminClient } from './supabase/admin';
import { appUrl } from './env';

export type MutationResult<T> = { data: T; created: boolean };
async function rpc<T>(name: string, args: Record<string, unknown> = {}) { return (await sessionRepository()).call<T>(name, args); }
export const getMe = () => rpc<Profile>('api_me');
export const listCourses = () => rpc<CourseSummary[]>('api_courses');
export const getDraft = (courseId: string) => rpc<Draft>('api_get_draft', { p_course_id: courseId });
export const getOutline = (courseId: string) => rpc<Outline>('api_outline', { p_course_id: courseId });
export const getLesson = (courseId: string, lessonId: string) => rpc<Lesson>('api_lesson', { p_course_id: courseId, p_lesson_id: lessonId });
export const createCourse = (document: Pick<CourseDocument, 'title' | 'level' | 'audience'>) => rpc<{ courseId: string; revision: number }>('api_create_course', { p_document: { ...document, units: [] } });
export const saveDraft = (courseId: string, expectedRevision: number, document: CourseDocument) => rpc<{ revision: number }>('api_save_draft', { p_course_id: courseId, p_expected_revision: expectedRevision, p_document: document });
export const publishCourse = (courseId: string, expectedRevision: number) => rpc<MutationResult<{ releaseId: string }>>('api_publish', { p_course_id: courseId, p_expected_revision: expectedRevision });
export const enroll = (courseId: string, studentEmail: string) => rpc<MutationResult<{ enrollmentId: string; studentId: string; courseId: string }>>('api_enroll', { p_course_id: courseId, p_student_email: studentEmail });
export const submitAttempt = (courseId: string, lessonId: string, key: string, attempt: unknown) => rpc<MutationResult<AttemptResult>>('api_attempt', { p_course_id: courseId, p_lesson_id: lessonId, p_key: key, p_body: attempt });

export async function invite(input: { email: string; name: string; role: 'student' | 'teacher' }) {
  const repo = await sessionRepository();
  const me = await repo.call<Profile>('api_me');
  if (me.role !== 'admin') throw new DomainError(403, 'forbidden', 'Esta operación requiere administración.');
  // A unique database reservation serializes concurrent invitations before Auth sends mail.
  const admin = createAdminClient();
  const reservation = await repo.call<{ invitationId: string }>('api_reserve_invitation', { p_email: input.email, p_role: input.role });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { data: { name: input.name }, redirectTo: `${appUrl()}/auth/confirm` });
  if (error || !data.user) {
    await repo.call('api_finish_invitation', { p_invitation_id: reservation.invitationId, p_auth_user_id: null, p_error: 'auth_delivery_failed' });
    throw new DomainError(error?.status === 422 ? 409 : 502, 'invitation_failed', 'No se pudo enviar la invitación. Revisa el correo y la configuración de Auth.');
  }
  await repo.call('api_finish_invitation', { p_invitation_id: reservation.invitationId, p_auth_user_id: data.user.id, p_error: null });
  return { invitationId: reservation.invitationId, email: input.email, role: input.role, status: 'sent' as const };
}
