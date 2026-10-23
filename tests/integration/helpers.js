import { setTimeout } from "node:timers/promises";
import { localOrigin } from "../../scripts/local-supabase.mjs";
import { loadSupabase } from "../../src/supabase.js";

export function backendConfig() {
  return {
    url: localOrigin(process.env.LAST_LAYER_TEST_API_URL),
    key: process.env.LAST_LAYER_TEST_ANON_KEY,
  };
}
export async function emailCode(email) {
  const mail = localOrigin(process.env.LAST_LAYER_TEST_MAIL_URL);
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const response = await fetch(
      `${mail}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok)
      throw Error(`Local email search failed (${response.status}).`);
    const { messages } = await response.json();
    if (messages?.length) {
      const detail = await fetch(
        `${mail}/api/v1/message/${encodeURIComponent(messages[0].ID)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!detail.ok)
        throw Error(`Local email read failed (${detail.status}).`);
      const message = await detail.json();
      const code = `${message.Text || ""} ${message.HTML || ""}`.match(
        /\b\d{8}\b/,
      )?.[0];
      if (!code)
        throw Error("Local sign-in email did not contain an eight-digit code.");
      return code;
    }
    // Poll an observable service condition, bounded by the deadline.
    await setTimeout(100);
  }
  throw Error(`No local sign-in email arrived for ${email}.`);
}
export async function signIn(email, clients) {
  const client = await loadSupabase(backendConfig());
  clients.push(client);
  const sent = await client.auth.signInWithOtp({ email });
  if (sent.error) throw sent.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await emailCode(email),
    type: "email",
  });
  if (verified.error) throw verified.error;
  if (!verified.data.session) throw Error("Local sign-in returned no session.");
  return {
    client,
    id: verified.data.session.user.id,
    session: verified.data.session,
  };
}
export async function closeClients(clients) {
  await Promise.all(clients.map((client) => client.auth.stopAutoRefresh()));
}
