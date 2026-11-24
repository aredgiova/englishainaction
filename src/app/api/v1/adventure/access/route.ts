import type { NextRequest } from 'next/server';
import { dataResponse, handle } from '@/lib/http';
import { getAdventureAccess } from '@/lib/adventure-access';

export const GET = (request: NextRequest) => handle(request, async () => dataResponse(await getAdventureAccess()));
