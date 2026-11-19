import { redirect } from "next/navigation";
import type { Profile, CourseSummary } from "@/lib/contracts";
import { getMe, listCourses } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { CreateCourse } from "@/components/dashboard-actions";
import { EditorialCourses } from "@/components/course-dashboard";

export default async function TeacherPage() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "teacher") redirect(roleHome(me.role));
  let courses: CourseSummary[];
  try { courses = await listCourses(); }
  catch (error) { return pageProblem(error); }
  return <><div className="page-heading"><div><h1>Tus cursos y publicaciones</h1><p>Prepara el material, revisa los objetivos y publica cuando esté listo.</p></div></div><CreateCourse /><EditorialCourses courses={courses} canEdit /></>;
}
