import { dataApi } from "./supabase.js";

const reserved = new Set([
  "admin",
  "administrator",
  "support",
  "settings",
  "account",
  "accounts",
  "lastlayer",
  "last_layer",
  "api",
  "auth",
]);
export function username(value) {
  const name = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(name) || reserved.has(name))
    throw Error(
      "Use 3–24 letters, numbers or underscores, starting with a letter. This name may be reserved.",
    );
  return name;
}
// The legacy is_public field controls statistics sharing. Profiles are discoverable.
export function validateProfile(value) {
  if (
    !value ||
    username(value.username) !== value.username ||
    typeof value.is_public !== "boolean"
  )
    throw Error("Invalid profile response.");
  return {
    username: value.username,
    is_public: value.is_public,
    ...profileDetails(value),
  };
}
export function profileDetails(value) {
  const details = {};
  for (const [key, max] of [
    ["display_name", 60],
    ["bio", 280],
    ["learning_goal", 120],
  ]) {
    const text = value[key] ?? "";
    if (typeof text !== "string" || text.length > max)
      throw Error(
        `Profile ${key.replaceAll("_", " ")} is too long or invalid.`,
      );
    details[key] = text.trim();
  }
  return details;
}
// Explicit visitor projection: owner-only API fields never enter a preview.
export function visitorProfile(profile) {
  if (!profile) return null;
  return {
    username: profile.username,
    is_public: profile.is_public,
    display_name: profile.display_name,
    bio: profile.bio,
    learning_goal: profile.learning_goal,
    stats:
      profile.is_public && profile.stats
        ? validateProfileStats(profile.stats)
        : null,
  };
}
export function profileHasDraft(account) {
  return (
    !!account.profile &&
    !!account.profileDraft &&
    Object.entries(profileDetails(account.profile)).some(
      ([key, value]) => account.profileDraft[key] !== value,
    )
  );
}
export function validateProfileStats(value) {
  if (value === null) return null;
  if (!value || typeof value !== "object")
    throw Error("Invalid profile statistics.");
  const result = {};
  for (const key of [
    "practice_count",
    "active_days",
    "confident_count",
    "case_count",
    "solve_count",
  ]) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 0)
      throw Error("Invalid profile statistics.");
    result[key] = value[key];
  }
  for (const key of [
    "total_time_ms",
    "best_ms",
    "median_ms",
    "best_ao5_ms",
    "best_ao12_ms",
  ]) {
    if (
      (key === "total_time_ms" || value[key] !== null) &&
      (!Number.isFinite(value[key]) || value[key] < 0)
    )
      throw Error("Invalid profile statistics.");
    result[key] = value[key];
  }
  if (result.confident_count > result.case_count)
    throw Error("Invalid profile statistics.");
  return result;
}
export function profileRemote(client, userId, config, request = fetch) {
  const api = dataApi(client, userId, config, request);
  async function one(path, body, method) {
    const rows = await api.call(path, body, method);
    if (!Array.isArray(rows) || rows.length > 1)
      throw Error("Invalid profile response.");
    return rows[0] ? validateProfile(rows[0]) : null;
  }
  const selection = "select=username,is_public,display_name,bio,learning_goal";
  return {
    own: () =>
      one(`profiles?${selection}&user_id=eq.${encodeURIComponent(userId)}`),
    async find(name) {
      const normalized = username(name);
      let value;
      try {
        value = await api.call("rpc/profile_for_username", {
          profile_username: normalized,
        });
      } catch (error) {
        // Static deployments can reach users before the database migration.
        // The legacy table read still enforces RLS; never fetch raw training or
        // reinterpret the old statistics as the new all-time summary.
        if (error.status !== 404 || error.code !== "PGRST202") throw error;
        const profile = await one(
          `profiles?${selection}&username=eq.${normalized}`,
        );
        return profile ? { ...profile, stats: null } : null;
      }
      if (value === null) return null;
      return {
        ...validateProfile(value),
        stats: validateProfileStats(value.stats),
      };
    },
    async claim(name) {
      try {
        const profile = await one(
          `profiles?${selection}`,
          { user_id: userId, username: username(name) },
          "POST",
        );
        if (!profile) throw Error();
        return profile;
      } catch (error) {
        if (error.code === "23505")
          throw Error(
            "That username is already taken, or this account already has a username. Reload to check your account or choose another name.",
          );
        throw error;
      }
    },
    async visibility(isPublic) {
      if (typeof isPublic !== "boolean")
        throw Error("Invalid profile visibility.");
      const profile = await one(
        `profiles?${selection}&user_id=eq.${encodeURIComponent(userId)}`,
        { is_public: isPublic },
        "PATCH",
      );
      if (!profile)
        throw Error("Profile could not be updated. Reload and try again.");
      return profile;
    },
    async save(details) {
      const profile = await one(
        `profiles?${selection}&user_id=eq.${encodeURIComponent(userId)}`,
        profileDetails(details),
        "PATCH",
      );
      if (!profile)
        throw Error("Profile could not be saved. Reload and try again.");
      return profile;
    },
    async deleteAccount(confirmation) {
      const result = await api.call("rpc/delete_my_account", { confirmation });
      if (result !== true)
        throw Error("Account deletion could not be confirmed. Try again.");
    },
  };
}
