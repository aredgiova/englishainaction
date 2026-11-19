import { redirect } from "next/navigation";
import type { Profile, CourseSummary, Outline } from "@/lib/contracts";
import { getMe, listCourses, getOutline } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { NextLesson, StudentCourses } from "@/components/course-dashboard";

export default async function CampusPage() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "student") redirect(roleHome(me.role));
  let courses: CourseSummary[];
  let nextOutline: Outline | undefined;
  try {
    courses = await listCourses();
    const inProgress = courses.find(course => course.progress && course.progress.completed > 0 && course.progress.nextLessonId);
    const nextCourse = inProgress ?? courses.find(course => course.progress?.nextLessonId);
    if (nextCourse) nextOutline = await getOutline(nextCourse.courseId);
  } catch (error) { return pageProblem(error); }
  return (
    <>
      <div className="page-heading"><div><h1>Tu campus, {me.name.split(" ")[0]}</h1><p>Un siguiente paso claro para seguir practicando inglés.</p></div></div>
      {nextOutline && <NextLesson outline={nextOutline} />}
      <StudentCourses courses={courses} />
      <p className="learning-note">Completar una lección cuenta para tu avance, incluso cuando hay errores. Los aciertos se muestran por separado para ayudarte a aprender.</p>
    </>
  );
}
