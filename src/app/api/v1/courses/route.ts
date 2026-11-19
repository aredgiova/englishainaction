import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { createCourseSchema } from '@/lib/contracts';
import { createCourse, listCourses } from '@/lib/services';
export const GET = (request: NextRequest) => handle(request, async () => dataResponse(await listCourses()));
export const POST = (request: NextRequest) => handle(request, async () => dataResponse(await createCourse(await body(request, createCourseSchema)), 201));
