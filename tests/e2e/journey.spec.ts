import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { test, expect, type Page, type Response } from '@playwright/test';
import { demoDocument } from '../../src/lib/demo-content';
import { attemptResultSchema, draftSchema, lessonSchema, outlineSchema, profileSchema, type AttemptResult, type Lesson } from '../../src/lib/contracts';

const fixture = {
  teacher: 'docente@englishinaction.test', admin: 'admin@englishinaction.test',
  student: 'estudiante@englishinaction.test', outsider: 'sinmatricula@englishinaction.test',
};
const password = () => process.env.DEMO_PASSWORD!;
const appOrigin = () => new URL(process.env.E2E_BASE_URL ?? process.env.APP_URL!).origin;

test.beforeAll(async () => {
  try {
    const health = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, signal: AbortSignal.timeout(5_000),
    });
    expect(health.ok, 'Supabase Auth debe estar activo').toBe(true);
    const mailbox = await fetch(process.env.MAILBOX_URL!, { signal: AbortSignal.timeout(5_000) });
    expect(mailbox.ok, 'Mailpit debe estar activo para invitación y recuperación reales').toBe(true);
    const database = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
    try {
      await database.connect();
      const accounts = await database.query<{ email: string; role: string }>(
        'select p.email, p.role from public.profiles p join auth.users u on u.id=p.id where p.email=any($1::text[]) and p.active and u.email_confirmed_at is not null',
        [Object.values(fixture)],
      );
      expect(accounts.rows.map(row => `${row.email}:${row.role}`).sort()).toEqual([
        `${fixture.teacher}:teacher`, `${fixture.admin}:admin`, `${fixture.student}:student`, `${fixture.outsider}:student`,
      ].sort());
    } finally { await database.end(); }
  } catch {
    throw new Error('E2E journey no ejecutado: preflight de Supabase/Auth/PostgreSQL/Mailpit o usuarios seed falló. Inicia Docker y ejecuta pnpm db:start y pnpm demo:seed; revisa .env.local. No se ha validado ningún recorrido autenticado.');
  }
});

