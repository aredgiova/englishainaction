import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { saveDraftSchema, uuidSchema } from '@/lib/contracts';
import { getDraft, saveDraft } from '@/lib/services';
type Context = { params: Promise<{ courseId: string }> };
export const GET = (request: NextRequest, context: Context) => handle(request, async () => dataResponse(await getDraft(uuidSchema.parse((await context.params).courseId))));
export const PUT = (request: NextRequest, context: Context) => handle(request, async () => {
  const id = uuidSchema.parse((await context.params).courseId);
  const input = await body(request, saveDraftSchema);
  return dataResponse(await saveDraft(id, input.expectedRevision, input.document));
});
