import { redirect } from "next/navigation";
import type { Profile, CourseSummary } from "@/lib/contracts";
import { getMe, listCourses } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { Administration } from "@/components/dashboard-actions";
import { EditorialCourses } from "@/components/course-dashboard";
import { AdventureCatalog } from "@/components/adventure-catalog";
import { AdventureAccessManager } from "@/components/adventure-access-manager";
import { getAdventureMembers } from "@/lib/adventure-access";
import type { AdventureMember } from "@/lib/adventure-access-contracts";
import styles from "@/components/adventure-catalog.module.css";

export default async function AdministrationPage() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "admin") redirect(roleHome(me.role));
  let courses: CourseSummary[];
  let members: AdventureMember[];
  try { [courses, members] = await Promise.all([listCourses(), getAdventureMembers()]); }
  catch (error) { return pageProblem(error); }
  return <><div className="page-heading"><div><h1>Administración de la academia</h1><p>Los cursos y las personas, en un solo lugar.</p></div></div><AdventureCatalog administrator /><AdventureAccessManager initialMembers={members} /><details open className={styles.more}><summary>Cuentas y otros cursos</summary><Administration courses={courses} /><EditorialCourses courses={courses} canEdit={false} /></details></>;
}
