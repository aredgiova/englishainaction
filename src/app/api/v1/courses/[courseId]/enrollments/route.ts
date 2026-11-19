import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { enrollmentSchema, uuidSchema } from '@/lib/contracts';
import { enroll } from '@/lib/services';
export const POST = (request: NextRequest, context: { params: Promise<{ courseId: string }> }) => handle(request, async () => {
  const id = uuidSchema.parse((await context.params).courseId);
  const input = await body(request, enrollmentSchema);
  const result = await enroll(id, input.studentEmail);
  return dataResponse(result.data, result.created ? 201 : 200);
});
