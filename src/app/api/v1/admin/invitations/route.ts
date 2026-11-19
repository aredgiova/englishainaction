import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { invitationSchema } from '@/lib/contracts';
import { invite } from '@/lib/services';
export const POST = (request: NextRequest) => handle(request, async () => dataResponse(await invite(await body(request, invitationSchema)), 201));
