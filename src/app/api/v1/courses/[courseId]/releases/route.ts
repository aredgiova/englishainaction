import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { releaseSchema, uuidSchema } from '@/lib/contracts';
import { publishCourse } from '@/lib/services';
export const POST = (request: NextRequest, context: { params: Promise<{ courseId: string }> }) => handle(request, async () => {
  const id = uuidSchema.parse((await context.params).courseId);
  const input = await body(request, releaseSchema);
  const result = await publishCourse(id, input.expectedRevision);
  return dataResponse(result.data, result.created ? 201 : 200);
});
