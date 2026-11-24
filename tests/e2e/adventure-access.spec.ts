import { mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { test, expect, type Page } from '@playwright/test';
import { adventureMissions } from '../../src/lib/adventure-content';
import { profileSchema } from '../../src/lib/contracts';
import { adventureMembersSchema, adventureProgressSchema, type AdventureProgress } from '../../src/lib/adventure-access-contracts';

const projectUrl = 'https://gpixjzkfovepghpdiikp.supabase.co';
const appOrigin = 'http://127.0.0.1:3002';
const fixture = {
  admin: process.env.EIA_HOSTED_ADMIN_EMAIL!, teacher: process.env.EIA_HOSTED_TEACHER_EMAIL!,
  student: process.env.EIA_HOSTED_STUDENT_EMAIL!, outsider: process.env.EIA_HOSTED_OUTSIDER_EMAIL!,
};
const profileIds = new Map<string, string>();
const password = () => process.env.EIA_HOSTED_TEST_PASSWORD!;
const home = { admin: '/administracion', teacher: '/docente', student: '/campus' };
const missionId = 'hello-explorer';
const firstStep = adventureMissions[0].steps[0];
const progressPath = `/api/v1/adventure/progress/${missionId}`;

test.beforeAll(async () => {
  // Repeat config safeguards so selecting this spec via another config cannot
  // mutate an unapproved project, origin or user.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== projectUrl || process.env.APP_URL !== appOrigin || process.env.E2E_BASE_URL !== appOrigin) {
    throw new Error('Destino de verificación de acceso no autorizado.');
  }
  if (Object.values(fixture).some(email => !email || !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email)) || new Set(Object.values(fixture).map(email => email.toLowerCase())).size !== 4 || !password() || password().length < 12) {
    throw new Error('Se requieren las cuatro identidades ficticias autorizadas y su contraseña de prueba.');
  }
  const reader = createClient(projectUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
  const { data, error } = await reader.from('profiles').select('id,email,role,active').in('email', Object.values(fixture));
  if (error || !data) throw new Error('Preflight: no se pudieron verificar las cuatro cuentas ficticias. No se modificó ningún permiso.');
  expect(data.map(row => `${row.email}:${row.role}:${row.active}`).sort()).toEqual([
    `${fixture.admin}:admin:true`, `${fixture.teacher}:teacher:true`, `${fixture.student}:student:true`, `${fixture.outsider}:student:true`,
  ].sort());
  data.forEach(row => profileIds.set(row.email, row.id));
  const response = await fetch(`${appOrigin}/api/v1/me`, { signal: AbortSignal.timeout(10_000) });
  expect(response.status, 'Debe responder el servidor configurado sin sesión').toBe(401);
});

async function login(page: Page, email: string, role: 'teacher' | 'admin' | 'student') {
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
  await expect(page).toHaveURL(new RegExp(`${home[role]}$`));
  await page.goto('/panel');
  await expect(page).toHaveURL(new RegExp(`${home[role]}$`));
  return profile;
}

async function getMembers(admin: Page) {
  const response = await admin.request.get('/api/v1/adventure/members');
  expect(response.status()).toBe(200);
  return adventureMembersSchema.parse((await response.json()).data);
}

