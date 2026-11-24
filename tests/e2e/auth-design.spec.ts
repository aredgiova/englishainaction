import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`acceso ilustrado y formularios accesibles a ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    let loginRequests = 0;
    let recoveryRequests = 0;
    let passwordRequests = 0;
    // These are UI tests. Every authentication mutation is intercepted before
    // it can reach an account or send a recovery message.
    await page.route("**/api/v1/auth/**", async route => {
      const path = new URL(route.request().url()).pathname;
      expect(route.request().method()).toBe("POST");
      if (path.endsWith("/login")) {
        loginRequests++;
        expect(route.request().postDataJSON()).toEqual({ email: "explorer@example.invalid", password: "fictitious_password_123" });
        await route.fulfill({ status: 401, json: { error: { code: "invalid_credentials", message: "Correo o contraseña incorrectos." } } });
      } else if (path.endsWith("/recover")) {
        recoveryRequests++;
        expect(route.request().postDataJSON()).toEqual({ email: "explorer@example.invalid" });
        await route.fulfill({ status: 200, json: { data: { sent: true } } });
      } else {
        passwordRequests++;
        await route.fulfill({ status: 400, json: { error: { code: "test_blocked", message: "Solicitud bloqueada por la prueba de interfaz." } } });
      }
    });

    await page.goto("/ingresar");
    await expect(page.getByRole("heading", { level: 1, name: "Tu aventura continúa." })).toBeVisible();
    const scene = page.getByRole("img", { name: "Alex y Byte te dan la bienvenida en el puerto de las islas de aventura." });
    await scene.evaluate(async (img: HTMLImageElement) => img.decode());
    await expect(scene).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al formulario" })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Correo electrónico", { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Ingresar a la academia", exact: true })).toBeInViewport();

    await page.getByLabel("Correo electrónico", { exact: true }).fill("explorer@example.invalid");
    const password = page.getByLabel("Contraseña", { exact: true });
    await password.fill("fictitious_password_123");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(page.getByRole("button", { name: "Ocultar contraseña", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Ocultar contraseña", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Ingresar a la academia", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Correo o contraseña incorrectos.");
    await expect(page.getByLabel("Correo electrónico", { exact: true })).toHaveValue("explorer@example.invalid");
    await expect(password).toHaveValue("fictitious_password_123");
    await expect(page.getByRole("button", { name: "Ingresar a la academia", exact: true })).toBeEnabled();
    expect(loginRequests).toBe(1);

    await page.getByRole("link", { name: "Olvidé mi contraseña", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Recupera tu acceso" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator("input[type=password]")).toHaveCount(0);
    await page.getByLabel("Correo electrónico", { exact: true }).fill("explorer@example.invalid");
    await page.getByRole("button", { name: "Enviar enlace", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Si la cuenta existe, recibirás un enlace para recuperar el acceso.");
    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
    expect(recoveryRequests).toBe(1);
    await page.getByRole("link", { name: "Volver al acceso", exact: true }).click();
    await expect(page).toHaveURL(/\/ingresar$/);

    await page.goto("/definir-clave");
    await expect(page.getByRole("heading", { level: 1, name: "Define tu contraseña" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("fictitious_password_123");
    await page.getByLabel("Confirma la contraseña", { exact: true }).fill("different_password_123");
    await page.getByRole("button", { name: "Guardar y continuar", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Las contraseñas no coinciden. Revisa ambos campos.");
    expect(passwordRequests).toBe(0);
    await page.getByRole("button", { name: "Mostrar contraseña", exact: true }).click();
    await expect(page.getByLabel("Nueva contraseña", { exact: true })).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Confirma la contraseña", { exact: true })).toHaveAttribute("type", "text");
    expect(pageErrors).toEqual([]);
  });
}

test("los avisos de enlace y sesión conservan una salida clara", async ({ page }) => {
  await page.goto("/ingresar?error=invalid_link");
  await expect(page.locator("main").getByRole("alert")).toContainText("El enlace no es válido o ha caducado.");
  await expect(page.getByRole("link", { name: "Olvidé mi contraseña", exact: true })).toHaveAttribute("href", "/recuperar-clave");
  await page.goto("/ingresar?error=session_expired");
  await expect(page.locator("main").getByRole("alert")).toHaveText("Tu sesión caducó. Ingresa de nuevo para retomar tu actividad.");
  await expect(page.getByRole("button", { name: "Ingresar a la academia", exact: true })).toBeVisible();
});
