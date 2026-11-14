import { test } from "node:test";
import assert from "node:assert/strict";
import { createScrambleSession } from "../src/scramble-session.js";

function result(eventId = "333") {
  return {
    eventId,
    puzzleId: eventId === "222" ? "2x2" : "3x3",
    algorithm: "R U F2",
    generator: { id: "test-provider", version: "1", method: "random-state" },
    grip: { up: "white", front: "green" },
  };
}
function pendingProvider() {
  const requests = [];
  return {
    requests,
    generateScramble: (input) =>
      new Promise((resolve, reject) => {
        requests.push({ ...input, resolve, reject });
      }),
  };
}

test("generation consumes a detached, immutable solve identity before timing", async () => {
  const value = result();
  const session = createScrambleSession({
    generateScramble: async () => value,
  });
  assert.throws(() => session.beginSolve(), /not ready/);
  assert.equal(await session.request(), true);
  value.generator.version = "changed outside";
  value.grip.front = "red";
  assert.equal(session.snapshot().result.generator.version, "1");
  assert.equal(session.snapshot().result.grip.front, "green");
  assert.throws(() => {
    session.snapshot().result.grip.up = "yellow";
  }, TypeError);
  const solve = session.beginSolve();
  assert.deepEqual(solve, {
    eventId: "333",
    scramble: "R U F2",
    scrambleProvenance: {
      id: "test-provider",
      version: "1",
      method: "random-state",
    },
    scrambleGrip: { up: "white", front: "green" },
  });
  assert.equal(session.snapshot().status, "consumed");
  assert.throws(() => session.beginSolve(), /not ready/);
  session.invalidate({ eventId: "222" });
  assert.equal(solve.eventId, "333");
  assert.throws(() => {
    solve.scrambleProvenance.version = "2";
  }, TypeError);
});

test("event changes discard late old successes and failures even when providers ignore abort", async () => {
  const provider = pendingProvider();
  const session = createScrambleSession(provider);
  const oldRequest = session.request();
  session.invalidate({ eventId: "222" });
  assert.equal(provider.requests[0].signal.aborted, true);
  const current = session.request();
  provider.requests[1].resolve(result("222"));
  assert.equal(await current, true);
  provider.requests[0].resolve(result());
  assert.equal(await oldRequest, false);
  assert.equal(session.snapshot().result.eventId, "222");
  const failing = session.request();
  const replacement = session.request();
  provider.requests[2].reject(new Error("late failure"));
  assert.equal(await failing, false);
  assert.equal(session.snapshot().status, "loading");
  provider.requests[3].resolve(result("222"));
  assert.equal(await replacement, true);
});

test("account, import, and session invalidation discard same-event results and ready state", async () => {
  for (const boundary of ["account", "import", "session"]) {
    const provider = pendingProvider();
    const session = createScrambleSession(provider);
    const request = session.request();
    session.invalidate();
    provider.requests[0].resolve(result());
    assert.equal(await request, false, boundary);
    assert.equal(session.snapshot().status, "idle", boundary);
    assert.throws(() => session.beginSolve(), /not ready/);
    const next = session.request();
    provider.requests[1].resolve(result());
    await next;
    session.invalidate();
    assert.throws(() => session.beginSolve(), /not ready/);
  }
});

test("failures and mismatched results do not silently replace the selected event", async () => {
  const values = [
    () => {
      throw new Error("solver timeout");
    },
    async () => result("222"),
    async () => ({ ...result(), algorithm: "not an algorithm" }),
  ];
  for (const generateScramble of values) {
    const session = createScrambleSession({ generateScramble });
    assert.equal(await session.request(), false);
    assert.equal(session.snapshot().status, "error");
    assert.equal(session.snapshot().eventId, "333");
    assert.equal(session.snapshot().result, null);
    assert.equal(session.snapshot().error.code, "GENERATION_FAILED");
    assert.throws(() => session.beginSolve(), /not ready/);
  }
});

test("failed requests can retry, and starting another request immediately removes old readiness", async () => {
  const provider = pendingProvider();
  const session = createScrambleSession(provider);
  const failed = session.request();
  provider.requests[0].reject(
    Object.assign(new Error("unsupported"), { code: "UNSUPPORTED_EVENT" }),
  );
  assert.equal(await failed, false);
  assert.equal(session.snapshot().error.code, "UNSUPPORTED_EVENT");
  const retry = session.request();
  assert.equal(session.snapshot().error, null);
  provider.requests[1].resolve(result());
  await retry;
  const next = session.request();
  assert.throws(() => session.beginSolve(), /not ready/);
  provider.requests[2].resolve(result());
  await next;
});

test("destroy cancels pending work, releases state, and prevents reuse", async () => {
  const provider = pendingProvider();
  const session = createScrambleSession(provider);
  const request = session.request();
  session.destroy();
  session.destroy();
  assert.equal(provider.requests[0].signal.aborted, true);
  provider.requests[0].resolve(result());
  assert.equal(await request, false);
  assert.deepEqual(session.snapshot(), {
    status: "disposed",
    eventId: "333",
    result: null,
    error: null,
  });
  await assert.rejects(session.request(), /disposed/);
  assert.throws(() => session.beginSolve(), /disposed/);
  assert.throws(() => session.invalidate(), /disposed/);
});

test("unsupported and coming-soon IDs cannot enter a session or cancel a valid request", async () => {
  assert.throws(
    () =>
      createScrambleSession({
        generateScramble: async () => result(),
        eventId: "333mbf",
      }),
    /supported event/,
  );
  const provider = pendingProvider();
  const session = createScrambleSession(provider);
  const request = session.request();
  assert.throws(
    () => session.invalidate({ eventId: "pyram" }),
    /supported event/,
  );
  assert.equal(provider.requests[0].signal.aborted, false);
  provider.requests[0].resolve(result());
  assert.equal(await request, true);
});