async function getProgress(page: Page, id = missionId) {
  const response = await page.request.get(`/api/v1/adventure/progress/${id}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  return adventureProgressSchema.parse((await response.json()).data);
}

async function changeAccess(admin: Page, userId: string, enabled: boolean) {
  if (![profileIds.get(fixture.teacher), profileIds.get(fixture.student)].includes(userId)) throw new Error('Solo se permite ajustar las dos cuentas ficticias previstas.');
  const response = await admin.request.put(`/api/v1/adventure/members/${userId}`, { headers: { Origin: appOrigin }, data: { enabled } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ data: { userId, enabled } });
}

async function changeStep(student: Page, id: string, stepId: string, completed: boolean) {
  const response = await student.request.put(`/api/v1/adventure/progress/${id}`, { headers: { Origin: appOrigin }, data: { stepId, completed } });
  expect(response.status()).toBe(200);
  return adventureProgressSchema.parse((await response.json()).data);
}

async function toggleInUI(admin: Page, email: string, enabled: boolean) {
  await admin.getByLabel('Buscar persona', { exact: true }).fill(email);
  const label = `${enabled ? 'Permitir acceso' : 'Retirar acceso'} a ${email}`;
  const targetId = profileIds.get(email)!;
  const pending = admin.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/adventure/members/${targetId}` && response.request().method() === 'PUT');
  await admin.getByRole('button', { name: label, exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ data: { userId: targetId, enabled } });
  await expect(admin.getByRole('button', { name: `${enabled ? 'Retirar acceso' : 'Permitir acceso'} a ${email}`, exact: true })).toBeEnabled();
}

async function expectCatalog(page: Page, visible = true) {
  const catalog = page.getByRole('region', { name: 'English Learning Adventure', exact: true });
  if (!visible) {
    await expect(catalog).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Mi aventura', exact: true })).toHaveCount(0);
    return;
  }
  await expect(catalog).toBeVisible();
  await expect(catalog.locator('a[href^="/aventura/"]')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Mi aventura', exact: true })).toBeVisible();
  for (const mission of adventureMissions) await expect(catalog.getByRole('heading', { name: mission.title, exact: true })).toBeVisible();
}

async function captureRole(page: Page, role: 'admin' | 'teacher' | 'student') {
  await mkdir('docs/evidencia/access', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await expectCatalog(page);
    const catalog = page.getByRole('region', { name: 'English Learning Adventure', exact: true });
    await expect.poll(() => catalog.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Sin desbordamiento horizontal').toBe(true);
    // Only the approved fictional accounts and new course appear in evidence.
    // Existing authored-course sections are unrelated and are masked.
    await page.screenshot({ path: `docs/evidencia/access/roles-${role}-${width}.png`, fullPage: true, mask: [page.locator('.courses-section'), page.locator('.campus-next')] });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

async function assertBlocked(page: Page, role: 'teacher' | 'student') {
  await page.goto(home[role]);
  await expectCatalog(page, false);
  const access = await page.request.get('/api/v1/adventure/access');
  expect(access.status()).toBe(200);
  expect(await access.json()).toEqual({ data: { allowed: false } });
  for (const path of ['/aventura', '/aventura/hello-explorer', '/aventura/my-world']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Este curso no está habilitado para tu cuenta', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Paradas de la misión' })).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
  }
  for (const response of [
    await page.request.get(progressPath),
    await page.request.put(progressPath, { headers: { Origin: appOrigin }, data: { stepId: firstStep.id, completed: true } }),
  ]) {
    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'adventure_forbidden' } });
  }
}

