import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adventureMissions } from "../src/lib/adventure-content";
import { adventureCourseDocument } from "../src/lib/adventure-templates";
import { publishDocumentSchema } from "../src/lib/contracts";

describe("the actual two-module adventure content", () => {
  it("is a valid publishable A1 school course with every source question", () => {
    const document = publishDocumentSchema.parse(adventureCourseDocument);
    expect(document).toMatchObject({ level: "A1", audience: "school" });
    expect(document.units.map(unit => unit.id)).toEqual(["hello-explorer", "my-world"]);
    expect(document.units.flatMap(unit => unit.lessons)).toHaveLength(16);
    expect(document.units.flatMap(unit => unit.lessons.flatMap(lesson => lesson.activities))).toHaveLength(78);
  });

  it.each(adventureMissions)("keeps every scene and answer when importing $title", mission => {
    const unit = adventureCourseDocument.units.find(item => item.id === mission.id)!;
    const blocks = unit.lessons.flatMap(lesson => lesson.blocks);
    const activities = unit.lessons.flatMap(lesson => lesson.activities);
    const questions = mission.steps.flatMap(step => step.questions ?? []);
    expect(new Set(mission.steps.map(step => step.id)).size).toBe(mission.steps.length);
    expect(activities.map(activity => activity.id)).toEqual(questions.map(question => question.id));

    for (const step of mission.steps) {
      const block = blocks.find(item => item.id === `${step.id}-text`);
      expect(block, `Missing scene: ${step.id}`).toBeDefined();
      expect(block!.text).toContain(step.instruction);
      for (const paragraph of step.paragraphs) expect(block!.text).toContain(paragraph);
      if (step.listening) expect(block!.text).toContain(step.listening.script);
      if (step.speaking) expect(block!.text).toContain(step.speaking.model);
      if (step.writing) expect(block!.text).toContain(step.writing.model);
      for (const question of step.questions ?? []) {
        expect(Number.isInteger(question.answer)).toBe(true);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
        expect(new Set(question.options).size).toBe(question.options.length);
        const lesson = unit.lessons.find(item => item.id === `${mission.id}-${step.id}`)!;
        const activity = lesson.activities.find(item => item.id === question.id)!;
        expect(activity.options.find(option => option.id === activity.correctOptionId)?.text).toBe(question.options[question.answer]);
      }
    }
    expect(mission.image.startsWith("/adventure/")).toBe(true);
    expect(existsSync(new URL(`../public${mission.image}`, import.meta.url))).toBe(true);
    expect(mission.imageAlt.trim().length).toBeGreaterThan(0);
  });
});
