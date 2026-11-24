import 'server-only';
import { sessionRepository } from './repository';
import { DomainError } from './errors';
import {
  adventureAccessInputSchema, adventureMemberParamsSchema, adventureMissionIdSchema, adventureProgressInputSchema,
  type AdventureAccess, type AdventureAccessUpdate, type AdventureMember, type AdventureProgress,
} from './adventure-access-contracts';

async function rpc<T>(operation: string, args: Record<string, unknown> = {}) {
  return (await sessionRepository()).call<T>(operation, args);
}

export const getAdventureAccess = () => rpc<AdventureAccess>('api_adventure_access');
export const getAdventureMembers = () => rpc<AdventureMember[]>('api_adventure_members');

export async function requireAdventureAccess() {
  const access = await getAdventureAccess();
  if (!access.allowed) throw new DomainError(403, 'adventure_forbidden', 'Tu cuenta no tiene acceso al curso de aventura. Contacta con la administración de la academia.');
  return access;
}

export function setAdventureAccess(userId: string, enabled: boolean) {
  const params = adventureMemberParamsSchema.parse({ userId });
  const input = adventureAccessInputSchema.parse({ enabled });
  return rpc<AdventureAccessUpdate>('api_set_adventure_access', { p_user_id: params.userId, p_enabled: input.enabled });
}

export function getAdventureProgress(missionId: string) {
  return rpc<AdventureProgress>('api_adventure_progress', { p_mission_id: adventureMissionIdSchema.parse(missionId) });
}

export function setAdventureProgress(missionId: string, stepId: string, completed: boolean) {
  const mission = adventureMissionIdSchema.parse(missionId);
  const input = adventureProgressInputSchema(mission).parse({ stepId, completed });
  return rpc<AdventureProgress>('api_set_adventure_progress', { p_mission_id: mission, p_step_id: input.stepId, p_completed: input.completed });
}

export function resetAdventureProgress(missionId: string) {
  return rpc<AdventureProgress>('api_reset_adventure_progress', { p_mission_id: adventureMissionIdSchema.parse(missionId) });
}