test('aventura por roles: permisos individuales, rutas privadas y progreso entre dispositivos', async ({ page: admin, browser }, testInfo) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ baseURL: appOrigin, viewport: { width: 1440, height: 1000 } })));
  const [teacher, student, outsider, anonymous] = await Promise.all(contexts.map(context => context.newPage()));
  const originalEnabled = new Map<string, boolean>();
  const originalProgress: AdventureProgress[] = [];
  let changedProgress = false;
  let outsiderProgress: AdventureProgress | null = null;
  let crossDevice: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  try {
    await test.step('Anónimos no reciben las misiones ni sus preguntas', async () => {
      for (const path of ['/aventura', '/aventura/hello-explorer', '/aventura/my-world']) {
        await anonymous.goto(path);
        await expect(anonymous).toHaveURL(/\/ingresar(?:\?|$)/);
        await expect(anonymous.getByRole('navigation', { name: 'Paradas de la misión' })).toHaveCount(0);
        for (const mission of adventureMissions) {
          const question = mission.steps.flatMap(step => step.questions ?? [])[0];
          expect(await anonymous.content()).not.toContain(question.prompt);
        }
      }
      expect((await anonymous.request.get(progressPath)).status()).toBe(401);
    });

    await test.step('Administración consulta los dos módulos y conserva los permisos originales', async () => {
      await login(admin, fixture.admin, 'admin');
      const members = await getMembers(admin);
      for (const email of [fixture.teacher, fixture.student]) {
        const member = members.find(item => item.id === profileIds.get(email));
        expect(member).toBeDefined();
        expect(member?.email).toBe(email);
        originalEnabled.set(member!.id, member!.enabled);
      }
      await testInfo.attach('adventure-access-permissions-before', {
        body: JSON.stringify({ projectRef: 'gpixjzkfovepghpdiikp', enabled: [...originalEnabled].map(([userId, enabled]) => ({ userId, enabled })) }),
        contentType: 'application/json',
      });
      // Temporary setup is limited to the two verified fixtures and is restored
      // even when subsequent UI assertions fail.
      for (const [id, enabled] of originalEnabled) if (!enabled) await changeAccess(admin, id, true);
      await admin.reload();
      await expectCatalog(admin);
      const manager = admin.getByRole('region', { name: 'Quién puede entrar', exact: true });
      await manager.getByLabel('Buscar persona', { exact: true }).fill(fixture.teacher);
      await expect(manager.getByRole('listitem')).toHaveCount(1);
      await expect(manager.getByText(fixture.teacher, { exact: true })).toBeVisible();
      await captureRole(admin, 'admin');
    });

    await test.step('Docente y estudiante ven y abren ambos módulos desde sus paneles', async () => {
      await login(teacher, fixture.teacher, 'teacher');
      await login(student, fixture.student, 'student');
      originalProgress.push(await getProgress(student, 'hello-explorer'), await getProgress(student, 'my-world'));
      await testInfo.attach('adventure-access-progress-before', {
        body: JSON.stringify({ userId: profileIds.get(fixture.student), missions: originalProgress }),
        contentType: 'application/json',
      });
      for (const [page, role] of [[teacher, 'teacher'], [student, 'student']] as const) {
        await captureRole(page, role);
        for (const mission of adventureMissions) {
          await page.goto(home[role]);
          await expectCatalog(page);
          await page.getByRole('region', { name: 'English Learning Adventure', exact: true }).locator(`a[href="/aventura/${mission.id}"]`).click();
          await expect(page).toHaveURL(new RegExp(`/aventura/${mission.id}$`));
          await expect(page.getByRole('heading', { name: mission.title, level: 1, exact: true })).toBeVisible();
        }
      }
      await student.goto('/docente');
      await expect(student).toHaveURL(/\/campus$/);
      await teacher.goto('/administracion');
      await expect(teacher).toHaveURL(/\/docente$/);
    });

    await test.step('Los estudiantes no administran permisos ni reciben el progreso de otra cuenta', async () => {
      expect((await student.request.get('/api/v1/adventure/members')).status()).toBe(403);
      const denied = await student.request.put(`/api/v1/adventure/members/${profileIds.get(fixture.teacher)}`, { headers: { Origin: appOrigin }, data: { enabled: false } });
      expect(denied.status()).toBe(403);
      await login(outsider, fixture.outsider, 'student');
      expect((await outsider.request.get('/api/v1/adventure/members')).status()).toBe(403);
      const permission = await outsider.request.get('/api/v1/adventure/access');
      expect(permission.status()).toBe(200);
      if ((await permission.json()).data.allowed) outsiderProgress = await getProgress(outsider);
    });

    await test.step('La primera parada se guarda por interfaz y aparece en otra sesión móvil', async () => {
      changedProgress = true;
      // Make the UI completion a real transition even if this fixture has been
      // used before. Finally restores the original completed-step sets exactly.
      if (originalProgress[0].completedStepIds.includes(firstStep.id)) await changeStep(student, missionId, firstStep.id, false);
      await student.goto(`/aventura/${missionId}`);
      await student.getByRole('checkbox', { name: 'Ensayé en voz alta con ayuda del modelo.', exact: true }).check();
      const pending = student.waitForResponse(response => new URL(response.url()).pathname === progressPath && response.request().method() === 'PUT');
      await student.getByRole('button', { name: 'Completar y continuar', exact: true }).click();
      const response = await pending;
      expect(response.status()).toBe(200);
      const saved = adventureProgressSchema.parse((await response.json()).data);
      expect(saved.completedStepIds).toContain(firstStep.id);
      expect((await getProgress(student)).completedStepIds).toEqual(saved.completedStepIds);
      crossDevice = await browser.newContext({ baseURL: appOrigin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const mobile = await crossDevice.newPage();
      await login(mobile, fixture.student, 'student');
      await mobile.goto(`/aventura/${missionId}`);
      expect(await getProgress(mobile)).toEqual(saved);
      await expect(mobile.getByRole('progressbar', { name: 'Paradas completadas en mi cuenta', exact: true })).toHaveAttribute('value', String(saved.completedStepIds.length));
      expect(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (outsiderProgress) expect(await getProgress(outsider)).toEqual(outsiderProgress);
    });

    await test.step('Administración retira y restablece acceso individual sin perder el progreso', async () => {
      const saved = await getProgress(student);
      await admin.goto('/administracion');
      await toggleInUI(admin, fixture.teacher, false);
      await toggleInUI(admin, fixture.student, false);
      await assertBlocked(teacher, 'teacher');
      await assertBlocked(student, 'student');
      await toggleInUI(admin, fixture.teacher, true);
      await toggleInUI(admin, fixture.student, true);
      for (const [page, role] of [[teacher, 'teacher'], [student, 'student']] as const) {
        await page.goto(home[role]);
        await expectCatalog(page);
      }
      expect(await getProgress(student)).toEqual(saved);
    });
  } finally {
    const restorationErrors: string[] = [];
    try {
      if (originalEnabled.size) {
        if ((await admin.request.get('/api/v1/me')).status() === 401) await login(admin, fixture.admin, 'admin');
        if (changedProgress && originalProgress.length) {
          try {
            await changeAccess(admin, profileIds.get(fixture.student)!, true);
            if ((await student.request.get('/api/v1/me')).status() === 401) await login(student, fixture.student, 'student');
            for (const initial of originalProgress) {
              const current = await getProgress(student, initial.missionId);
              for (const id of current.completedStepIds) if (!initial.completedStepIds.includes(id)) await changeStep(student, initial.missionId, id, false);
              for (const id of initial.completedStepIds) if (!current.completedStepIds.includes(id)) await changeStep(student, initial.missionId, id, true);
              expect(await getProgress(student, initial.missionId)).toEqual(initial);
            }
          } catch { restorationErrors.push('No se confirmó la restauración exacta del progreso de la cuenta estudiantil ficticia.'); }
        }
        for (const [id, enabled] of originalEnabled) {
          try { await changeAccess(admin, id, enabled); }
          catch { restorationErrors.push(`No se confirmó la restauración del permiso de la cuenta ficticia ${id}.`); }
        }
        const members = await getMembers(admin);
        for (const [id, enabled] of originalEnabled) {
          if (members.find(member => member.id === id)?.enabled !== enabled) restorationErrors.push(`El permiso de la cuenta ficticia ${id} no coincide con el estado inicial.`);
        }
        await testInfo.attach('adventure-access-restoration', {
          body: JSON.stringify({ projectRef: 'gpixjzkfovepghpdiikp', restoredPermissions: restorationErrors.length === 0, restoredProgress: !changedProgress || restorationErrors.length === 0, fixtureIds: [...originalEnabled.keys()], errors: restorationErrors }),
          contentType: 'application/json',
        });
      }
    } finally {
      await Promise.all([...contexts, ...(crossDevice ? [crossDevice] : [])].map(context => context.close()));
    }
    if (restorationErrors.length) throw new Error(restorationErrors.join(' '));
  }
});
