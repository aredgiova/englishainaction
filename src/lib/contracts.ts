import { z } from "zod";

/** Fase activa: 1. Shared by HTTP, domain services and client forms. */
export const ACTIVE_PHASE = 1 as const;
export const roleSchema = z.enum(["admin", "teacher", "student"]);
export const levelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export const audienceSchema = z.enum(["school", "university", "professional"]);
export const stableIdSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Usa letras, números, guiones o guiones bajos.");
export const uuidSchema = z.string().uuid();
const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const revisionSchema = z.number().int().nonnegative().max(2147483647);
const titleSchema = z.string().max(200);
const feedbackSchema = z.object({ correct: z.string().max(2000), incorrect: z.string().max(2000) }).strict();

export const textBlockSchema = z.object({ id: stableIdSchema, type: z.literal("text"), text: z.string().max(20000) }).strict();
export const choiceOptionSchema = z.object({ id: stableIdSchema, text: z.string().max(2000) }).strict();
export const choiceActivitySchema = z.object({
  id: stableIdSchema,
  type: z.literal("choice"),
  prompt: z.string().max(4000),
  required: z.boolean(),
  options: z.array(choiceOptionSchema).max(20),
  correctOptionId: z.string().max(80),
  feedback: feedbackSchema,
}).strict();
export const documentLessonSchema = z.object({
  id: stableIdSchema,
  title: titleSchema,
  objective: z.string().max(4000),
  blocks: z.array(textBlockSchema).max(100),
  activities: z.array(choiceActivitySchema).max(100),
}).strict();
export const documentUnitSchema = z.object({
  id: stableIdSchema,
  title: titleSchema,
  lessons: z.array(documentLessonSchema).max(100),
}).strict();
const documentShapeSchema = z.object({
  title: titleSchema,
  level: levelSchema,
  audience: audienceSchema,
  units: z.array(documentUnitSchema).max(100),
}).strict();
export type CourseDocument = z.infer<typeof documentShapeSchema>;

function checkUniqueIds(document: CourseDocument, ctx: z.RefinementCtx) {
  const unitIds = new Set<string>();
  const lessonIds = new Set<string>();
  document.units.forEach((unit, unitIndex) => {
    if (unitIds.has(unit.id)) ctx.addIssue({ code: "custom", path: ["units", unitIndex, "id"], message: "El identificador de unidad está repetido." });
    unitIds.add(unit.id);
    unit.lessons.forEach((lesson, lessonIndex) => {
      const path = ["units", unitIndex, "lessons", lessonIndex];
      if (lessonIds.has(lesson.id)) ctx.addIssue({ code: "custom", path: [...path, "id"], message: "El identificador de lección está repetido en el curso." });
      lessonIds.add(lesson.id);
      (["blocks", "activities"] as const).forEach((collection) => {
        const ids = new Set<string>();
        lesson[collection].forEach((item, itemIndex) => {
          if (ids.has(item.id)) ctx.addIssue({ code: "custom", path: [...path, collection, itemIndex, "id"], message: "El identificador está repetido en la lección." });
          ids.add(item.id);
        });
      });
      lesson.activities.forEach((activity, activityIndex) => {
        const ids = new Set<string>();
        activity.options.forEach((option, optionIndex) => {
          if (ids.has(option.id)) ctx.addIssue({ code: "custom", path: [...path, "activities", activityIndex, "options", optionIndex, "id"], message: "El identificador de opción está repetido." });
          ids.add(option.id);
        });
      });
    });
  });
}

