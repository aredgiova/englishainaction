import SwaggerParser from '@apidevtools/swagger-parser';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';

async function main() {
  const document = YAML.parse(readFileSync('docs/openapi.yaml', 'utf8'));
  await SwaggerParser.validate(document);
  const expected = ['/api/v1/me', '/api/v1/admin/invitations', '/api/v1/courses', '/api/v1/courses/{courseId}/draft', '/api/v1/courses/{courseId}/releases', '/api/v1/courses/{courseId}/enrollments', '/api/v1/courses/{courseId}/outline', '/api/v1/courses/{courseId}/lessons/{lessonId}', '/api/v1/courses/{courseId}/lessons/{lessonId}/attempts', '/api/v1/auth/login', '/api/v1/auth/logout', '/api/v1/auth/recover', '/api/v1/auth/password', '/auth/confirm', '/api/v1/adventure/access', '/api/v1/adventure/members', '/api/v1/adventure/members/{userId}', '/api/v1/adventure/progress/{missionId}'];
  for (const path of expected) if (!document.paths[path]) throw new Error(`Falta la operación ${path}`);
  console.log(`OpenAPI ${document.openapi}: válido; ${Object.keys(document.paths).length} rutas.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
