import type { NextRequest } from 'next/server';
import { body, dataResponse, handle } from '@/lib/http';
import { setAdventureAccess } from '@/lib/adventure-access';
import { adventureAccessInputSchema, adventureMemberParamsSchema } from '@/lib/adventure-access-contracts';

type Context = { params: Promise<{ userId: string }> };
export const PUT = (request: NextRequest, context: Context) => handle(request, async () => {
  const { userId } = adventureMemberParamsSchema.parse(await context.params);
  const { enabled } = await body(request, adventureAccessInputSchema);
  return dataResponse(await setAdventureAccess(userId, enabled));
});
