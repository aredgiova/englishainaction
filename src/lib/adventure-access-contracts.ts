import { z } from 'zod';
import { stableIdSchema, uuidSchema } from './contracts';
import { adventureMissions } from './adventure-content';

export const adventureMissionIdSchema = z.enum(['hello-explorer', 'my-world']);
export const adventureMissionParamsSchema = z.object({ missionId: adventureMissionIdSchema }).strict();
export const adventureMemberParamsSchema = z.object({ userId: uuidSchema }).strict();
export const adventureAccessSchema = z.object({ allowed: z.boolean() }).strict();
export const adventureMemberSchema = z.object({
  id: uuidSchema, name: z.string(), email: z.string().email(), role: z.enum(['teacher', 'student']),
  active: z.boolean(), enabled: z.boolean(),
}).strict();
export const adventureMembersSchema = z.array(adventureMemberSchema);
export const adventureAccessInputSchema = z.object({ enabled: z.boolean() }).strict();
export const adventureAccessUpdateSchema = z.object({ userId: uuidSchema, enabled: z.boolean() }).strict();
export const adventureResetInputSchema = z.object({}).strict();

function isMissionStep(missionId: AdventureMissionId, stepId: string) {
  return adventureMissions.find(mission => mission.id === missionId)!.steps.some(step => step.id === stepId);
}

export function adventureProgressInputSchema(missionId: AdventureMissionId) {
  return z.object({ stepId: stableIdSchema, completed: z.boolean() }).strict().superRefine((value, context) => {
    if (!isMissionStep(missionId, value.stepId)) context.addIssue({ code: 'custom', path: ['stepId'], message: 'La parada no pertenece a esta misión.' });
  });
}

export const adventureProgressSchema = z.object({
  missionId: adventureMissionIdSchema,
  completedStepIds: z.array(stableIdSchema).max(14),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.completedStepIds.forEach((stepId, index) => {
    if (seen.has(stepId) || !isMissionStep(value.missionId, stepId)) context.addIssue({ code: 'custom', path: ['completedStepIds', index], message: 'La parada está repetida o no pertenece a esta misión.' });
    seen.add(stepId);
  });
});

export type AdventureMissionId = z.infer<typeof adventureMissionIdSchema>;
export type AdventureAccess = z.infer<typeof adventureAccessSchema>;
export type AdventureMember = z.infer<typeof adventureMemberSchema>;
export type AdventureAccessUpdate = z.infer<typeof adventureAccessUpdateSchema>;
export type AdventureProgress = z.infer<typeof adventureProgressSchema>;
