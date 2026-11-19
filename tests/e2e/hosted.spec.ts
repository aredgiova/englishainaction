import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';
import { demoDocument } from '../../src/lib/demo-content';
import { attemptResultSchema, courseSummarySchema, draftSchema, lessonSchema, outlineSchema, profileSchema, type AttemptResult } from '../../src/lib/contracts';

const projectUrl = 'https://gpixjzkfovepghpdiikp.supabase.co';
const appOrigin = 'http://127.0.0.1:3002';
const fixture = {
  admin: process.env.EIA_HOSTED_ADMIN_EMAIL!, teacher: process.env.EIA_HOSTED_TEACHER_EMAIL!,
  student: process.env.EIA_HOSTED_STUDENT_EMAIL!, outsider: process.env.EIA_HOSTED_OUTSIDER_EMAIL!,
};
const password = () => process.env.EIA_HOSTED_TEST_PASSWORD!;
const service = () => createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }) },
});
const profileIds = new Map<string, string>();
type StoredAttempt = { id: string; lesson_version_id: string; idempotency_key: string; request_body: unknown; response: AttemptResult };

test.beforeAll(async () => {
  console.log('Hosted: comprobando configuración y lecturas de base.');
  // Duplicate the project guard so this mutating case cannot run with another config.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== projectUrl || process.env.APP_URL !== appOrigin || process.env.E2E_BASE_URL !== appOrigin) {
    throw new Error('Destino de aceptación alojada no autorizado para esta suite.');
  }
  if (Object.values(fixture).some(email => !email || !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email)) || new Set(Object.values(fixture).map(email => email.toLowerCase())).size !== 4 || !password() || password().length < 12) {
    throw new Error('Se requieren las cuatro identidades ficticias autorizadas y su contraseña de prueba.');
  }
  const { data, error } = await service().from('profiles').select('id,email,role,active').in('email', Object.values(fixture));
  if (error || !data) throw new Error('Preflight alojado: no se pueden consultar los perfiles por Data API con el cliente administrativo. Revisa permisos y configuración; no se creó ningún curso.');
  expect(data.map(row => `${row.email}:${row.role}:${row.active}`).sort()).toEqual([
    `${fixture.admin}:admin:true`, `${fixture.teacher}:teacher:true`, `${fixture.student}:student:true`, `${fixture.outsider}:student:true`,
  ].sort());
  data.forEach(row => profileIds.set(row.email, row.id));
  const attempts = await service().from('attempts').select('id').limit(0);
  if (attempts.error) throw new Error('Preflight alojado: falta acceso administrativo de lectura a attempts en Data API. No se creó ningún curso.');
  const response = await fetch(`${appOrigin}/api/v1/me`, { signal: AbortSignal.timeout(10_000) });
  expect(response.status, 'El servidor configurado debe responder sin sesión y sin errores de configuración').toBe(401);
  console.log('Hosted: preflight aprobado.');
});

