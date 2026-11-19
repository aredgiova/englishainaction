import { type NextRequest } from 'next/server';
import { handle, dataResponse } from '@/lib/http';
import { uuidSchema, stableIdSchema } from '@/lib/contracts';
import { getLesson } from '@/lib/services';
export const GET = (request: NextRequest, context: { params: Promise<{ courseId: string; lessonId: string }> }) => handle(request, async () => {
  const params = await context.params;
  return dataResponse(await getLesson(uuidSchema.parse(params.courseId), stableIdSchema.parse(params.lessonId)));
});
