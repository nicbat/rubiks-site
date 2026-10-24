// Successful captures are review artifacts, not visual assertions. Failure
// screenshots remain enabled independently in the Playwright configuration.
export async function captureScreenshot(target, options) {
  if (process.env.LAST_LAYER_SCREENSHOTS === "1") {
    return target.screenshot(options);
  }
}