async function uiResponse(page: Page, path: string, method: string, action: () => Promise<unknown>, status: number) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1${path}` && response.request().method() === method);
  await action();
  const response = await pending;
  expect(response.status(), `${method} ${path}`).toBe(status);
  return response;
}

async function login(page: Page, email: string, role: 'teacher' | 'admin' | 'student') {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password());
  const response = await uiResponse(page, '/auth/login', 'POST', () => page.getByRole('button', { name: 'Ingresar a la academia' }).click(), 200);
  const profile = profileSchema.parse((await response.json()).data);
  expect(profile.id).toBe(profileIds.get(email));
  expect(profile.role).toBe(role);
  await expect(page).toHaveURL(new RegExp(`${role === 'teacher' ? '/docente' : role === 'admin' ? '/administracion' : '/campus'}$`));
  return profile;
}

async function apiData(page: Page, path: string) {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.status(), `GET ${path}`).toBe(200);
  return (await response.json()).data;
}

async function storedAttempts(courseId: string, studentId: string): Promise<StoredAttempt[]> {
  const { data, error } = await service().from('attempts').select('id,lesson_version_id,idempotency_key,request_body,response')
    .eq('course_id', courseId).eq('student_id', studentId).order('created_at').order('id');
  if (error || !data) throw new Error('No se pudo contrastar el intento con PostgreSQL mediante la Data API del proyecto alojado.');
  return data as StoredAttempt[];
}

async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Sin desbordamiento horizontal').toBe(true);
  await mkdir('docs/evidencia', { recursive: true });
  await page.screenshot({ path: `docs/evidencia/hosted-${name}.png`, fullPage: true });
}

test('proyecto alojado: autoría, matrícula, práctica persistida, reenvío y reingreso móvil', async ({ page: teacher, browser }, testInfo) => {
  console.log('Hosted: creando contextos aislados de navegador.');
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext({ baseURL: appOrigin, viewport: { width: 1440, height: 1000 } })));
  const [admin, initialStudent, outsider] = await Promise.all(contexts.map(context => context.newPage()));
  console.log('Hosted: contextos listos.');
  let student = initialStudent;
  const title = `First Conversations · QA alojada ${randomUUID().slice(0, 8)}`;
  let courseId = '';
  try {
    await test.step('Docente crea un único curso A1 con una unidad y dos lecciones por interfaz', async () => {
      console.log('Hosted: ingresando como docente.');
      await login(teacher, fixture.teacher, 'teacher');
      console.log('Hosted: acceso docente aprobado; creando el curso.');
      await teacher.getByRole('button', { name: 'Crear un curso' }).click();
      await teacher.getByLabel('Título del curso', { exact: true }).fill(title);
      await teacher.getByLabel('Nivel MCER').selectOption('A1');
      await teacher.getByRole('combobox', { name: 'Público', exact: true }).selectOption('university');
      const created = await uiResponse(teacher, '/courses', 'POST', () => teacher.getByRole('button', { name: 'Crear borrador', exact: true }).click(), 201);
      courseId = (await created.json()).data.courseId as string;
      console.log(`Hosted: curso ficticio creado ${courseId}.`);
      await expect(teacher).toHaveURL(new RegExp(`/cursos/${courseId}/editar$`));
      await teacher.getByRole('button', { name: 'Añadir unidad', exact: true }).click();
      await teacher.getByLabel('Título de la unidad', { exact: true }).fill(demoDocument.units[0].title);
      for (const [index, lesson] of demoDocument.units[0].lessons.entries()) {
        await teacher.getByRole('button', { name: 'Añadir lección', exact: true }).click();
        const editor = teacher.locator(`details[data-field="units.0.lessons.${index}"]`);
        await editor.getByLabel('Título de la lección', { exact: true }).fill(lesson.title);
        await editor.getByLabel('Objetivo observable', { exact: true }).fill(lesson.objective);
        await editor.getByRole('button', { name: 'Añadir texto', exact: true }).click();
        await editor.getByLabel('Texto 1', { exact: true }).fill(lesson.blocks[0].text);
        await editor.getByRole('button', { name: 'Añadir actividad', exact: true }).click();
        const activity = lesson.activities[0];
        await editor.getByLabel('Pregunta o instrucción', { exact: true }).fill(activity.prompt);
        await expect(editor.getByLabel('Actividad obligatoria', { exact: true })).toBeChecked();
        for (let extra = 2; extra < activity.options.length; extra++) await editor.getByRole('button', { name: 'Añadir opción', exact: true }).click();
        for (const [optionIndex, option] of activity.options.entries()) await editor.getByLabel(`Opción ${optionIndex + 1}`, { exact: true }).fill(option.text);
        await editor.getByRole('combobox', { name: 'Respuesta correcta', exact: true }).selectOption({ index: 1 });
        await editor.getByLabel('Feedback si acierta', { exact: true }).fill(activity.feedback.correct);
        await editor.getByLabel('Feedback si se equivoca', { exact: true }).fill(activity.feedback.incorrect);
      }
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 200);
      const draft = draftSchema.parse(await apiData(teacher, `/courses/${courseId}/draft`));
      expect(draft.document.units).toHaveLength(1);
      expect(draft.document.units[0].lessons).toHaveLength(2);
      await teacher.getByRole('button', { name: 'Previsualizar como estudiante' }).click();
      const preview = teacher.getByRole('dialog', { name: 'Vista de estudiante', exact: true });
      await expect(preview.getByText(demoDocument.units[0].lessons[0].objective, { exact: true })).toBeVisible();
      await expect(preview.getByText(demoDocument.units[0].lessons[0].activities[0].feedback.correct, { exact: true })).toHaveCount(0);
      await preview.getByRole('button', { name: 'Volver al editor' }).click();
      await teacher.getByRole('button', { name: 'Publicar curso', exact: true }).click();
      const confirmation = teacher.getByRole('dialog', { name: 'Publicar este curso', exact: true });
      await uiResponse(teacher, `/courses/${courseId}/releases`, 'POST', () => confirmation.getByRole('button', { name: 'Confirmar publicación' }).click(), 201);
      await expect(teacher.getByRole('status')).toContainText('Curso publicado');
      console.log('Hosted: publicación aprobada.');
    });

    await test.step('Administración matricula solo a la cuenta estudiantil prevista', async () => {
      console.log('Hosted: comprobando matrícula por interfaz.');
      await login(admin, fixture.admin, 'admin');
      await admin.getByLabel('Correo del estudiante', { exact: true }).fill(fixture.student);
      await admin.getByRole('combobox', { name: 'Curso publicado', exact: true }).selectOption(courseId);
      await uiResponse(admin, `/courses/${courseId}/enrollments`, 'POST', () => admin.getByRole('button', { name: 'Confirmar matrícula' }).click(), 201);
      const { data, error } = await service().from('enrollments').select('student_id').eq('course_id', courseId);
      if (error) throw new Error('No se pudo verificar la matrícula persistida mediante Data API.');
      expect(data).toEqual([{ student_id: profileIds.get(fixture.student) }]);
      console.log('Hosted: matrícula persistida.');
    });

    const learner = await login(student, fixture.student, 'student');
    console.log('Hosted: acceso estudiante aprobado; entregando primera lección.');
    const outline = outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`));
    expect(outline.courseProgress).toEqual({ completed: 0, total: 2, nextLessonId: outline.units[0].lessons[0].id });
    const [firstLesson, secondLesson] = outline.units[0].lessons;
    const endpoint = `/courses/${courseId}/lessons/${firstLesson.id}/attempts`;
    const course = student.getByRole('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) });
    await course.getByRole('link', { name: 'Comenzar', exact: true }).click();
    const lesson = lessonSchema.parse(await apiData(student, `/courses/${courseId}/lessons/${firstLesson.id}`));
    expect(JSON.stringify(lesson)).not.toMatch(/correctOptionId|feedback/);
    await student.getByRole('radio', { name: 'Tunja', exact: true }).check();
    const firstResponse = await uiResponse(student, endpoint, 'POST', () => student.getByRole('button', { name: 'Entregar práctica' }).click(), 201);
    const first = attemptResultSchema.parse((await firstResponse.json()).data);
    const key = firstResponse.request().headers()['idempotency-key'];
    const body: unknown = firstResponse.request().postDataJSON();
    expect(key).toBeTruthy();
    expect(first.score).toEqual({ correct: 0, total: 1 });
    expect(first.courseProgress).toEqual({ completed: 1, total: 2, nextLessonId: secondLesson.id });
    await expect(student.getByRole('heading', { name: 'Aciertos de esta práctica' })).toBeVisible();
    await expect(student.getByRole('heading', { name: 'Avance del curso' })).toBeVisible();
    await expect(student.getByText('1 de 2 lecciones', { exact: true })).toBeVisible();
    await expect(student.getByText('50 %', { exact: true })).toBeVisible();
    await expect(student.getByText(demoDocument.units[0].lessons[0].activities[0].feedback.incorrect, { exact: true })).toBeVisible();
    await capture(student, 'desktop-feedback');
    console.log(`Hosted: primer intento persistido ${first.attemptId}.`);

    await test.step('La misma clave recupera un intento y Volver a practicar crea otro sin duplicar avance', async () => {
      console.log('Hosted: comprobando reenvío y práctica voluntaria.');
      const replay = await student.request.post(`/api/v1${endpoint}`, { data: body, headers: { Origin: appOrigin, 'Idempotency-Key': key } });
      expect(replay.status()).toBe(200);
      expect(attemptResultSchema.parse((await replay.json()).data)).toEqual(first);
      const persisted = await storedAttempts(courseId, learner.id);
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({ id: first.attemptId, lesson_version_id: lesson.lessonVersionId, idempotency_key: key, request_body: body, response: first });
      await student.getByRole('button', { name: 'Volver a practicar', exact: true }).click();
      await student.getByRole('radio', { name: 'Yopal', exact: true }).check();
      const response = await uiResponse(student, endpoint, 'POST', () => student.getByRole('button', { name: 'Entregar práctica' }).click(), 201);
      const second = attemptResultSchema.parse((await response.json()).data);
      expect(response.request().headers()['idempotency-key']).not.toBe(key);
      expect(second.attemptId).not.toBe(first.attemptId);
      expect(second.score).toEqual({ correct: 1, total: 1 });
      expect(second.courseProgress).toEqual(first.courseProgress);
      expect(await storedAttempts(courseId, learner.id)).toHaveLength(2);
    });

    await test.step('Otra sesión móvil recupera el avance desde el mismo proyecto y continúa la segunda lección', async () => {
      console.log('Hosted: reingresando desde un contexto móvil limpio.');
      await uiResponse(student, '/auth/logout', 'POST', () => student.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(), 200);
      await expect(student).toHaveURL(/\/ingresar$/);
      await contexts[1].close();
      contexts[1] = await browser.newContext({ baseURL: appOrigin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      student = await contexts[1].newPage();
      expect(await student.context().cookies()).toEqual([]);
      expect((await student.request.get('/api/v1/me')).status()).toBe(401);
      expect((await login(student, fixture.student, 'student')).id).toBe(learner.id);
      expect(await student.evaluate(() => ({ session: sessionStorage.length, local: localStorage.length }))).toEqual({ session: 0, local: 0 });
      expect(outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`)).courseProgress).toEqual(first.courseProgress);
      const persisted = await storedAttempts(courseId, learner.id);
      expect(persisted).toHaveLength(2);
      expect(persisted.find(row => row.id === first.attemptId)?.response).toEqual(first);
      const resumedCourse = student.getByRole('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) });
      await expect(resumedCourse.getByText('1 de 2 lecciones', { exact: true })).toBeVisible();
      await expect(resumedCourse.getByText('50 %', { exact: true })).toBeVisible();
      await capture(student, 'mobile-campus');
      await resumedCourse.getByRole('link', { name: 'Continuar', exact: true }).click();
      await expect(student).toHaveURL(new RegExp(`/cursos/${courseId}/lecciones/${secondLesson.id}$`));
      await expect(student.getByRole('heading', { level: 1, name: demoDocument.units[0].lessons[1].title })).toBeVisible();
      await capture(student, 'mobile-next-lesson');
    });

    await test.step('La cuenta sin matrícula recibe 404 y no recibe el material del curso', async () => {
      console.log('Hosted: comprobando aislamiento de la cuenta sin matrícula.');
      await login(outsider, fixture.outsider, 'student');
      expect(courseSummarySchema.array().parse(await apiData(outsider, '/courses')).some(item => item.courseId === courseId)).toBe(false);
      expect((await outsider.request.get(`/api/v1/courses/${courseId}/outline`)).status()).toBe(404);
      expect((await outsider.request.get(`/api/v1/courses/${courseId}/lessons/${firstLesson.id}`)).status()).toBe(404);
      await outsider.goto(`/cursos/${courseId}/lecciones/${firstLesson.id}`);
      await expect(outsider.getByRole('heading', { level: 1, name: lesson.title })).toHaveCount(0);
      await expect(outsider.getByRole('radio')).toHaveCount(0);
    });

    await testInfo.attach('hosted-acceptance-identifiers', {
      body: JSON.stringify({ projectRef: 'gpixjzkfovepghpdiikp', origin: appOrigin, courseId, releaseId: outline.releaseId, studentId: learner.id, firstAttemptId: first.attemptId, completed: 1, total: 2, nextLessonId: secondLesson.id }),
      contentType: 'application/json',
    });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
