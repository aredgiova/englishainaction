import type { ReactNode } from "react";
import { getMe } from "@/lib/services";
import { AppShell } from "@/components/app-shell";
import { pageProblem } from "@/components/page-problem";
import type { Profile } from "@/lib/contracts";
export const dynamic = "force-dynamic";
export default async function AcademyLayout({ children }: { children: ReactNode }) {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  return <AppShell me={me}>{children}</AppShell>;
}
