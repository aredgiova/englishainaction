import { draftDocumentSchema, type CourseDocument, type Draft } from "./contracts";

export type AdventureImportCheckpoint =
  | { status: "uncertain" }
  | { status: "created" | "saved"; courseId: string; revision: number };

type Request = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
type SaveCheckpoint = (checkpoint: AdventureImportCheckpoint | null) => void;

/** A failed response must never turn a retry into a second course or overwrite a newer draft. */
export async function importAdventureDraft(
  document: CourseDocument,
  checkpoint: AdventureImportCheckpoint | null,
  request: Request,
  saveCheckpoint: SaveCheckpoint,
): Promise<string> {
  const template = draftDocumentSchema.parse(document);
  if (checkpoint?.status === "uncertain") {
    throw new Error("No pudimos confirmar si el curso se creó. Actualiza la lista y revisa tus borradores antes de crear otro.");
  }
  if (checkpoint?.status === "saved") return checkpoint.courseId;

  let created = checkpoint;
  if (!created) {
    saveCheckpoint({ status: "uncertain" });
    try {
      const result = await request<{ courseId: string; revision: number }>("/courses", "POST", {
        title: template.title, level: template.level, audience: template.audience,
      });
      created = { status: "created", ...result };
      saveCheckpoint(created);
    } catch (error) {
      // These application responses confirm rejection before course creation.
      const status = error && typeof error === "object" && "status" in error ? error.status : null;
      if (status === 401 || status === 403 || status === 422) saveCheckpoint(null);
      throw error;
    }
  } else {
    const current = await request<Draft>(`/courses/${created.courseId}/draft`);
    if (JSON.stringify(draftDocumentSchema.parse(current.document)) === JSON.stringify(template)) {
      saveCheckpoint({ status: "saved", courseId: created.courseId, revision: current.revision });
      return created.courseId;
    }
    if (current.revision !== created.revision) {
      throw new Error("Este borrador ya tiene otros cambios. Ábrelo en el editor para revisarlos; la plantilla no los reemplazará.");
    }
  }

  const saved = await request<{ revision: number }>(`/courses/${created.courseId}/draft`, "PUT", {
    expectedRevision: created.revision, document: template,
  });
  saveCheckpoint({ status: "saved", courseId: created.courseId, revision: saved.revision });
  return created.courseId;
}
