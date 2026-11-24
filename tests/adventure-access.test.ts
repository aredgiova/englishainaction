import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { adventureMissions } from "../src/lib/adventure-content";

let db: PGlite;
const actors = {
  admin: "00000000-0000-4000-8000-000000007001",
  teacher: "00000000-0000-4000-8000-000000007002",
  student: "00000000-0000-4000-8000-000000007003",
  inactive: "00000000-0000-4000-8000-000000007004",
  newcomer: "00000000-0000-4000-8000-000000007005",
} as const;
type Actor = keyof typeof actors;
type Member = { id: string; name: string; email: string; role: string; active: boolean; enabled: boolean };
type Progress = { missionId: string; completedStepIds: string[] };
let initialGrants: { user_id: string; enabled: boolean; changed_by: string | null }[];
let profilesBeforeMigration: unknown[];
let profilesAfterMigration: unknown[];

async function act(actor: Actor | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ? actors[actor] : ""]);
  await db.exec("set role authenticated");
}
async function rpc<T = unknown>(name: string, args: unknown[] = []): Promise<T> {
  const result = await db.query<{ value: T }>(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(",")}) value`, args);
  return result.rows[0].value;
}
async function fault(operation: Promise<unknown>, status: number, code: string) {
  try { await operation; expect.fail("The operation should have been rejected"); }
  catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(JSON.parse((error as Error).message)).toMatchObject({ status, code });
  }
}
async function addProfile(actor: Actor) {
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [
    actors[actor], `${actor}@adventure.example.test`, { name: actor, role: "admin" },
  ]);
  if (actor === "admin" || actor === "teacher") {
    await db.query("update public.profiles set role=$1 where id=$2", [actor, actors[actor]]);
  }
  if (actor === "inactive") await db.query("update public.profiles set active=false where id=$1", [actors[actor]]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text not null,raw_user_meta_data jsonb not null default '{}',email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  const migrations = (await readdir(directory)).filter(name => name.endsWith(".sql")).sort();
  const migration = migrations.find(name => name.endsWith("_adventure_access_progress.sql"));
  expect(migration).toBeTruthy();
  for (const name of migrations.filter(name => name !== migration)) {
    await db.exec(await readFile(new URL(name, directory), "utf8"));
  }
  for (const actor of ["admin", "teacher", "student", "inactive"] as const) await addProfile(actor);
  profilesBeforeMigration = (await db.query("select * from public.profiles order by id")).rows;
  await db.exec(await readFile(new URL(migration!, directory), "utf8"));
  profilesAfterMigration = (await db.query("select * from public.profiles order by id")).rows;
  initialGrants = (await db.query<{ user_id: string; enabled: boolean; changed_by: string | null }>(
    "select user_id,enabled,changed_by from private.adventure_access order by user_id",
  )).rows;
  await addProfile("newcomer");
}, 60_000);

beforeEach(async () => {
  await db.exec("reset role; truncate private.adventure_progress");
  await db.query("delete from private.adventure_access where user_id=any($1::uuid[])", [[actors.inactive, actors.newcomer]]);
  await db.query("update private.adventure_access set enabled=true where user_id=any($1::uuid[])", [[actors.teacher, actors.student]]);
  await db.query("update public.profiles set active=(id<>$1) where id=any($2::uuid[])", [actors.inactive, Object.values(actors)]);
});
afterAll(async () => { await db?.close(); });

describe("Protected adventure access and practice progress in PostgreSQL", () => {
  it("seeds only current active teachers/students without changing profiles or granting future accounts", async () => {
    expect(initialGrants).toEqual([
      { user_id: actors.teacher, enabled: true, changed_by: null },
      { user_id: actors.student, enabled: true, changed_by: null },
    ]);
    expect(profilesAfterMigration).toEqual(profilesBeforeMigration);
    for (const actor of ["admin", "teacher", "student"] as const) {
      await act(actor);
      expect(await rpc("api_adventure_access")).toEqual({ allowed: true });
    }
    await act("newcomer");
    expect(await rpc("api_adventure_access")).toEqual({ allowed: false });
    await fault(rpc("api_adventure_progress", ["hello-explorer"]), 403, "adventure_forbidden");
    await act("admin");
    expect(await rpc("api_set_adventure_access", [actors.newcomer, true])).toEqual({ userId: actors.newcomer, enabled: true });
    await act("newcomer");
    expect(await rpc("api_adventure_access")).toEqual({ allowed: true });
  });

  it("exposes members and access mutations only to administrators and ignores role metadata", async () => {
    for (const actor of ["teacher", "student", "newcomer"] as const) {
      await act(actor);
      await fault(rpc("api_adventure_members"), 403, "forbidden");
      await fault(rpc("api_set_adventure_access", [actors.newcomer, true]), 403, "forbidden");
    }
    await act("admin");
    const members = await rpc<Member[]>("api_adventure_members");
    expect(members).toHaveLength(4);
    expect(members.map(member => member.id)).not.toContain(actors.admin);
    expect(members.find(member => member.id === actors.inactive)).toMatchObject({ active: false, enabled: false, role: "student" });
    expect(members.find(member => member.id === actors.student)).toEqual({
      id: actors.student, name: "student", email: "student@adventure.example.test", role: "student", active: true, enabled: true,
    });
  });

  it("revokes reads and writes immediately, preserves progress and restores the same account", async () => {
    await act("student");
    const saved = await rpc<Progress>("api_set_adventure_progress", ["hello-explorer", "adventure-begins", true]);
    await act("admin");
    expect(await rpc("api_set_adventure_access", [actors.student, false])).toEqual({ userId: actors.student, enabled: false });
    await act("student");
    expect(await rpc("api_adventure_access")).toEqual({ allowed: false });
    await fault(rpc("api_adventure_progress", ["hello-explorer"]), 403, "adventure_forbidden");
    await fault(rpc("api_set_adventure_progress", ["hello-explorer", "harbor-problem", true]), 403, "adventure_forbidden");
    await fault(rpc("api_reset_adventure_progress", ["hello-explorer"]), 403, "adventure_forbidden");
    await act("admin");
    await rpc("api_set_adventure_access", [actors.student, true]);
    await act("student");
    expect(await rpc("api_adventure_progress", ["hello-explorer"])).toEqual(saved);
  });

  it("rejects inactive accounts even when they have a grant or an administrator role", async () => {
    await act("admin");
    await rpc("api_set_adventure_access", [actors.inactive, true]);
    await act("inactive");
    await fault(rpc("api_adventure_access"), 403, "account_inactive");
    await fault(rpc("api_adventure_progress", ["hello-explorer"]), 403, "account_inactive");
    await db.exec("reset role");
    await db.query("update public.profiles set active=false where id=$1", [actors.admin]);
    await act("admin");
    await fault(rpc("api_adventure_members"), 403, "account_inactive");
    await fault(rpc("api_set_adventure_access", [actors.student, false]), 403, "account_inactive");
  });

  it("accepts every canonical step and returns progress in mission order without scores", async () => {
    for (const mission of adventureMissions) {
      const catalog = await db.query<{ steps: string[] }>("select private.adventure_steps($1) steps", [mission.id]);
      expect(catalog.rows[0].steps).toEqual(mission.steps.map(step => step.id));
    }
    await act("teacher");
    for (const mission of adventureMissions) {
      for (const step of [...mission.steps].reverse()) {
        await rpc("api_set_adventure_progress", [mission.id, step.id, true]);
      }
      expect(await rpc("api_adventure_progress", [mission.id])).toEqual({
        missionId: mission.id, completedStepIds: mission.steps.map(step => step.id),
      });
    }
    await db.exec("reset role");
    expect((await db.query("select * from private.adventure_progress where user_id=$1", [actors.teacher])).rows).toHaveLength(23);
  });

  it("keeps progress isolated by account and resets only the requested mission", async () => {
    await act("student");
    await rpc("api_set_adventure_progress", ["hello-explorer", "adventure-begins", true]);
    await rpc("api_set_adventure_progress", ["my-world", "village-arrival", true]);
    await act("teacher");
    expect(await rpc("api_adventure_progress", ["hello-explorer"])).toEqual({ missionId: "hello-explorer", completedStepIds: [] });
    await rpc("api_set_adventure_progress", ["hello-explorer", "harbor-problem", true]);
    await act("student");
    expect(await rpc("api_reset_adventure_progress", ["hello-explorer"])).toEqual({ missionId: "hello-explorer", completedStepIds: [] });
    expect(await rpc("api_adventure_progress", ["my-world"])).toEqual({ missionId: "my-world", completedStepIds: ["village-arrival"] });
    await act("teacher");
    expect(await rpc("api_adventure_progress", ["hello-explorer"])).toEqual({ missionId: "hello-explorer", completedStepIds: ["harbor-problem"] });
    await act("admin");
    expect(await rpc("api_set_adventure_progress", ["my-world", "object-lab", true])).toEqual({ missionId: "my-world", completedStepIds: ["object-lab"] });
    await act("student");
    expect(await rpc("api_set_adventure_progress", ["my-world", "village-arrival", false])).toEqual({ missionId: "my-world", completedStepIds: [] });
  });

  it("makes repeated access changes and completion writes idempotent", async () => {
    await act("admin");
    await rpc("api_set_adventure_access", [actors.student, false]);
    await db.exec("reset role");
    const grant = (await db.query("select * from private.adventure_access where user_id=$1", [actors.student])).rows;
    await act("admin");
    await rpc("api_set_adventure_access", [actors.student, false]);
    await db.exec("reset role");
    expect((await db.query("select * from private.adventure_access where user_id=$1", [actors.student])).rows).toEqual(grant);
    await act("teacher");
    await rpc("api_set_adventure_progress", ["hello-explorer", "adventure-begins", true]);
    await db.exec("reset role");
    const progress = (await db.query("select * from private.adventure_progress where user_id=$1", [actors.teacher])).rows;
    await act("teacher");
    await rpc("api_set_adventure_progress", ["hello-explorer", "adventure-begins", true]);
    await db.exec("reset role");
    expect((await db.query("select * from private.adventure_progress where user_id=$1", [actors.teacher])).rows).toEqual(progress);
  });

  it("rejects unknown missions, cross-mission steps, null states and unsupported access targets", async () => {
    await act("student");
    for (const missionId of [null, "", "unknown"]) {
      await fault(rpc("api_adventure_progress", [missionId]), 422, "validation_error");
      await fault(rpc("api_reset_adventure_progress", [missionId]), 422, "validation_error");
      await fault(rpc("api_set_adventure_progress", [missionId, "adventure-begins", true]), 422, "validation_error");
    }
    for (const stepId of [null, "unknown", "village-arrival"]) {
      await fault(rpc("api_set_adventure_progress", ["hello-explorer", stepId, true]), 422, "validation_error");
    }
    await fault(rpc("api_set_adventure_progress", ["hello-explorer", "adventure-begins", null]), 422, "validation_error");
    await act("admin");
    await fault(rpc("api_set_adventure_access", [actors.student, null]), 422, "validation_error");
    for (const userId of [null, actors.admin, "00000000-0000-4000-8000-000000007099"]) {
      await fault(rpc("api_set_adventure_access", [userId, true]), 404, "member_not_found");
    }
  });

  it("denies direct table access and anonymous RPCs, with RLS and invoker-only public wrappers", async () => {
    await act("student");
    for (const table of ["adventure_access", "adventure_progress"]) {
      await expect(db.query(`select * from private.${table}`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`delete from private.${table}`)).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("insert into private.adventure_access(user_id,enabled) values($1,true)", [actors.newcomer])).rejects.toThrow(/permission denied/);
    await expect(db.query("select private.adventure_actor()")).rejects.toThrow(/permission denied/);
    await act(null);
    await fault(rpc("api_adventure_access"), 401, "unauthenticated");
    await fault(rpc("api_adventure_members"), 401, "unauthenticated");
    await fault(rpc("api_adventure_progress", ["hello-explorer"]), 401, "unauthenticated");
    await db.exec("reset role; set role anon");
    await expect(rpc("api_adventure_access")).rejects.toThrow(/permission denied/);
    await expect(rpc("api_adventure_members")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
    const tables = (await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname in ('adventure_access','adventure_progress')",
    )).rows;
    expect(tables).toEqual([{ relrowsecurity: true }, { relrowsecurity: true }]);
    const wrappers = (await db.query<{ prosecdef: boolean }>(
      "select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'api_%adventure%'",
    )).rows;
    expect(wrappers).toHaveLength(6);
    expect(wrappers.every(wrapper => !wrapper.prosecdef)).toBe(true);
  });
});
