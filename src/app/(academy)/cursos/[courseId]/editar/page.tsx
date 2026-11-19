import { getDraft, getMe } from "@/lib/services";
import { redirect } from "next/navigation";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { CourseEditor } from "@/components/course-editor";
import { BackLink } from "@/components/ui";
import type { Draft, Profile } from "@/lib/contracts";

export default async function EditCourse({ params }: { params: Promise<{ courseId: string }> }) {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "teacher") redirect(roleHome(me.role));
  let draft: Draft;
  try { const { courseId } = await params; draft = await getDraft(courseId); }
  catch (error) { return pageProblem(error); }
  return <><BackLink href="/docente">Mis cursos y borradores</BackLink><div className="page-heading"><div><h1>Preparar el curso</h1><p>Guarda tus ideas y publica una versión completa cuando esté lista.</p></div></div><CourseEditor key={`${me.id}:${draft.courseId}`} initial={draft} authorId={me.id} /></>;
}
