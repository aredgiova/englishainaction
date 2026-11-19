import { afterEach, expect, it, vi } from "vitest";
import { api, ClientApiError } from "../src/components/api";

afterEach(() => vi.unstubAllGlobals());

it("signals an expired session for protected requests while retaining contract details", async () => {
  const browser = new EventTarget();
  const expired = vi.fn();
  browser.addEventListener("eia:session-expired", expired);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "unauthenticated", message: "Sin sesión" } }, { status: 401 })));
  await expect(api("/courses/course/draft", "PUT", { expectedRevision: 2 })).rejects.toMatchObject({ code: "unauthenticated", status: 401, message: expect.stringContaining("Tu sesión caducó") });
  expect(expired).toHaveBeenCalledOnce();
});

it("does not mistake incorrect login credentials for an expired working session", async () => {
  const browser = new EventTarget();
  const expired = vi.fn();
  browser.addEventListener("eia:session-expired", expired);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "invalid_credentials", message: "Revisa tus credenciales." } }, { status: 401 })));
  await expect(api("/auth/login", "POST", {})).rejects.toMatchObject({ status: 401, message: "Revisa tus credenciales." });
  expect(expired).not.toHaveBeenCalled();
});

it("preserves revision conflicts and field paths for form recovery", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "revision_conflict", message: "Existe una revisión nueva.", fieldErrors: { expectedRevision: ["Desactualizada"] } } }, { status: 409 })));
  const error = await api("/courses/course/draft", "PUT", {}).catch(cause => cause);
  expect(error).toBeInstanceOf(ClientApiError);
  expect(error).toMatchObject({ status: 409, code: "revision_conflict", fieldErrors: { expectedRevision: ["Desactualizada"] } });
});

it("transmits the same body and idempotency key on an identical retry", async () => {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: { attemptId: "attempt-1" } })));
  vi.stubGlobal("fetch", fetchMock);
  const body = { lessonVersionId: "version-1", answers: [{ activityId: "origin", optionId: "yopal" }] };
  const first = await api("/courses/c/lessons/intro/attempts", "POST", body, "retry-1234");
  const second = await api("/courses/c/lessons/intro/attempts", "POST", body, "retry-1234");
  expect(second).toEqual(first);
  expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", headers: { "Idempotency-Key": "retry-1234" }, body: JSON.stringify(body) });
});
