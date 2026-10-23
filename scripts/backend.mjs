import { prepareStack } from "./local-supabase.mjs";
const action = process.argv[2];
if (!["start", "stop", "reset"].includes(action))
  throw Error("Use start, stop or reset.");
const stack = await prepareStack("dev");
if (action === "stop") await stack.stop();
else {
  const config = await stack.start();
  if (action === "reset") await stack.reset();
  else await stack.migrate();
  console.log(
    `Last Layer local API: ${config.url}\nEmail inbox: ${config.mail}${action === "reset" ? "\nLocal development data reset to fixtures." : ""}`,
  );
}
