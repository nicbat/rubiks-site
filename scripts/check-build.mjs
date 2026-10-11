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
// 48 KiB accommodates the full 41-case F2L reference, local diagrams, and guides.
assert.ok(
  jsBytes > 0 && jsBytes <= 48 * 1024,
  `JS gzip ${jsBytes} exceeds 48 KiB budget`,
);
assert.ok(
  cssBytes > 0 && cssBytes <= 10 * 1024,
  `CSS gzip ${cssBytes} exceeds 10 KiB budget`,
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
  `Build budgets pass: JS ${(jsBytes / 1024).toFixed(1)} KiB gzip / 48 KiB; CSS ${(cssBytes / 1024).toFixed(1)} KiB gzip / 10 KiB.`,
);
