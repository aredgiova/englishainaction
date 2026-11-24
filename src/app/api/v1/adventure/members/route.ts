import type { NextRequest } from 'next/server';
import { dataResponse, handle } from '@/lib/http';
import { getAdventureMembers } from '@/lib/adventure-access';

export const GET = (request: NextRequest) => handle(request, async () => dataResponse(await getAdventureMembers()));
