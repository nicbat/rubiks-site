import { test, expect } from "./fixtures.js";

test("solve timer supports Space, stable hundredths, and next scramble", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByRole("heading", { name: "Timer", exact: true }).click();
  const clock = page.getByLabel("Solve time in seconds");
  const scramble = await page.locator("#timer-scramble").textContent();
  await expect(clock).toHaveText("0.00");
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "New scramble", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(1250);
  await expect(clock).toHaveText(/^1\.\d{2}$/);
  await page.keyboard.press("Space");
  const result = await clock.textContent();
  await expect(
    page.getByRole("status").filter({ hasText: "Finished in" }),
  ).toBeVisible();
  await page.clock.runFor(1000);
  await expect(clock).toHaveText(result);
  await page.keyboard.press("Space");
  await expect(clock).toHaveText("0.00");
  await expect(page.locator("#timer-scramble")).not.toHaveText(scramble);
});

test("timer touch controls work and navigation stops the clock", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.clock.runFor(2340);
  await page.getByRole("button", { name: "My learning", exact: true }).click();
  await page.clock.runFor(10000);
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Next scramble", exact: true }),
  ).toBeVisible();
  const result = await page.getByLabel("Solve time in seconds").textContent();
  await page.clock.runFor(2000);
  await expect(page.getByLabel("Solve time in seconds")).toHaveText(result);
  await page
    .getByRole("button", { name: "Next scramble", exact: true })
    .click();
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.clock.runFor(350);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect(page.getByLabel("Solve time in seconds")).toHaveText(
    /^0\.\d{2}$/,
  );
});

test("timer digits keep equal rendered widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await expect(page.getByLabel("Solve time in seconds")).toHaveCSS(
    "font-family",
    /monospace/,
  );
  const widths = await page
    .getByLabel("Solve time in seconds")
    .evaluate((clock) => {
      const sample = clock.cloneNode();
      sample.removeAttribute("id");
      sample.style.position = "absolute";
      sample.style.visibility = "hidden";
      sample.style.width = "max-content";
      clock.parentElement.append(sample);
      const widths = ["11.11", "88.88", "00.00", "23.59"].map((value) => {
        sample.textContent = value;
        return sample.getBoundingClientRect().width;
      });
      sample.remove();
      return widths;
    });
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.1);
});
