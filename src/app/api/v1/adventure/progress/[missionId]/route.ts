import type { NextRequest } from 'next/server';
import { body, dataResponse, handle } from '@/lib/http';
import { getAdventureProgress, resetAdventureProgress, setAdventureProgress } from '@/lib/adventure-access';
import { adventureMissionParamsSchema, adventureProgressInputSchema, adventureResetInputSchema } from '@/lib/adventure-access-contracts';

type Context = { params: Promise<{ missionId: string }> };
export const GET = (request: NextRequest, context: Context) => handle(request, async () => {
  const { missionId } = adventureMissionParamsSchema.parse(await context.params);
  return dataResponse(await getAdventureProgress(missionId));
});
export const PUT = (request: NextRequest, context: Context) => handle(request, async () => {
  const { missionId } = adventureMissionParamsSchema.parse(await context.params);
  const { stepId, completed } = await body(request, adventureProgressInputSchema(missionId));
  return dataResponse(await setAdventureProgress(missionId, stepId, completed));
});
export const DELETE = (request: NextRequest, context: Context) => handle(request, async () => {
  const { missionId } = adventureMissionParamsSchema.parse(await context.params);
  await body(request, adventureResetInputSchema);
  return dataResponse(await resetAdventureProgress(missionId));
});
