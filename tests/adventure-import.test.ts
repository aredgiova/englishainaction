import { expect, it, vi } from "vitest";
import { importAdventureDraft, type AdventureImportCheckpoint } from "../src/lib/adventure-import";
import type { CourseDocument } from "../src/lib/contracts";

const courseId = "e518664e-b773-4b5a-b2f4-a3f339de65b9";
const template: CourseDocument = {
  title: "English Learning Adventure", level: "A1", audience: "school",
  units: [{ id: "hello", title: "Hello, Explorer!", lessons: [] }, { id: "my-world", title: "My World", lessons: [] }],
};

it("creates and saves the two-unit draft without publishing", async () => {
  const request = vi.fn().mockResolvedValueOnce({ courseId, revision: 1 }).mockResolvedValueOnce({ revision: 2 });
  const save = vi.fn();
  expect(await importAdventureDraft(template, null, request, save)).toBe(courseId);
  expect(request.mock.calls).toEqual([
    ["/courses", "POST", { title: template.title, level: "A1", audience: "school" }],
    [`/courses/${courseId}/draft`, "PUT", { expectedRevision: 1, document: template }],
  ]);
  expect(save.mock.calls.map(call => call[0])).toEqual([
    { status: "uncertain" }, { status: "created", courseId, revision: 1 }, { status: "saved", courseId, revision: 2 },
  ]);
});

it("retries a failed save on the already-created course", async () => {
  let checkpoint: AdventureImportCheckpoint | null = null;
  const save = (value: AdventureImportCheckpoint | null) => { checkpoint = value; };
  const request = vi.fn().mockResolvedValueOnce({ courseId, revision: 1 }).mockRejectedValueOnce(new TypeError("Offline"));
  await expect(importAdventureDraft(template, null, request, save)).rejects.toThrow("Offline");
  expect(checkpoint).toEqual({ status: "created", courseId, revision: 1 });
  request.mockResolvedValueOnce({ courseId, revision: 1, document: { ...template, units: [] } }).mockResolvedValueOnce({ revision: 2 });
  await importAdventureDraft(template, checkpoint, request, save);
  expect(request.mock.calls.filter(call => call[0] === "/courses")).toHaveLength(1);
  expect(request.mock.calls.at(-1)).toEqual([`/courses/${courseId}/draft`, "PUT", { expectedRevision: 1, document: template }]);
});

it("recognizes a saved draft after a lost response even with reordered JSON keys", async () => {
  const document = { audience: "school", units: template.units, level: "A1", title: template.title };
  const request = vi.fn().mockResolvedValue({ courseId, revision: 2, document });
  const save = vi.fn();
  await expect(importAdventureDraft(template, { status: "created", courseId, revision: 1 }, request, save)).resolves.toBe(courseId);
  expect(request).toHaveBeenCalledExactlyOnceWith(`/courses/${courseId}/draft`);
  expect(save).toHaveBeenCalledWith({ status: "saved", courseId, revision: 2 });
});

it("preserves newer edits instead of replacing them on retry", async () => {
  const request = vi.fn().mockResolvedValue({ courseId, revision: 2, document: { ...template, title: "Revisión docente" } });
  await expect(importAdventureDraft(template, { status: "created", courseId, revision: 1 }, request, vi.fn())).rejects.toThrow("otros cambios");
  expect(request).toHaveBeenCalledExactlyOnceWith(`/courses/${courseId}/draft`);
});

it("blocks a second creation after an ambiguous failure", async () => {
  let checkpoint: AdventureImportCheckpoint | null = null;
  const save = (value: AdventureImportCheckpoint | null) => { checkpoint = value; };
  const request = vi.fn().mockRejectedValue(new TypeError("Offline"));
  await expect(importAdventureDraft(template, null, request, save)).rejects.toThrow("Offline");
  await expect(importAdventureDraft(template, checkpoint, request, save)).rejects.toThrow("confirmar si el curso se creó");
  expect(request).toHaveBeenCalledTimes(1);
});

it("allows a fresh attempt after an explicit session rejection", async () => {
  const request = vi.fn().mockRejectedValue({ status: 401 });
  const save = vi.fn();
  await expect(importAdventureDraft(template, null, request, save)).rejects.toEqual({ status: 401 });
  expect(save).toHaveBeenLastCalledWith(null);
});
