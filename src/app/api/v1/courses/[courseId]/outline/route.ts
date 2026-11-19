import { type NextRequest } from 'next/server';
import { handle, dataResponse } from '@/lib/http';
import { uuidSchema } from '@/lib/contracts';
import { getOutline } from '@/lib/services';
export const GET = (request: NextRequest, context: { params: Promise<{ courseId: string }> }) => handle(request, async () => dataResponse(await getOutline(uuidSchema.parse((await context.params).courseId))));
