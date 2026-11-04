import { readRoute, routePath } from "./routes.js";

const intentKey = "last-layer.account-setup.v1";
const learningViews = new Set([
  "dashboard",
  "home",
  "courses",
  "lesson",
  "library",
  "guides",
  "progress",
  "timer",
  "cubes",
  "pll-quiz",
]);

// Keep continuation local and canonical. Never retain credentials, query strings,
// external URLs or temporary practice state in an account-setup destination.
export function setupDestination(path) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//")
  )
    return "/dashboard";
  const route = readRoute(path);
  if (!learningViews.has(route.view)) return "/dashboard";
  return routePath({ ...route, settings: false });
}
export function setupIntent(storage, destination) {
  try {
    if (destination === null) {
      storage.removeItem(intentKey);
      return null;
    }
    if (destination !== undefined) {
      const path = setupDestination(destination);
      storage.setItem(intentKey, path);
      return path;
    }
    const path = storage.getItem(intentKey);
    return path === null ? null : setupDestination(path);
  } catch {
    return destination === undefined || destination === null
      ? null
      : setupDestination(destination);
  }
}

// Future onboarding steps go after required identity and the guest-transfer
// decision. Callers supply saved completion per account; optional steps never
// participate in sync eligibility. No empty onboarding screens are registered.
export function accountSetupStage(account, optionalSteps = []) {
  if (!account.email || account.reauth)
    return account.codeSent ? "verify" : "email";
  if (account.profileLoading) return "loading";
  if (account.profileError) return "error";
  if (!account.profile) return "username";
  if (account.guestImportPending) return "transfer";
  if (
    !account.demo &&
    !account.guestImportDismissed &&
    !account.guestImportComparison &&
    Object.values(account.guestImportPreview || {}).some((count) => count > 0)
  )
    return "comparing";
  const next = optionalSteps.find((step) => !step.completed);
  return next ? next.id : "ready";
}

export function accountSetupTitle(account) {
  if (account.reauth) return "Sign in again";
  return (
    {
      email: "Sign in or create an account",
      verify: "Check your email",
      username: "Choose a username",
      loading: "Loading account…",
      error: "Account setup",
    }[accountSetupStage(account)] || "Account settings"
  );
}

export function emailCode(value) {
  const code = String(value ?? "").replace(/[\s-]/g, "");
  if (!/^\d{6,10}$/.test(code))
    throw Error(
      "Enter the 6–10 digit code from your email. You can paste the whole code.",
    );
  return code;
}
export function signInFailure(error, verifying) {
  if (
    error?.status === 429 ||
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      error?.code,
    )
  )
    return "Too many requests. Wait a minute before requesting another code.";
  if (verifying && ["otp_expired", "otp_disabled"].includes(error?.code))
    return "That code is invalid or has expired. Try again or request a new code.";
  return verifying
    ? "The code could not be verified. Check the code and your connection, or request a new code."
    : "The email could not be sent. Check your connection and try again.";
}
