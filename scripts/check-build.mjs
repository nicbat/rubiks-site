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
// Transfer-size guardrails, not browser rendering-performance measurements.
// On 2026-10-23 the owner approved 320 KiB JS and 32 KiB CSS for growth headroom;
// see docs/testing.md for the measured baseline and budget history.
const jsBudget = 320 * 1024;
const cssBudget = 32 * 1024;
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
assert.match(
  html,
  /src="\/assets\//,
  "Nested routes must load assets from the site root",
);
console.log(
  `Build budgets pass: JS ${(jsBytes / 1024).toFixed(1)} KiB gzip / ${jsBudget / 1024} KiB; CSS ${(cssBytes / 1024).toFixed(1)} KiB gzip / ${cssBudget / 1024} KiB.`,
);
