import { test } from "node:test";
import assert from "node:assert/strict";
import { captureScreenshot } from "./e2e/screenshots.js";

test("review screenshots are opt-in and preserve capture options and failures", async () => {
  const previous = process.env.LAST_LAYER_SCREENSHOTS;
  const calls = [];
  const options = { path: "review.png", fullPage: true };
  const target = { screenshot: async (value) => calls.push(value) };
  try {
    delete process.env.LAST_LAYER_SCREENSHOTS;
    await captureScreenshot(target, options);
    process.env.LAST_LAYER_SCREENSHOTS = "0";
    await captureScreenshot(target, options);
    assert.deepEqual(calls, []);
    process.env.LAST_LAYER_SCREENSHOTS = "1";
    await captureScreenshot(target, options);
    assert.deepEqual(calls, [options]);
    await assert.rejects(
      captureScreenshot(
        {
          screenshot: async () => {
            throw new Error("capture failed");
          },
        },
        options,
      ),
      /capture failed/,
    );
  } finally {
    if (previous === undefined) delete process.env.LAST_LAYER_SCREENSHOTS;
    else process.env.LAST_LAYER_SCREENSHOTS = previous;
  }
});
