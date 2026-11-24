import { createClient } from '@supabase/supabase-js';
import { test, expect, type Page, type Response } from '@playwright/test';
import { adventureCourseDocument } from '../../src/lib/adventure-templates';
import { courseSummarySchema, draftSchema, profileSchema, uuidSchema } from '../../src/lib/contracts';

const projectUrl = 'https://gpixjzkfovepghpdiikp.supabase.co';
const appOrigin = 'http://127.0.0.1:3002';
const fixture = {
  admin: process.env.EIA_HOSTED_ADMIN_EMAIL!, teacher: process.env.EIA_HOSTED_TEACHER_EMAIL!,
  student: process.env.EIA_HOSTED_STUDENT_EMAIL!, outsider: process.env.EIA_HOSTED_OUTSIDER_EMAIL!,
};
const password = () => process.env.EIA_HOSTED_TEST_PASSWORD!;
const profileIds = new Map<string, string>();
const service = () => createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }) },
});

test.beforeAll(async () => {
  // Keep the guards here too: selecting this spec with another config must fail
  // before signing in or creating anything.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== projectUrl || process.env.APP_URL !== appOrigin || process.env.E2E_BASE_URL !== appOrigin) {
    throw new Error('Destino de aceptación de aventura no autorizado.');
  }
  if (Object.values(fixture).some(email => !email || !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email)) || new Set(Object.values(fixture).map(email => email.toLowerCase())).size !== 4 || !password() || password().length < 12) {
    throw new Error('Se requieren las cuatro identidades ficticias autorizadas y su contraseña de prueba.');
  }
  const { data, error } = await service().from('profiles').select('id,email,role,active').in('email', Object.values(fixture));
  if (error || !data) throw new Error('Preflight: no se pudieron verificar los perfiles ficticios. No se creó ningún curso.');
  expect(data.map(row => `${row.email}:${row.role}:${row.active}`).sort()).toEqual([
    `${fixture.admin}:admin:true`, `${fixture.teacher}:teacher:true`, `${fixture.student}:student:true`, `${fixture.outsider}:student:true`,
  ].sort());
  data.forEach(row => profileIds.set(row.email, row.id));
  for (const table of ['courses', 'drafts', 'releases']) {
    const result = await service().from(table).select('*').limit(0);
    if (result.error) throw new Error(`Preflight: falta acceso administrativo de lectura a ${table}. No se creó ningún curso.`);
  }
  const response = await fetch(`${appOrigin}/api/v1/me`, { signal: AbortSignal.timeout(10_000) });
  expect(response.status, 'El servidor configurado debe responder sin sesión').toBe(401);
});

async function login(page: Page, email: string, role: 'teacher' | 'student') {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  try { await page.getByLabel('Contraseña', { exact: true }).fill(password()); }
  catch { throw new Error('No se pudo completar el campo de contraseña de la cuenta ficticia.'); }
  const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar a la academia', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const profile = profileSchema.parse((await response.json()).data);
  expect(profile.id).toBe(profileIds.get(email));
  expect(profile.role).toBe(role);
  await expect(page).toHaveURL(role === 'teacher' ? /\/docente$/ : /\/campus$/);
  return profile;
}

async function readDraft(page: Page, courseId: string) {
  const response = await page.request.get(`/api/v1/courses/${courseId}/draft`);
  expect(response.status()).toBe(200);
  return draftSchema.parse((await response.json()).data);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'La página no debe desbordar horizontalmente').toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Vista de estudiante', exact: true });
  if (await dialog.count()) expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), 'El diálogo no debe desbordar horizontalmente').toBe(true);
}

