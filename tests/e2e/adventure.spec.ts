import { expect, test } from "@playwright/test";
import { adventureMissions } from "../../src/lib/adventure-content";

test("las dos misiones permiten completar, revisar y recuperar solo el recorrido", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const mission of adventureMissions) {
    await page.goto(`/aventura/${mission.id}`);
    await expect(page.getByRole("heading", { level: 1, name: mission.title })).toBeVisible();
    for (const step of mission.steps) {
      await expect(page.getByRole("heading", { level: 2, name: step.title, exact: true })).toBeVisible();
      if (step.questions?.length) {
        await page.getByRole("button", { name: "Comprobar respuestas" }).click();
        await expect(page.locator("main").getByRole("alert")).toContainText("Elige una respuesta");
        for (const [i, question] of step.questions.entries()) {
          await page.locator("fieldset").nth(i).getByRole("radio").nth(question.answer).check();
        }
        await page.getByRole("button", { name: "Comprobar respuestas" }).click();
        await expect(page.getByRole("status")).toContainText(`${step.questions.length} de ${step.questions.length}`);
      }
      if (step.speaking) await page.getByLabel("Ensayé en voz alta con ayuda del modelo.").check();
      if (step.writing) {
        await page.getByRole("textbox").fill("Hello! My name is Fictional Explorer. I am a student.");
        await page.getByLabel("Comparé mi texto con el modelo.").check();
      }
      await page.getByRole("button", { name: /Completar (y continuar|el recorrido)/ }).click();
    }
    await expect(page.getByRole("heading", { name: "¡Una nueva llave para tu mapa!" })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`${mission.steps.length} de ${mission.steps.length} paradas completadas`)).toBeVisible();
    const stored = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    expect(JSON.stringify(stored)).not.toContain("Fictional Explorer");
    await page.getByRole("button", { name: "Reiniciar recorrido" }).click();
    await expect(page.getByText(`0 de ${mission.steps.length} paradas completadas`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("portada y misión legibles en escritorio y móvil", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [name, path] of [["map", "/aventura"], ["mission", "/aventura/hello-explorer"]]) {
      await page.goto(path);
      await page.locator("main img").first().evaluate(async (img: HTMLImageElement) => { await img.decode(); });
      await expect.poll(() => page.locator("main img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(page.locator("main img").first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/adventure-${name}-${viewport.width}.png`, fullPage: true, animations: "disabled" });
      await page.screenshot({ path: `test-results/adventure-${name}-${viewport.width}-viewport.png`, animations: "disabled" });
    }
  }
});

test("el modelo oral puede escucharse, detenerse y recuperarse de un fallo de voz", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { spoken: [] as string[], stopped: 0, fail: false };
    Object.assign(window, { adventureSpeechTest: state });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [],
      cancel: () => { state.stopped++; },
      speak: (utterance: SpeechSynthesisUtterance) => {
        state.spoken.push(utterance.text);
        if (state.fail) utterance.dispatchEvent(new SpeechSynthesisErrorEvent("error", { utterance, error: "synthesis-unavailable" }));
      },
    } });
  });
  await page.goto("/aventura/hello-explorer");
  await page.getByRole("button", { name: /Meet a New Friend/ }).click();
  await page.getByRole("button", { name: "Completar y continuar" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Ensaya el ejemplo");
  await page.getByRole("button", { name: "Escuchar modelo oral" }).click();
  const expected = adventureMissions[0].steps.find(step => step.speaking && step.title === "Meet a New Friend")!.speaking!.model;
  expect(await page.evaluate(() => (window as unknown as Window & { adventureSpeechTest: { spoken: string[] } }).adventureSpeechTest.spoken)).toEqual([expected]);
  await page.getByRole("button", { name: "Detener audio" }).click();
  await expect(page.getByRole("button", { name: "Detener audio" })).toHaveCount(0);
  await page.evaluate(() => { (window as unknown as Window & { adventureSpeechTest: { fail: boolean } }).adventureSpeechTest.fail = true; });
  await page.getByRole("button", { name: "Escuchar modelo oral" }).click();
  await expect(page.getByRole("status")).toContainText("No se pudo reproducir la voz");
  await expect(page.getByText(expected, { exact: true })).toBeVisible();
});
