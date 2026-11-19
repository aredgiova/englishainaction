import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { uuidSchema, stableIdSchema, idempotencyKeySchema, attemptSchema } from '@/lib/contracts';
import { submitAttempt } from '@/lib/services';
export const POST = (request: NextRequest, context: { params: Promise<{ courseId: string; lessonId: string }> }) => handle(request, async () => {
  const params = await context.params;
  const key = idempotencyKeySchema.parse(request.headers.get('idempotency-key'));
  const input = await body(request, attemptSchema);
  const result = await submitAttempt(uuidSchema.parse(params.courseId), stableIdSchema.parse(params.lessonId), key, input);
  return dataResponse(result.data, result.created ? 201 : 200);
});