async function verifyPreview(page: Page) {
  const lessons = adventureCourseDocument.units.flatMap(unit => unit.lessons);
  const first = lessons[0];
  const last = lessons.at(-1)!;
  const trigger = page.getByRole('button', { name: 'Previsualizar como estudiante', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const preview = page.getByRole('dialog', { name: 'Vista de estudiante', exact: true });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Vista de estudiante', exact: true })).toBeFocused();
  await expect(preview.getByText(first.objective, { exact: true })).toBeVisible();
  await expect(preview.getByText(first.activities[0].feedback.correct, { exact: true })).toHaveCount(0);
  const picker = preview.getByRole('combobox', { name: 'Lección de la vista previa', exact: true });
  await expect(picker.locator('option')).toHaveCount(16);
  await page.keyboard.press('Tab');
  await expect(preview.getByRole('button', { name: 'Volver al editor', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker).toBeFocused();
  await picker.press('End');
  await expect(picker).toHaveValue(last.id);
  await expect(preview.getByText(last.objective, { exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Siguiente lección', exact: true })).toBeDisabled();
  await noOverflow(page);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

async function deleteCreatedDraft(courseId: string, ownerId: string) {
  // The ID comes only from this test's successful create response, never a title
  // search. Refuse cleanup if it is no longer this teacher's unpublished draft.
  const client = service();
  const current = await client.from('courses').select('id,owner_id,current_release_id').eq('id', courseId).eq('owner_id', ownerId).maybeSingle();
  if (current.error || !current.data || current.data.current_release_id !== null) {
    throw new Error(`No se eliminó el curso de prueba ${courseId}: no se pudo confirmar el propietario y su estado sin publicación.`);
  }
  const releases = await client.from('releases').select('id').eq('course_id', courseId);
  if (releases.error || !releases.data || releases.data.length) throw new Error(`No se eliminó el curso de prueba ${courseId}: no se confirmó la ausencia de publicaciones.`);
  const removed = await client.from('courses').delete().eq('id', courseId).eq('owner_id', ownerId).is('current_release_id', null).select('id');
  if (removed.error || removed.data?.length !== 1 || removed.data[0].id !== courseId) throw new Error(`No se pudo eliminar exclusivamente el curso de prueba ${courseId}.`);
  const [course, draft] = await Promise.all([
    client.from('courses').select('id').eq('id', courseId).maybeSingle(),
    client.from('drafts').select('course_id').eq('course_id', courseId).maybeSingle(),
  ]);
  if (course.error || draft.error || course.data || draft.data) throw new Error(`No se confirmó la limpieza del curso de prueba ${courseId} y su borrador.`);
}

test('aventura alojada: importa un borrador privado, lo recupera y permite revisar sus 16 lecciones', async ({ page: teacher, browser }, testInfo) => {
  const studentContext = await browser.newContext({ baseURL: appOrigin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const student = await studentContext.newPage();
  let courseId = '';
  let ownerId = '';
  let createRequests = 0;
  const captures: Promise<void>[] = [];
  const watchCreate = (response: Response) => {
    if (new URL(response.url()).pathname !== '/api/v1/courses' || response.request().method() !== 'POST') return;
    createRequests++;
    captures.push((async () => {
      if (response.status() !== 201) return;
      const payload = await response.json().catch(() => null);
      const parsed = uuidSchema.safeParse(payload?.data?.courseId);
      if (parsed.success && !courseId) courseId = parsed.data;
    })());
  };
  teacher.on('response', watchCreate);
  try {
    await test.step('El docente crea un único curso desde la plantilla de aventura', async () => {
      ownerId = (await login(teacher, fixture.teacher, 'teacher')).id;
      await noOverflow(teacher);
      const starter = teacher.getByRole('region', { name: 'Prepara los dos módulos de aventura' });
      await expect(starter).toBeVisible();
      const create = starter.getByRole('button', { name: 'Crear borrador con los dos módulos', exact: true });
      await expect(create).toBeEnabled();
      const responsePromise = teacher.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/courses' && response.request().method() === 'POST');
      await create.click();
      const response = await responsePromise;
      await Promise.all(captures);
      expect(response.status()).toBe(201);
      expect(uuidSchema.safeParse(courseId).success, 'Debe conocerse el ID exacto incluso si luego falla el guardado').toBe(true);
      await expect(teacher).toHaveURL(new RegExp(`/cursos/${courseId}/editar$`));
      const draft = await readDraft(teacher, courseId);
      expect(draft.document).toEqual(adventureCourseDocument);
      expect(draft.document.units).toHaveLength(2);
      expect(draft.document.units.flatMap(unit => unit.lessons)).toHaveLength(16);
      expect(draft.revision).toBe(2);
      const responseCourses = await teacher.request.get('/api/v1/courses');
      expect(responseCourses.status()).toBe(200);
      const courses = courseSummarySchema.array().parse((await responseCourses.json()).data);
      expect(courses.find(course => course.courseId === courseId)).toMatchObject({ ownerId, published: false, releaseId: null, revision: 2 });
      const stored = await service().from('drafts').select('document,revision,author_id').eq('course_id', courseId).single();
      if (stored.error) throw new Error('No se pudo contrastar el borrador importado con su persistencia alojada.');
      expect(stored.data).toEqual({ document: adventureCourseDocument, revision: 2, author_id: ownerId });
    });

    await test.step('Recarga y vuelve al mismo borrador sin crear copias adicionales', async () => {
      await teacher.reload();
      expect((await readDraft(teacher, courseId)).document).toEqual(adventureCourseDocument);
      await teacher.getByRole('link', { name: 'Mis cursos y borradores', exact: true }).click();
      await expect(teacher).toHaveURL(/\/docente$/);
      const open = teacher.getByRole('link', { name: 'Abrir borrador de aventura', exact: true });
      await expect(open).toHaveAttribute('href', `/cursos/${courseId}/editar`);
      await expect(teacher.getByRole('button', { name: 'Crear borrador con los dos módulos', exact: true })).toHaveCount(0);
      await open.focus();
      await teacher.keyboard.press('Enter');
      await expect(teacher).toHaveURL(new RegExp(`/cursos/${courseId}/editar$`));
      expect(createRequests).toBe(1);
    });

    await test.step('La vista de estudiante funciona con teclado en escritorio y móvil', async () => {
      await verifyPreview(teacher);
      await teacher.setViewportSize({ width: 390, height: 844 });
      await noOverflow(teacher);
      await verifyPreview(teacher);
      await teacher.getByRole('link', { name: 'Mis cursos y borradores', exact: true }).click();
      await noOverflow(teacher);
      await expect(teacher.getByRole('link', { name: 'Abrir borrador de aventura', exact: true })).toHaveAttribute('href', `/cursos/${courseId}/editar`);
      expect((await readDraft(teacher, courseId)).revision).toBe(2);
    });

    await test.step('El estudiante puede visitar el laboratorio y no recibe el borrador privado', async () => {
      await login(student, fixture.student, 'student');
      const denied = await student.request.get(`/api/v1/courses/${courseId}/draft`);
      expect(denied.status()).toBe(403);
      expect(await denied.json()).toMatchObject({ error: { code: 'forbidden' } });
      const responseCourses = await student.request.get('/api/v1/courses');
      expect(responseCourses.status()).toBe(200);
      expect(courseSummarySchema.array().parse((await responseCourses.json()).data).some(course => course.courseId === courseId)).toBe(false);
      await student.getByRole('link', { name: 'Laboratorio de aventura', exact: true }).click();
      await expect(student).toHaveURL(/\/aventura$/);
      await expect(student.getByRole('heading', { name: 'Cada palabra abre un mundo.', exact: true })).toBeVisible();
      await noOverflow(student);
      expect(createRequests).toBe(1);
    });
  } finally {
    await Promise.allSettled(captures);
    teacher.off('response', watchCreate);
    try {
      if (courseId && ownerId) {
        await deleteCreatedDraft(courseId, ownerId);
        await testInfo.attach('adventure-hosted-cleanup', {
          body: JSON.stringify({ projectRef: 'gpixjzkfovepghpdiikp', courseId, cleaned: true, createdCourses: createRequests, published: false }),
          contentType: 'application/json',
        });
      }
    } finally { await studentContext.close(); }
  }
});
