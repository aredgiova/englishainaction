import type { CourseDocument } from "./contracts";
import { adventureMissions, type AdventureStep } from "./adventure-content";

type CourseLesson = CourseDocument["units"][number]["lessons"][number];

function stepText(step: AdventureStep): string {
  const sections = [
    `${step.title}\n${step.instruction}`,
    ...step.paragraphs,
    ...(step.vocabulary ? [step.vocabulary.map(item => `${item.en} — ${item.es}`).join("\n")] : []),
    ...(step.dialogue ? [step.dialogue.map(line => `${line.speaker}: ${line.text}`).join("\n")] : []),
    ...(step.listening ? [`LISTENING — ${step.listening.title}\n${step.listening.script}\nLee o escucha el texto con apoyo de tu docente. Esta plantilla de texto conserva el guion; no incorpora una grabación de audio.`] : []),
    ...(step.speaking ? [`SPEAKING PRACTICE\nModel: ${step.speaking.model}\nSelf-review:\n${step.speaking.checklist.join("\n")}\nLa práctica oral requiere revisión propia o del docente. Las preguntas de opción única no califican tu pronunciación.`] : []),
    ...(step.writing ? [`WRITING PRACTICE — ${step.writing.label}\n${step.writing.placeholder}\nModel: ${step.writing.model}\nEscribe tu respuesta en el espacio que indique tu docente y revísala con el modelo. Esta plantilla no recoge ni evalúa automáticamente producciones escritas.`] : []),
  ];
  return sections.join("\n\n");
}

/**
 * The current LMS supports text and single-choice activities. Narrative and
 * productive steps are grouped with the next comprehension/practice lesson so
 * every published lesson has meaningful questions, without pretending that a
 * choice score measures speaking or writing. The visual adventure keeps all
 * 23 individual steps. Review the draft academically before publication.
 */
export const adventureCourseDocument: CourseDocument = {
  title: "English Learning Adventure — The Discovery Islands",
  level: "A1",
  audience: "school",
  units: adventureMissions.map(mission => {
    const lessons: CourseLesson[] = [];
    let pending: AdventureStep[] = [];

    for (const step of mission.steps) {
      pending.push(step);
      if (!step.questions?.length) continue;

      const lessonId = `${mission.id}-${step.id}`;
      const blocks: CourseLesson["blocks"] = pending.map(item => ({
        id: `${item.id}-text`,
        type: "text",
        text: stepText(item),
      }));
      if (lessons.length === 0) {
        blocks.unshift({
          id: "mission-introduction",
          type: "text",
          text: `${mission.title} — ${mission.place}\nA1.1 · ${mission.objective}\n\n${mission.description}\n\nNota para revisión del material: ${mission.sourceNote}`,
        });
      }

      lessons.push({
        id: lessonId,
        title: step.title,
        objective: `${mission.objective} ${step.instruction}`,
        blocks,
        activities: step.questions.map(item => ({
          id: item.id,
          type: "choice",
          prompt: item.prompt,
          required: true,
          options: item.options.map((text, index) => ({ id: `option-${index + 1}`, text })),
          correctOptionId: `option-${item.answer + 1}`,
          feedback: {
            correct: `Excellent! ${item.feedback}`,
            incorrect: `Good try! ${item.feedback} Revisa el ejemplo y vuelve a intentarlo.`,
          },
        })),
      });
      pending = [];
    }

    if (pending.length && lessons.length) {
      lessons[lessons.length - 1].blocks.push(...pending.map(item => ({
        id: `${item.id}-text`,
        type: "text" as const,
        text: stepText(item),
      })));
    }

    return {
      id: mission.id,
      title: `${mission.number}. ${mission.title} — ${mission.place}`,
      lessons,
    };
  }),
};
