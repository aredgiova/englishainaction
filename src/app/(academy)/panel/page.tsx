import { redirect } from "next/navigation";
import type { Profile } from "@/lib/contracts";
import { getMe } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";

/** Compatibility entry for saved links; the verified role selects the actual home. */
export default async function PanelRedirect() {
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  redirect(roleHome(me.role));
}
