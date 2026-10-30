// One presentation for the header, recovery dialog and manual-check feedback.
export function syncStatus({
  account = {},
  demo = false,
  notice = "",
  online = true,
}) {
  const sync = account.sync || {};
  let state = sync.status || "idle",
    label,
    message = sync.message || "";
  if (notice || sync.failure === "local") {
    state = "local-error";
    label = "Device data needs attention";
    message =
      notice || "Sync stopped because device data could not be read or saved.";
  } else if (demo) {
    state = ["error", "conflict"].includes(state) ? state : "demo";
    label =
      state === "error"
        ? "Demo is offline"
        : state === "conflict"
          ? "Demo conflict"
          : "Demo · changes stay in this tab";
  } else if (!account.email) {
    state = "guest";
    label = "Guest training on this device";
  } else if (!account.profile) {
    state = "setup";
    label = account.profileLoading ? "Loading account" : "Finish account setup";
  } else if (sync.failure === "auth") {
    label = "Sign in again to sync";
  } else if (sync.failure === "rejected") {
    label = "Server could not accept these changes";
  } else if (state === "error" && !online) {
    label = "Offline";
    message = "Connect to the internet to check sync.";
  } else {
    label =
      {
        idle: "Waiting to check sync",
        syncing: "Syncing",
        synced: "Up to date",
        pending:
          sync.pendingReason === "incoming"
            ? "Updates waiting"
            : "Changes waiting to sync",
        conflict: "Sync needs a choice",
        error: "Could not sync",
      }[state] || "Sync needs attention";
  }
  if (!demo && state === "synced" && account.guestProgressAvailable) {
    state = "guest-separate";
    label = "Guest progress is not in your account";
    message =
      "Your account is up to date. Add this device’s guest progress to sync it to other computers.";
  }
  return {
    state,
    label,
    message,
    attention:
      ["local-error", "error", "conflict", "pending"].includes(state) ||
      (state === "guest-separate" && !!account.guestImportPending),
    canCheck:
      !!account.profile &&
      !account.busy &&
      state !== "syncing" &&
      state !== "local-error",
  };
}
export function syncFeedback(presentation, snapshot = {}) {
  if (presentation.state === "demo")
    return "Demo changes stay in this tab. No cloud requests.";
  if (presentation.state === "synced")
    return snapshot.result === "updated"
      ? "Changes synced."
      : "Already up to date.";
  return `${presentation.label}. ${presentation.message}`.trim();
}
