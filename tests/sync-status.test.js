import { test } from "node:test";
import assert from "node:assert/strict";
import { syncStatus, syncFeedback } from "../src/sync-status.js";
const account = (sync) => ({
  email: "owner@example.test",
  profile: { username: "learner" },
  sync,
});
test("manual sync confirms an acknowledged result and never labels waiting or failed data as synced", () => {
  for (const [result, text] of [
    ["updated", "Changes synced."],
    ["unchanged", "Already up to date."],
  ]) {
    const sync = { status: "synced", result };
    assert.equal(
      syncFeedback(syncStatus({ account: account(sync) }), sync),
      text,
    );
  }
  for (const status of ["syncing", "pending", "error", "conflict"]) {
    const view = syncStatus({ account: account({ status }) });
    assert.doesNotMatch(
      syncFeedback(view),
      /Already up to date|Changes synced/,
    );
    assert.equal(view.attention, status !== "syncing");
  }
});
test("a successful cloud response cannot conceal local storage failure", () => {
  const view = syncStatus({
    account: account({ status: "synced" }),
    notice: "Saving failed. Keep this tab open.",
  });
  assert.equal(view.state, "local-error");
  assert.equal(view.canCheck, false);
  assert.equal(view.attention, true);
  assert.match(syncFeedback(view), /Saving failed/);
  assert.doesNotMatch(
    syncFeedback(view),
    /Up to date|Changes synced|saved on this device/,
  );
});
test("incoming updates, auth expiry, offline and server rejection have distinct recovery messages", () => {
  assert.equal(
    syncStatus({
      account: account({ status: "pending", pendingReason: "incoming" }),
    }).label,
    "Updates waiting",
  );
  assert.equal(
    syncStatus({ account: account({ status: "pending" }) }).label,
    "Changes waiting to sync",
  );
  assert.match(
    syncStatus({ account: account({ status: "error", failure: "auth" }) })
      .label,
    /Sign in again/,
  );
  assert.match(
    syncStatus({ account: account({ status: "error", failure: "rejected" }) })
      .label,
    /accept/,
  );
  assert.equal(
    syncStatus({ account: account({ status: "error" }), online: false }).label,
    "Offline",
  );
});
test("demo, guest and unfinished accounts never claim a real cloud save", () => {
  const view = syncStatus({
    account: account({ status: "synced" }),
    demo: true,
  });
  assert.equal(
    syncFeedback(view),
    "Demo changes stay in this tab. No cloud requests.",
  );
  assert.equal(syncStatus({ account: {} }).canCheck, false);
  assert.equal(
    syncStatus({ account: { email: "owner@example.test" } }).canCheck,
    false,
  );
});
