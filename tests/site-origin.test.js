import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { render } from "svelte/server";
import {
  CANONICAL_ORIGIN,
  originRecovery,
  recoveryLinks,
  earlierLearningBackup,
} from "../src/site-origin.js";
import OriginRecovery from "../src/components/OriginRecovery.svelte";
import catalog from "../data/algorithms.json" with { type: "json" };
import { emptyProgress } from "../src/progress.js";

const config = JSON.parse(
  await readFile(new URL("../vercel.json", import.meta.url)),
);
function redirect(href) {
  const url = new URL(href);
  for (const route of config.redirects) {
    const path = new RegExp(`^${route.source.replace(":path", "")}$`).exec(
      url.pathname,
    );
    const has = route.has.every((item) =>
      new RegExp(`^(?:${item.value})$`).test(url.hostname),
    );
    const bypass = route.missing.some(
      (item) => url.searchParams.get(item.key) === item.value,
    );
    if (path && has && !bypass)
      return {
        status: route.permanent ? 308 : 307,
        location: route.destination.replace(":path*", path[1]),
      };
  }
  return null;
}

test("production aliases converge on the canonical address while recovery pages and their assets remain on the original origin", () => {
  for (const host of ["cube.nicbat.com", "www.lastlayer.net"]) {
    for (const path of ["/", "/index.html", "/some/path"])
      assert.deepEqual(redirect(`https://${host}${path}`), {
        status: 307,
        location: `${CANONICAL_ORIGIN}${path}`,
      });
    assert.equal(redirect(`https://${host}/?recover-origin=1#/progress`), null);
    assert.notEqual(redirect(`https://${host}/?recover-origin=0`), null);
    for (const path of [
      "/assets/index.js",
      "/assets/index.css",
      "/assets/font.woff2",
      "/favicon.svg",
      "/licenses/Manrope.txt",
    ])
      assert.equal(
        redirect(`https://${host}${path}`),
        null,
        `Recovery must load ${path} on the original origin`,
      );
  }
  for (const host of [
    "lastlayer.net",
    "127.0.0.1",
    "preview.vercel.app",
    "cube.nicbat.com.evil.test",
  ])
    assert.equal(redirect(`https://${host}/`), null);
});

test("recovery links keep routes and ordinary query values but never forward the bypass flag", () => {
  assert.equal(originRecovery("http://127.0.0.1:4174/#/home"), null);
  assert.deepEqual(
    originRecovery(
      "https://cube.nicbat.com/?recover-origin=1&foo=two%20words#/cfop/pll/full?settings",
    ),
    {
      hostname: "cube.nicbat.com",
      canonicalHref:
        "https://lastlayer.net/?foo=two+words#/cfop/pll/full?settings",
    },
  );
  for (const link of recoveryLinks) {
    assert.equal(new URL(link.href).searchParams.get("recover-origin"), "1");
    assert.equal(redirect(link.href), null);
  }
});

test("earlier learning exports validate legacy data and preserve all original storage bytes", () => {
  const old = {
    ...emptyProgress(),
    version: 1,
    selected: ["oll-27"],
    known: { "pll-Y": [1] },
  };
  let raw = JSON.stringify(old);
  const storage = {
    getItem: () => raw,
    setItem: () => {
      throw Error("Must not change stored progress");
    },
  };
  assert.deepEqual(earlierLearningBackup(storage, catalog), {
    ...old,
    version: 2,
  });
  assert.equal(raw, JSON.stringify(old));
  for (const invalid of [
    null,
    "bad JSON",
    JSON.stringify({ ...old, selected: ["unknown"] }),
    JSON.stringify({ ...old, version: 99 }),
  ]) {
    raw = invalid;
    assert.throws(() => earlierLearningBackup(storage, catalog));
    assert.equal(raw, invalid);
  }
});

test("origin recovery offers explicit export and navigation without moving data or exposing it in URLs", () => {
  const html = render(OriginRecovery, {
    props: {
      recovery: originRecovery(
        "https://cube.nicbat.com/?recover-origin=1#/progress",
      ),
      earlier: true,
    },
  }).body;
  assert.match(html, /Recover progress from cube.nicbat.com/);
  assert.match(html, /data-action="backup"/);
  assert.match(html, /data-action="export-earlier-learning"/);
  assert.match(html, /href="https:\/\/lastlayer.net\/#\/progress"/);
  assert.doesNotMatch(html, /localStorage|access_token|refresh_token/);
  const sample = render(OriginRecovery, {
    props: {
      recovery: {
        hostname: "cube.nicbat.com",
        canonicalHref: CANONICAL_ORIGIN,
      },
      testData: true,
    },
  }).body;
  assert.match(sample, /Turn off test data/);
  assert.match(
    sample,
    /<button(?=[^>]*data-action="backup")(?=[^>]*disabled)[^>]*>/,
  );
});
