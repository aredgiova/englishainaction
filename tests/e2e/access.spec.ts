import { test, expect } from '@playwright/test';

test('acceso legible en escritorio y móvil, sin desbordamiento horizontal', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const response = await page.goto('/ingresar');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('textbox', { name: /correo/i })).toBeVisible();
    await expect(page.getByLabel(/^contraseña$/i)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/access-${viewport.width}.png`, fullPage: true });
  }
});

test('permite abrir recuperación y presenta validación nativa de correo', async ({ page }) => {
  await page.goto('/recuperar-clave');
  const email = page.getByRole('textbox', { name: /correo/i });
  if (await email.isEnabled()) {
    await email.fill('correo-invalido');
    expect(await email.evaluate((element: HTMLInputElement) => element.validity.typeMismatch)).toBe(true);
  } else {
    await expect(page.getByText(/supabase/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /enviar/i })).toBeDisabled();
  }
  await expect(page.getByRole('button', { name: /enviar/i })).toBeVisible();
});
