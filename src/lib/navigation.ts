import type { Role } from "./contracts";

export type RoleHome = "/campus" | "/docente" | "/administracion";

/** UI destination only. The role must come from the verified session profile. */
export function roleHome(role: Role): RoleHome {
  const destinations: Record<Role, RoleHome> = {
    student: "/campus",
    teacher: "/docente",
    admin: "/administracion",
  };
  return destinations[role];
}
