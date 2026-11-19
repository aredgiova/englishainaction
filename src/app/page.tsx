import { redirect } from "next/navigation";
import type { Profile } from "@/lib/contracts";
import { getMe } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";

export const dynamic = "force-dynamic";
export default async function Home() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  redirect(roleHome(me.role));
}
