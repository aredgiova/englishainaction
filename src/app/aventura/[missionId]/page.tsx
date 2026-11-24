import { notFound } from "next/navigation";
import { adventureMissions } from "@/lib/adventure-content";
import { MissionPlayer } from "@/components/adventure/mission-player";

export function generateStaticParams() { return adventureMissions.map(mission => ({ missionId: mission.id })); }

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const mission = adventureMissions.find(item => item.id === missionId);
  if (!mission) notFound();
  return <MissionPlayer key={mission.id} mission={mission} />;
}
