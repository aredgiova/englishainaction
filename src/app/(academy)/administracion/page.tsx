import { redirect } from "next/navigation";
import type { Profile, CourseSummary } from "@/lib/contracts";
import { getMe, listCourses } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { Administration } from "@/components/dashboard-actions";
import { EditorialCourses } from "@/components/course-dashboard";

export default async function AdministrationPage() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "admin") redirect(roleHome(me.role));
  let courses: CourseSummary[];
  try { courses = await listCourses(); }
  catch (error) { return pageProblem(error); }
  return <><div className="page-heading"><div><h1>Administración de la academia</h1><p>Invita a las personas y conecta a cada estudiante con su curso.</p></div></div><Administration courses={courses} /><EditorialCourses courses={courses} canEdit={false} /></>;
}