/** Drafts may omit pedagogical content, but must preserve a valid tree and stable unique ids. */
export const draftDocumentSchema = documentShapeSchema.superRefine(checkUniqueIds);
export const publishDocumentSchema = draftDocumentSchema.superRefine((document, ctx) => {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const nonBlank = (value: string, path: (string | number)[]) => { if (!value.trim()) issue(path, "Completa este campo antes de publicar."); };
  nonBlank(document.title, ["title"]);
  if (!document.units.length) issue(["units"], "Añade al menos una unidad.");
  document.units.forEach((unit, unitIndex) => {
    const unitPath = ["units", unitIndex];
    nonBlank(unit.title, [...unitPath, "title"]);
    if (!unit.lessons.length) issue([...unitPath, "lessons"], "Cada unidad necesita al menos una lección completa.");
    unit.lessons.forEach((lesson, lessonIndex) => {
      const path = [...unitPath, "lessons", lessonIndex];
      nonBlank(lesson.title, [...path, "title"]);
      nonBlank(lesson.objective, [...path, "objective"]);
      if (!lesson.blocks.length) issue([...path, "blocks"], "Añade contenido a la lección.");
      lesson.blocks.forEach((block, blockIndex) => nonBlank(block.text, [...path, "blocks", blockIndex, "text"]));
      if (!lesson.activities.some((activity) => activity.required)) issue([...path, "activities"], "Añade al menos una actividad obligatoria.");
      lesson.activities.forEach((activity, activityIndex) => {
        const activityPath = [...path, "activities", activityIndex];
        nonBlank(activity.prompt, [...activityPath, "prompt"]);
        if (activity.options.length < 2) issue([...activityPath, "options"], "Cada actividad necesita al menos dos opciones.");
        activity.options.forEach((option, optionIndex) => nonBlank(option.text, [...activityPath, "options", optionIndex, "text"]));
        if (!activity.options.some((option) => option.id === activity.correctOptionId)) issue([...activityPath, "correctOptionId"], "Selecciona una opción correcta existente.");
        nonBlank(activity.feedback.correct, [...activityPath, "feedback", "correct"]);
        nonBlank(activity.feedback.incorrect, [...activityPath, "feedback", "incorrect"]);
      });
    });
  });
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict();
export const recoverySchema = z.object({ email: emailSchema }).strict();
export const passwordSchema = z.object({ password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128) }).strict();
export const invitationSchema = z.object({ email: emailSchema, name: z.string().trim().min(1).max(120), role: z.enum(["student", "teacher"]) }).strict();
export const createCourseSchema = z.object({ title: z.string().trim().min(1).max(200), level: levelSchema, audience: audienceSchema }).strict();
export const saveDraftSchema = z.object({ expectedRevision: revisionSchema, document: draftDocumentSchema }).strict();
export const releaseSchema = z.object({ expectedRevision: revisionSchema }).strict();
export const enrollmentSchema = z.object({ studentEmail: emailSchema }).strict();
export const attemptSchema = z.object({
  lessonVersionId: uuidSchema,
  answers: z.array(z.object({ activityId: stableIdSchema, optionId: stableIdSchema }).strict()).max(100),
}).strict().superRefine((attempt, ctx) => {
  const ids = new Set<string>();
  attempt.answers.forEach((answer, index) => {
    if (ids.has(answer.activityId)) ctx.addIssue({ code: "custom", path: ["answers", index, "activityId"], message: "Responde cada actividad una sola vez." });
    ids.add(answer.activityId);
  });
});
export const idempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/, "La clave de reintento no es válida.");

export const profileSchema = z.object({ id: uuidSchema, name: z.string(), email: z.string().email(), role: roleSchema }).strict();
export const courseProgressSchema = z.object({ completed: z.number().int().nonnegative(), total: z.number().int().nonnegative(), nextLessonId: stableIdSchema.nullable() }).strict();
export const courseSummarySchema = z.object({
  courseId: uuidSchema, title: z.string(), level: levelSchema, audience: audienceSchema,
  ownerId: uuidSchema, published: z.boolean(), revision: revisionSchema, releaseId: uuidSchema.nullable(),
  progress: courseProgressSchema.optional(),
}).strict();
export const draftSchema = z.object({ courseId: uuidSchema, revision: revisionSchema, document: draftDocumentSchema }).strict();
export const outlineSchema = z.object({
  courseId: uuidSchema, title: z.string(), level: levelSchema, audience: audienceSchema, releaseId: uuidSchema,
  units: z.array(z.object({ id: stableIdSchema, title: z.string(), lessons: z.array(z.object({ id: stableIdSchema, title: z.string(), lessonVersionId: uuidSchema, completed: z.boolean() }).strict()) }).strict()),
  courseProgress: courseProgressSchema,
}).strict();
export const studentChoiceActivitySchema = choiceActivitySchema.omit({ correctOptionId: true, feedback: true });
export const lessonSchema = z.object({
  courseId: uuidSchema, lessonId: stableIdSchema, lessonVersionId: uuidSchema,
  title: z.string(), objective: z.string(), blocks: z.array(textBlockSchema), activities: z.array(studentChoiceActivitySchema),
}).strict();
export const attemptResultSchema = z.object({
  attemptId: uuidSchema,
  score: z.object({ correct: z.number().int().nonnegative(), total: z.number().int().nonnegative() }).strict(),
  items: z.array(z.object({ activityId: stableIdSchema, correct: z.boolean(), feedback: z.string() }).strict()),
  courseProgress: courseProgressSchema,
}).strict();
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), fieldErrors: z.record(z.string(), z.array(z.string())).optional() }).strict() }).strict();
export type Role = z.infer<typeof roleSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Outline = z.infer<typeof outlineSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ApiResponse<T> = { data: T } | ApiError;
