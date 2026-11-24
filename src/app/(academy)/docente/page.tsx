import { redirect } from "next/navigation";
import type { Profile, CourseSummary } from "@/lib/contracts";
import { getMe, listCourses } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { CreateCourse } from "@/components/dashboard-actions";
import { EditorialCourses } from "@/components/course-dashboard";
import { AdventureCatalog } from "@/components/adventure-catalog";
import { getAdventureAccess } from "@/lib/adventure-access";

export default async function TeacherPage() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "teacher") redirect(roleHome(me.role));
  let courses: CourseSummary[];
  let adventureAllowed: boolean;
  try { const [catalog, access] = await Promise.all([listCourses(), getAdventureAccess()]); courses = catalog; adventureAllowed = access.allowed; }
  catch (error) { return pageProblem(error); }
  return <><div className="page-heading"><div><h1>Tus cursos y publicaciones</h1><p>Explora las misiones y prepara tus clases.</p></div></div>{adventureAllowed && <AdventureCatalog />}<CreateCourse /><EditorialCourses courses={courses} canEdit /></>;
}
