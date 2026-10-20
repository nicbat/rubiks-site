import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
const assets = await readdir(new URL("../dist/assets/", import.meta.url));
let jsBytes = 0,
  cssBytes = 0;
for (const name of assets) {
  const bytes = await readFile(
    new URL(`../dist/assets/${name}`, import.meta.url),
  );
  if (name.endsWith(".js")) jsBytes += gzipSync(bytes).length;
  if (name.endsWith(".css")) cssBytes += gzipSync(bytes).length;
  if (/\.(js|css)$/.test(name))
    assert.doesNotMatch(
      bytes.toString(),
      /https:\/\/(?:fonts\.googleapis|fonts\.gstatic|cdn\.cubing)\./,
      `External asset reference in ${name}`,
    );
}
// Explicit transfer-size headroom, not noisy wall-clock timing assertions.
// The owner approved revised limits for the expanded local app: tracking/charts,
// full recoverable backups, solve review/notes, bulk edits, and isolated test data.
// These allow modest maintenance headroom over the measured build. Future cloud
// features need their own size review; see docs/testing.md.
const jsBudget = 160 * 1024;
const cssBudget = 14 * 1024;
assert.ok(
  jsBytes > 0 && jsBytes <= jsBudget,
  `JS gzip ${jsBytes} exceeds ${jsBudget / 1024} KiB budget`,
);
assert.ok(
  cssBytes > 0 && cssBytes <= cssBudget,
  `CSS gzip ${cssBytes} exceeds ${cssBudget / 1024} KiB budget`,
);
const html = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
assert.doesNotMatch(
  html,
  /(?:src|href)="\/assets\//,
  "Assets must work under a static-host subdirectory",
);
console.log(
  `Build budgets pass: JS ${(jsBytes / 1024).toFixed(1)} KiB gzip / ${jsBudget / 1024} KiB; CSS ${(cssBytes / 1024).toFixed(1)} KiB gzip / ${cssBudget / 1024} KiB.`,
);