async function uiResponse(page: Page, path: string, method: string, action: () => Promise<unknown>, status: number) {
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1${path}` && response.request().method() === method);
  await action();
  const response = await pending;
  expect(response.status(), `${method} ${path}`).toBe(status);
  return response;
}

async function login(page: Page, email: string, role: 'teacher' | 'admin' | 'student', pass = password()) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(pass);
  const response = await uiResponse(page, '/auth/login', 'POST', () => page.getByRole('button', { name: 'Ingresar a la academia' }).click(), 200);
  const profile = profileSchema.parse((await response.json()).data);
  expect(profile.role).toBe(role);
  await expect(page).toHaveURL(new RegExp(`${role === 'teacher' ? '/docente' : role === 'admin' ? '/administracion' : '/campus'}$`));
  return profile;
}

async function logout(page: Page) {
  await uiResponse(page, '/auth/logout', 'POST', () => page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click(), 200);
  await expect(page).toHaveURL(/\/ingresar$/);
}

async function apiData(page: Page, path: string) {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.status(), `GET ${path}`).toBe(200);
  return (await response.json()).data;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No debe existir desplazamiento horizontal').toBe(true);
}

async function mailboxLink(page: Page, email: string, type: 'invite' | 'recovery') {
  let link = '';
  const subject = type === 'invite' ? 'invitación' : 'Recupera';
  await expect.poll(async () => {
    const response = await page.request.get(`${process.env.MAILBOX_URL}/view/latest.html?query=${encodeURIComponent(`to:${email} subject:${subject}`)}`);
    if (!response.ok()) return false;
    for (const match of (await response.text()).matchAll(/href=["']([^"']+)["']/g)) {
      const candidate = new URL(match[1].replaceAll('&amp;', '&'), appOrigin());
      if (candidate.origin === appOrigin() && candidate.pathname === '/auth/confirm' && candidate.searchParams.get('type') === type) link = candidate.toString();
    }
    return Boolean(link);
  }, { timeout: 30_000, intervals: [500, 1_000, 2_000], message: `Debe llegar el correo ${type} a Mailpit` }).toBe(true);
  return link;
}

async function definePassword(page: Page, pass: string) {
  await expect(page).toHaveURL(/\/definir-clave$/);
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(pass);
  await page.getByLabel('Confirma la contraseña', { exact: true }).fill(pass);
  await uiResponse(page, '/auth/password', 'POST', () => page.getByRole('button', { name: 'Guardar y continuar' }).click(), 200);
  await expect(page).toHaveURL(/\/campus$/);
}

async function attempt(page: Page, endpoint: string, expectedStatus: number) {
  const response = await uiResponse(page, endpoint, 'POST', () => page.getByRole('button', { name: 'Entregar práctica' }).click(), expectedStatus);
  const key = response.request().headers()['idempotency-key'];
  expect(key).toBeTruthy();
  const result = attemptResultSchema.parse((await response.json()).data);
  await expect(page.getByRole('heading', { name: 'Lección completada' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aciertos de esta práctica' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avance del curso' })).toBeVisible();
  return { response, key, result };
}

async function countAttempt(courseId: string, studentId: string, key: string) {
  const database = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
  try {
    await database.connect();
    const count = await database.query<{ count: string }>('select count(*) from public.attempts where course_id=$1 and student_id=$2 and idempotency_key=$3', [courseId, studentId, key]);
    expect(count.rows[0].count).toBe('1');
  } finally { await database.end(); }
}

async function storedAttempts(courseId: string, studentId: string) {
  const database = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5_000 });
  try {
    await database.connect();
    const result = await database.query<{ id: string; lesson_version_id: string; idempotency_key: string; response: AttemptResult }>(
      'select id, lesson_version_id, idempotency_key, response from public.attempts where course_id=$1 and student_id=$2 order by created_at, id',
      [courseId, studentId],
    );
    return result.rows;
  } finally { await database.end(); }
}

test('docente → administración → estudiante: dos lecciones, correo, reenvío y persistencia reales', async ({ page: teacher, browser }, testInfo) => {
  const contextOptions = {
    baseURL: testInfo.project.use.baseURL, viewport: testInfo.project.use.viewport,
    isMobile: testInfo.project.use.isMobile, hasTouch: testInfo.project.use.hasTouch,
  };
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext(contextOptions)));
  const [admin, initialStudent, outsider, invited] = await Promise.all(contexts.map(context => context.newPage()));
  let student = initialStudent;
  const title = `${demoDocument.title} · E2E ${testInfo.project.name} ${randomUUID().slice(0, 8)}`;
  const invitedEmail = `e2e-${randomUUID()}@englishinaction.test`;
  const invitedPassword = `Local!${randomUUID()}`;
  let courseId = '';
  let publishedLesson: Lesson;
  let firstAttempt: { response: Response; key: string; result: AttemptResult };
  try {
    await test.step('Docente crea un borrador nuevo y compone dos lecciones con controles reales', async () => {
      await login(teacher, fixture.teacher, 'teacher');
      await teacher.goto('/administracion');
      await expect(teacher).toHaveURL(/\/docente$/);
      await teacher.getByRole('button', { name: 'Crear un curso' }).click();
      await teacher.getByLabel('Título del curso', { exact: true }).fill(title);
      await teacher.getByLabel('Nivel MCER').selectOption(demoDocument.level);
      await teacher.getByRole('combobox', { name: 'Público', exact: true }).selectOption(demoDocument.audience);
      const created = await uiResponse(teacher, '/courses', 'POST', () => teacher.getByRole('button', { name: 'Crear borrador', exact: true }).click(), 201);
      courseId = (await created.json()).data.courseId as string;
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
        await editor.getByRole('button', { name: 'Añadir opción', exact: true }).click();
        for (const [optionIndex, option] of activity.options.entries()) await editor.getByLabel(`Opción ${optionIndex + 1}`, { exact: true }).fill(option.text);
        await editor.getByRole('combobox', { name: 'Respuesta correcta', exact: true }).selectOption({ index: 1 });
        await editor.getByLabel('Feedback si acierta', { exact: true }).fill(activity.feedback.correct);
        await editor.getByLabel('Feedback si se equivoca', { exact: true }).fill(activity.feedback.incorrect);
      }
      await teacher.getByRole('button', { name: 'Subir lección 2', exact: true }).click();
      await expect(teacher.locator('details[data-field="units.0.lessons.0"]').getByLabel('Título de la lección', { exact: true })).toHaveValue(demoDocument.units[0].lessons[1].title);
      await teacher.getByRole('button', { name: 'Bajar lección 1', exact: true }).click();
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 200);
      await expect(teacher.getByRole('status')).toContainText('Borrador guardado');
      const saved = draftSchema.parse(await apiData(teacher, `/courses/${courseId}/draft`));
      expect(saved.document.units[0].lessons.map(lesson => lesson.title)).toEqual(demoDocument.units[0].lessons.map(lesson => lesson.title));
      await noOverflow(teacher);
    });

    await test.step('Previsualiza sin soluciones y confirma la publicación explícitamente', async () => {
      const writes: string[] = [];
      const recordWrite = (response: Response) => { if (response.request().method() !== 'GET' && response.url().includes('/api/v1/')) writes.push(response.url()); };
      teacher.on('response', recordWrite);
      await teacher.getByRole('button', { name: 'Previsualizar como estudiante' }).click();
      const preview = teacher.getByRole('dialog', { name: 'Vista de estudiante', exact: true });
      await expect(preview).toBeVisible();
      await expect(preview.getByText(demoDocument.units[0].lessons[0].objective, { exact: true })).toBeVisible();
      await expect(preview.getByText('Corrección privada del docente', { exact: true })).toHaveCount(0);
      await expect(preview.getByText(demoDocument.units[0].lessons[0].activities[0].feedback.correct, { exact: true })).toHaveCount(0);
      await preview.getByLabel('Lección de la vista previa').selectOption({ index: 1 });
      await expect(preview.getByText(demoDocument.units[0].lessons[1].objective, { exact: true })).toBeVisible();
      await noOverflow(teacher);
      await preview.getByRole('button', { name: 'Volver al editor' }).click();
      await teacher.getByRole('button', { name: 'Publicar curso', exact: true }).click();
      const confirmation = teacher.getByRole('dialog', { name: 'Publicar este curso', exact: true });
      await expect(confirmation).toContainText(title);
      await confirmation.getByRole('button', { name: 'Seguir editando' }).click();
      expect(writes).toEqual([]);
      teacher.off('response', recordWrite);
      await teacher.getByRole('button', { name: 'Publicar curso', exact: true }).click();
      await uiResponse(teacher, `/courses/${courseId}/releases`, 'POST', () => confirmation.getByRole('button', { name: 'Confirmar publicación' }).click(), 201);
      await expect(teacher.getByRole('status')).toContainText('Curso publicado');
    });

    await test.step('Administración invita; la cuenta se activa y recupera contraseña desde Mailpit', async () => {
      await login(admin, fixture.admin, 'admin');
      await admin.getByLabel('Nombre completo', { exact: true }).fill('Alex · Prueba de interfaz');
      await admin.getByLabel('Correo electrónico', { exact: true }).fill(invitedEmail);
      await admin.getByLabel('Rol', { exact: true }).selectOption('student');
      await uiResponse(admin, '/admin/invitations', 'POST', () => admin.getByRole('button', { name: 'Enviar invitación' }).click(), 201);
      await expect(admin.getByRole('status').filter({ hasText: 'Invitación enviada' })).toContainText(invitedEmail);
      await invited.goto(await mailboxLink(invited, invitedEmail, 'invite'));
      await definePassword(invited, invitedPassword);
      await logout(invited);
      // Supabase local limits mail for one address to one message per second.
      await new Promise(resolve => setTimeout(resolve, 1_100));
      await invited.goto('/recuperar-clave');
      await invited.getByLabel('Correo electrónico', { exact: true }).fill(invitedEmail);
      await uiResponse(invited, '/auth/recover', 'POST', () => invited.getByRole('button', { name: 'Enviar enlace' }).click(), 200);
      await expect(invited.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();
      await invited.goto(await mailboxLink(invited, invitedEmail, 'recovery'));
      const recoveredPassword = `Recovered!${randomUUID()}`;
      await definePassword(invited, recoveredPassword);
      await logout(invited);
      await login(invited, invitedEmail, 'student', recoveredPassword);
      for (const email of [fixture.student, invitedEmail]) {
        await admin.getByLabel('Correo del estudiante', { exact: true }).fill(email);
        await admin.getByRole('combobox', { name: 'Curso publicado', exact: true }).selectOption(courseId);
        await uiResponse(admin, `/courses/${courseId}/enrollments`, 'POST', () => admin.getByRole('button', { name: 'Confirmar matrícula' }).click(), 201);
        await expect(admin.getByRole('status').filter({ hasText: 'Matrícula confirmada' })).toContainText(email);
      }
      await noOverflow(admin);
    });

    const learner = await login(student, fixture.student, 'student');
    await student.goto('/docente');
    await expect(student).toHaveURL(/\/campus$/);
    await test.step('Entrega la primera lección, reenvía el mismo intento y practica voluntariamente', async () => {
      const course = student.getByRole('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) });
      await expect(course.getByText('0 de 2 lecciones', { exact: true })).toBeVisible();
      await course.getByRole('link', { name: 'Comenzar', exact: true }).click();
      await expect(student.getByRole('heading', { level: 1, name: demoDocument.units[0].lessons[0].title })).toBeVisible();
      const outline = outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`));
      const firstLessonId = outline.units[0].lessons[0].id;
      const endpoint = `/courses/${courseId}/lessons/${firstLessonId}/attempts`;
      publishedLesson = lessonSchema.parse(await apiData(student, `/courses/${courseId}/lessons/${firstLessonId}`));
      expect(JSON.stringify(publishedLesson)).not.toMatch(/correctOptionId|feedback/);
      await student.getByRole('radio', { name: 'Tunja', exact: true }).check();
      firstAttempt = await attempt(student, endpoint, 201);
      expect(firstAttempt.result.score).toEqual({ correct: 0, total: 1 });
      expect(firstAttempt.result.courseProgress).toEqual({ completed: 1, total: 2, nextLessonId: outline.units[0].lessons[1].id });
      await expect(student.getByText(demoDocument.units[0].lessons[0].activities[0].feedback.incorrect, { exact: true })).toBeVisible();
      await expect(student.getByText('50 %', { exact: true })).toBeVisible();
      await student.reload();
      await expect(student.getByRole('status')).toContainText('Recuperamos tu último envío');
      const replay = await attempt(student, endpoint, 200);
      expect(replay.key).toBe(firstAttempt.key);
      expect(replay.result).toEqual(firstAttempt.result);
      await countAttempt(courseId, learner.id, firstAttempt.key);
      await student.getByRole('button', { name: 'Volver a practicar', exact: true }).click();
      await student.getByRole('radio', { name: 'Yopal', exact: true }).check();
      const deliberate = await attempt(student, endpoint, 201);
      expect(deliberate.key).not.toBe(firstAttempt.key);
      expect(deliberate.result.attemptId).not.toBe(firstAttempt.result.attemptId);
      expect(deliberate.result.score).toEqual({ correct: 1, total: 1 });
      expect(deliberate.result.courseProgress.completed).toBe(1);
      await expect(student.getByText(demoDocument.units[0].lessons[0].activities[0].feedback.correct, { exact: true })).toBeVisible();
      await countAttempt(courseId, learner.id, deliberate.key);
      await noOverflow(student);
    });

    await test.step('Un contexto nuevo recupera 1/2 desde PostgreSQL y permite continuar la segunda lección', async () => {
      await logout(student);
      await contexts[1].close();
      contexts[1] = await browser.newContext(contextOptions);
      student = await contexts[1].newPage();
      expect(await student.context().cookies()).toEqual([]);
      expect((await student.request.get('/api/v1/me')).status()).toBe(401);
      const returnedLearner = await login(student, fixture.student, 'student');
      expect(returnedLearner.id).toBe(learner.id);
      expect(await student.evaluate(() => ({ session: sessionStorage.length, local: localStorage.length }))).toEqual({ session: 0, local: 0 });
      const persisted = await storedAttempts(courseId, learner.id);
      expect(persisted).toHaveLength(2);
      expect(persisted.find(row => row.id === firstAttempt.result.attemptId)?.response).toEqual(firstAttempt.result);
      expect(outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`)).courseProgress).toEqual(firstAttempt.result.courseProgress);
      const course = student.getByRole('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) });
      await expect(course.getByText('1 de 2 lecciones', { exact: true })).toBeVisible();
      await expect(course.getByText('50 %', { exact: true })).toBeVisible();
      await expect(student.getByRole('heading', { name: 'Continuar mi lección', exact: true })).toBeVisible();
      await course.getByRole('link', { name: 'Continuar', exact: true }).click();
      await expect(student.getByRole('heading', { level: 1, name: demoDocument.units[0].lessons[1].title })).toBeVisible();
      const outline = outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`));
      await student.getByRole('radio', { name: 'This is Maya. She studies biology.', exact: true }).check();
      const second = await attempt(student, `/courses/${courseId}/lessons/${outline.units[0].lessons[1].id}/attempts`, 201);
      expect(second.result.courseProgress).toEqual({ completed: 2, total: 2, nextLessonId: null });
      await student.goto('/campus');
      await expect(course.getByRole('link', { name: 'Repasar', exact: true })).toBeVisible();
      expect(outlineSchema.parse(await apiData(invited, `/courses/${courseId}/outline`)).courseProgress.completed).toBe(0);
      await student.screenshot({ path: testInfo.outputPath('campus-completed.png'), fullPage: true });
    });

    await test.step('Borrador aislado, recuperación de sesión real y conflicto que conserva la edición local', async () => {
      const edit = teacher.locator('details[data-field="units.0.lessons.0"]').getByLabel('Objetivo observable', { exact: true });
      const changedObjective = `${demoDocument.units[0].lessons[0].objective} Speak to a new classmate.`;
      await edit.fill(changedObjective);
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 200);
      const current = lessonSchema.parse(await apiData(student, `/courses/${courseId}/lessons/${publishedLesson.lessonId}`));
      expect(current).toEqual(publishedLesson);
      const afterSessionLoss = `${changedObjective} Keep editing after signing in.`;
      await edit.fill(afterSessionLoss);
      await teacher.context().clearCookies();
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 401);
      await expect(teacher.getByRole('heading', { name: 'Tu sesión caducó', exact: true })).toBeVisible();
      await expect(edit).toHaveValue(afterSessionLoss);
      await expect(teacher.getByLabel('Correo de tu cuenta', { exact: true })).toHaveValue(fixture.teacher);
      await teacher.getByLabel('Contraseña para continuar', { exact: true }).fill(password());
      await uiResponse(teacher, '/auth/login', 'POST', () => teacher.getByRole('button', { name: 'Restablecer sesión', exact: true }).click(), 200);
      await expect(edit).toHaveValue(afterSessionLoss);
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 200);
      const stale = draftSchema.parse(await apiData(teacher, `/courses/${courseId}/draft`));
      const newer = await teacher.request.put(`/api/v1/courses/${courseId}/draft`, { data: { expectedRevision: stale.revision, document: stale.document }, headers: { Origin: appOrigin() } });
      expect(newer.status()).toBe(200);
      const unsaved = `${afterSessionLoss} Keep this local sentence.`;
      await edit.fill(unsaved);
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 409);
      await expect(edit).toHaveValue(unsaved);
      await teacher.getByRole('button', { name: 'Ver versión vigente', exact: true }).click();
      const savedPreview = teacher.getByRole('dialog', { name: 'Versión vigente del borrador', exact: true });
      await expect(savedPreview.getByText(afterSessionLoss, { exact: true })).toBeVisible();
      await savedPreview.getByRole('button', { name: 'Volver al editor', exact: true }).click();
      await expect(edit).toHaveValue(unsaved);
      teacher.once('dialog', dialog => dialog.accept());
      await teacher.reload();
      await expect(teacher.getByRole('status')).toContainText('Encontramos cambios sin guardar');
      await teacher.getByRole('button', { name: 'Recuperar cambios', exact: true }).click();
      await expect(edit).toHaveValue(unsaved);
      await expect(teacher.getByRole('alert')).toContainText('revisión más reciente');
      await teacher.getByRole('button', { name: 'Ver versión vigente', exact: true }).click();
      await teacher.getByRole('dialog', { name: 'Versión vigente del borrador', exact: true }).getByRole('button', { name: 'Cargar versión vigente', exact: true }).click();
      await expect(edit).toHaveValue(afterSessionLoss);
      const downloaded = teacher.waitForEvent('download');
      await teacher.getByRole('button', { name: 'Descargar mis cambios anteriores', exact: true }).click();
      const download = await downloaded;
      expect(await download.failure()).toBeNull();
      const downloadedPath = await download.path();
      expect(downloadedPath).toBeTruthy();
      const backup = JSON.parse(await readFile(downloadedPath!, 'utf8')) as {
        courseId: string;
        backups: { document: { units: { lessons: { objective: string }[] }[] } }[];
      };
      expect(backup.courseId).toBe(courseId);
      expect(backup.backups.some(item => item.document.units[0].lessons[0].objective === unsaved)).toBe(true);
      const reconciled = `${afterSessionLoss} Reconciled with the saved revision.`;
      await edit.fill(reconciled);
      await uiResponse(teacher, `/courses/${courseId}/draft`, 'PUT', () => teacher.getByRole('button', { name: 'Guardar borrador', exact: true }).click(), 200);
      expect(draftSchema.parse(await apiData(teacher, `/courses/${courseId}/draft`)).document.units[0].lessons[0].objective).toBe(reconciled);
      expect(lessonSchema.parse(await apiData(student, `/courses/${courseId}/lessons/${publishedLesson.lessonId}`))).toEqual(publishedLesson);
    });

    await test.step('Publicar una revisión nueva conserva los intentos históricos en PostgreSQL', async () => {
      const before = outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`));
      expect(before.courseProgress).toEqual({ completed: 2, total: 2, nextLessonId: null });
      const history = await storedAttempts(courseId, learner.id);
      expect(history).toHaveLength(3);
      expect(history.find(row => row.id === firstAttempt.result.attemptId)?.response).toEqual(firstAttempt.result);
      await teacher.getByRole('button', { name: 'Publicar curso', exact: true }).click();
      const confirmation = teacher.getByRole('dialog', { name: 'Publicar este curso', exact: true });
      await uiResponse(teacher, `/courses/${courseId}/releases`, 'POST', () => confirmation.getByRole('button', { name: 'Confirmar publicación' }).click(), 201);
      const after = outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`));
      expect(after.releaseId).not.toBe(before.releaseId);
      expect(after.units[0].lessons[0].lessonVersionId).not.toBe(before.units[0].lessons[0].lessonVersionId);
      expect(after.units[0].lessons[1].lessonVersionId).toBe(before.units[0].lessons[1].lessonVersionId);
      expect(after.courseProgress).toEqual({ completed: 1, total: 2, nextLessonId: publishedLesson.lessonId });
      expect(await storedAttempts(courseId, learner.id)).toEqual(history);
      const visible = lessonSchema.parse(await apiData(student, `/courses/${courseId}/lessons/${publishedLesson.lessonId}`));
      expect(visible.lessonVersionId).toBe(after.units[0].lessons[0].lessonVersionId);
      expect(visible.objective).toContain('Reconciled with the saved revision.');
      expect(JSON.stringify(visible)).not.toMatch(/correctOptionId|feedback/);
      const endpoint = `/api/v1/courses/${courseId}/lessons/${publishedLesson.lessonId}/attempts`;
      const originalBody = firstAttempt.response.request().postDataJSON() as unknown;
      const replay = await student.request.post(endpoint, { data: originalBody, headers: { Origin: appOrigin(), 'Idempotency-Key': firstAttempt.key } });
      expect(replay.status()).toBe(200);
      expect(attemptResultSchema.parse((await replay.json()).data)).toEqual(firstAttempt.result);
      expect(outlineSchema.parse(await apiData(student, `/courses/${courseId}/outline`)).courseProgress).toEqual(after.courseProgress);
      const stale = await student.request.post(endpoint, { data: originalBody, headers: { Origin: appOrigin(), 'Idempotency-Key': randomUUID() } });
      expect(stale.status()).toBe(409);
      expect((await stale.json()).error.code).toBe('lesson_changed');
      expect(await storedAttempts(courseId, learner.id)).toEqual(history);
      await student.goto('/campus');
      const course = student.getByRole('article').filter({ has: student.getByRole('heading', { name: title, exact: true }) });
      await expect(course.getByText('1 de 2 lecciones', { exact: true })).toBeVisible();
      await course.getByRole('link', { name: 'Continuar', exact: true }).click();
      await expect(student.getByRole('heading', { level: 1, name: publishedLesson.title })).toBeVisible();
      await expect(student.getByText(visible.objective, { exact: true })).toBeVisible();
    });

    await test.step('Una cuenta sin matrícula obtiene 404 y no ve el contenido', async () => {
      await login(outsider, fixture.outsider, 'student');
      const response = await outsider.request.get(`/api/v1/courses/${courseId}/lessons/${publishedLesson.lessonId}`);
      expect(response.status()).toBe(404);
      await outsider.goto(`/cursos/${courseId}/lecciones/${publishedLesson.lessonId}`);
      await expect(outsider.getByRole('heading', { level: 1, name: demoDocument.units[0].lessons[0].title })).toHaveCount(0);
      await expect(outsider.getByRole('radio')).toHaveCount(0);
    });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
