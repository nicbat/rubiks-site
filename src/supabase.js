// Supabase's default email provider sends implicit-flow links. Capture the
// fragment before the app's hash router runs, then erase credentials from history.
export function readAuthRedirect(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (
    !params.has("access_token") &&
    !params.has("error") &&
    !params.has("error_code")
  )
    return null;
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (
    params.has("error") ||
    params.has("error_code") ||
    !access_token ||
    !refresh_token
  )
    return { error: true };
  return { access_token, refresh_token };
}

export function supabaseConfig(env) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key)
    throw Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  const parsed = new URL(url);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw Error(
      "Use the Supabase project origin without credentials or a path.",
    );
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  )
    throw Error("Supabase requires HTTPS.");
  if (key.startsWith("sb_secret_"))
    throw Error("Use a Supabase publishable key, never a secret key.");
  if (key.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") throw Error();
    } catch {
      throw Error("Use a publishable or legacy anon key.");
    }
  } else if (!key.startsWith("sb_publishable_"))
    throw Error("Use a Supabase publishable key.");
  return { url: parsed.origin, key };
}
export async function loadSupabase(config) {
  const { AuthClient } = await import("@supabase/auth-js");
  return {
    auth: new AuthClient({
      url: `${config.url}/auth/v1`,
      headers: { apikey: config.key },
      storageKey: `last-layer.auth.${new URL(config.url).host}`,
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    }),
  };
}
export function dataApi(client, userId, config, request = fetch) {
  const abort = new AbortController();
  async function call(
    path,
    body,
    method = body === undefined ? "GET" : "POST",
  ) {
    let session = null;
    if (userId) {
      const result = await client.auth.getSession();
      if (result.error || result.data.session?.user.id !== userId)
        throw Object.assign(Error("Account session changed. Sign in again."), {
          code: "AUTH_REQUIRED",
        });
      session = result.data.session;
    }
    const response = await request(`${config.url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: config.key,
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        "Content-Type": "application/json",
        ...(body === undefined ? {} : { Prefer: "return=representation" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) {
      const error = Error(
        `Cloud request failed (${response.status}). Check your connection and try again.`,
      );
      error.status = response.status;
      try {
        error.code = (await response.json()).code;
      } catch {
        /* Keep the HTTP error. */
      }
      throw error;
    }
    return response.json();
  }
  return {
    cancel() {
      abort.abort();
    },
    call,
  };
}
export function trainingRemote(client, userId, config, request = fetch) {
  const { call, cancel } = dataApi(client, userId, config, request);
  return {
    cancel,
    async read() {
      const query = new URLSearchParams({
        select: "revision,payload",
        user_id: `eq.${userId}`,
      });
      const rows = await call(`training_snapshots?${query}`);
      if (!Array.isArray(rows) || rows.length > 1)
        throw Error("Invalid cloud response.");
      return rows[0] ?? null;
    },
    write(payload, revision) {
      return call("rpc/save_training_snapshot", {
        payload,
        expected_revision: revision,
      });
    },
  };
}
