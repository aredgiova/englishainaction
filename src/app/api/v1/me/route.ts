import { type NextRequest } from 'next/server';
import { handle, dataResponse } from '@/lib/http';
import { getMe } from '@/lib/services';
export const GET = (request: NextRequest) => handle(request, async () => dataResponse(await getMe()));
