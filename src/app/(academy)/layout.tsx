import type { ReactNode } from "react";
import { getMe } from "@/lib/services";
import { AppShell } from "@/components/app-shell";
import { pageProblem } from "@/components/page-problem";
import type { Profile } from "@/lib/contracts";
import { getAdventureAccess } from "@/lib/adventure-access";
export const dynamic = "force-dynamic";
export default async function AcademyLayout({ children }: { children: ReactNode }) {
  let me: Profile;
  let adventureAllowed: boolean;
  try { me = await getMe(); adventureAllowed = (await getAdventureAccess()).allowed; }
  catch (error) { return pageProblem(error); }
  return <AppShell me={me} adventureAllowed={adventureAllowed}>{children}</AppShell>;
}
