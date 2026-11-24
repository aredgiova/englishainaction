import { notFound } from "next/navigation";
import { adventureMissions } from "@/lib/adventure-content";
import { MissionPlayer } from "@/components/adventure/mission-player";
import { getAdventureProgress, requireAdventureAccess } from "@/lib/adventure-access";
import { getMe } from "@/lib/services";
import { pageProblem } from "@/components/page-problem";
import type { AdventureProgress } from "@/lib/adventure-access-contracts";
import type { Profile } from "@/lib/contracts";

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const mission = adventureMissions.find(item => item.id === missionId);
  if (!mission) notFound();
  let progress: AdventureProgress;
  let me: Profile;
  try { await requireAdventureAccess(); me = await getMe(); progress = await getAdventureProgress(mission.id); }
  catch (error) { return pageProblem(error); }
  return <MissionPlayer key={`${me.id}:${mission.id}`} mission={mission} initialCompleted={progress.completedStepIds} />;
}
