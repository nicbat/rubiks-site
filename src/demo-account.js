import { username, profileDetails } from "./profiles.js";
import { profileSummary } from "./profile-summary.js";
import { emptyProgress } from "./progress.js";
import { trainingBackup } from "./training-backup.js";

export const DEMO_CODE = "123456";
export const DEMO_SCENARIOS = [
  ["signed-in", "Signed in"],
  ["signed-out", "Sign in"],
  ["setup", "Choose a username"],
  ["loading", "Loading account"],
  ["error", "Account load error"],
  ["offline", "Offline"],
  ["conflict", "Conflicting edits"],
];
const owner = () => ({
  username: "demo_learner",
  display_name: "Demo Learner",
  bio: "Practising a little every day.",
  learning_goal: "Learning full PLL",
  is_public: false,
});
export const demoStats = profileSummary;
// An intentionally network/storage-free backend. The controller supplies only
// the active in-memory training sandbox, never personal storage or credentials.
export function createDemoAccount(read, catalog) {
  let profile, session, scenario, pendingEmail;
  function reset(next = "signed-in") {
    if (!DEMO_SCENARIOS.some(([id]) => id === next))
      throw Error("Unknown demo state.");
    scenario = next;
    profile = ["setup", "loading", "error"].includes(next) ? null : owner();
    session =
      next === "signed-out"
        ? null
        : { user: { id: "demo-account", email: "learner@example.test" } };
    pendingEmail = "";
  }
  reset();
  const copy = (value) => value && structuredClone(value);
  function requireSession() {
    if (!session) throw Error("Sign in to the demo account first.");
  }
  return {
    get session() {
      return copy(session);
    },
    get profile() {
      return copy(profile);
    },
    get scenario() {
      return scenario;
    },
    reset,
    sync(choice) {
      if (scenario === "offline")
        return {
          status: "error",
          message: "Demo is offline. Changes stay in this tab.",
          conflict: false,
        };
      if (scenario === "conflict" && !choice)
        return {
          status: "conflict",
          message: "Demo edits need a choice. No real data is affected.",
          conflict: true,
          mergeConflict: true,
        };
      if (choice) scenario = "signed-in";
      return {
        status: "synced",
        message: "Saved in demo. No cloud requests.",
        conflict: false,
      };
    },
    find(name) {
      const key = username(name);
      if (profile?.username === key)
        return {
          ...copy(profile),
          stats:
            session || profile.is_public ? demoStats(read(), catalog) : null,
        };
      if (key === "demo_friend")
        return {
          username: key,
          display_name: "Demo Friend",
          bio: "Working on smoother F2L.",
          learning_goal: "Consistent sub-20 solves",
          is_public: true,
          stats: {
            solve_count: 240,
            best_ms: 8120,
            median_ms: 19800,
            best_ao5_ms: 15300,
            best_ao12_ms: 16950,
            practice_count: 320,
            active_days: 45,
            confident_count: 18,
            case_count: 78,
            total_time_ms: 4752000,
          },
        };
      if (key === "demo_private")
        return {
          username: key,
          display_name: "Private Stats Learner",
          bio: "Practising with private statistics.",
          learning_goal: "",
          is_public: false,
          stats: null,
        };
      return null;
    },
    claim(name) {
      requireSession();
      const key = username(name);
      if (profile || ["demo_friend", "demo_private"].includes(key))
        throw Error("That demo username is already taken.");
      profile = { ...owner(), username: key };
      scenario = "signed-in";
      return copy(profile);
    },
    save(details) {
      requireSession();
      if (!profile) throw Error("Choose a demo username first.");
      profile = { ...profile, ...profileDetails(details) };
      return copy(profile);
    },
    visibility(isPublic) {
      requireSession();
      if (!profile || typeof isPublic !== "boolean")
        throw Error("Invalid demo visibility.");
      profile = { ...profile, is_public: isPublic };
      return copy(profile);
    },
    sendEmail(email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw Error("Enter an email for the demo sign-in.");
      pendingEmail = email;
    },
    verifyCode(code) {
      if (!pendingEmail || code !== DEMO_CODE)
        throw Error(`Use demo code ${DEMO_CODE}. No email is sent.`);
      session = { user: { id: "demo-account", email: pendingEmail } };
      pendingEmail = "";
      scenario = profile ? "signed-in" : "setup";
    },
    signOut() {
      session = null;
      scenario = "signed-out";
    },
    deleteAccount(confirmation) {
      requireSession();
      if (confirmation !== (profile?.username || "DELETE"))
        throw Error("Type the confirmation exactly.");
      profile = session = null;
      scenario = "signed-out";
    },
    guestBackup() {
      return trainingBackup(
        { ...emptyProgress(), selected: ["pll-Ua"] },
        [
          {
            id: "demo-guest-solve",
            cubeId: null,
            elapsed: 15321,
            date: "2026-10-20T12:00:00Z",
            day: "2026-10-20",
            scramble: Array(10).fill("R U").join(" "),
          },
        ],
        { cubes: [], defaultId: null },
      );
    },
  };
}
