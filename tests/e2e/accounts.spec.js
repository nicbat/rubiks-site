import { captureScreenshot } from "./screenshots.js";
import {
  test,
  expect,
  seed,
  progressFixture,
  openSettings,
  openAccount,
  openDataSettings,
  holdStartTimer,
  closeSettings,
  importBackup,
} from "./fixtures.js";
import { readFile } from "node:fs/promises";

const owner = "11111111-1111-4111-8111-111111111111";
const guestKey = "last-layer.progress.v2";
const accountKey = `last-layer.account.${owner}.${guestKey}`;
const cloudBackup = (selected = ["pll-Ua"]) => ({
  format: "last-layer-training",
  version: 1,
  progress: { version: 2, selected, variants: {}, attempts: [] },
  solves: [],
  cubeCollection: { cubes: [], defaultId: null },
});
async function mockSupabase(
  page,
  initialRow = null,
  initialProfile = { username: "learner", is_public: false },
) {
  let row = initialRow;
  let profile = initialProfile;
  let summary = null;
  const requests = [];
  const user = {
    id: owner,
    email: "learner@example.com",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-20T12:00:00Z",
  };
  const jwtPart = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })}.test-signature`;
  await page.route("**/auth/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let body = {};
    if (/\/(verify|token)$/.test(path))
      body = {
        access_token: token,
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      };
    if (path.endsWith("/user")) body = user;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let body;
    if (path.endsWith("/profiles")) {
      const req = route.request();
      const params = new URL(req.url()).searchParams;
      const signedIn = req.headers().authorization === `Bearer ${token}`;
      if (req.method() === "POST") {
        expect(signedIn).toBe(true);
        expect(profile).toBeNull();
        profile = { username: req.postDataJSON().username, is_public: false };
      } else if (req.method() === "PATCH") {
        expect(signedIn).toBe(true);
        profile = { ...profile, ...req.postDataJSON() };
      }
      body =
        profile &&
        (!params.has("username") ||
          params.get("username") === `eq.${profile.username}`)
          ? [profile]
          : [];
    } else if (path.endsWith("/rpc/profile_for_username")) {
      const signedIn =
        route.request().headers().authorization === `Bearer ${token}`;
      body =
        profile &&
        route.request().postDataJSON().profile_username === profile.username
          ? {
              ...profile,
              stats: signedIn || profile.is_public ? summary : null,
            }
          : null;
    } else if (path.endsWith("/rpc/delete_my_account")) {
      expect(route.request().postDataJSON()).toEqual({
        confirmation: profile?.username || "DELETE",
      });
      profile = row = summary = null;
      body = true;
    } else if (path.endsWith("/training_snapshots")) body = row ? [row] : [];
    else if (path.endsWith("/rpc/save_training_snapshot")) {
      const args = route.request().postDataJSON();
      if (args.expected_revision !== (row?.revision ?? 0)) body = null;
      else {
        row = { revision: args.expected_revision + 1, payload: args.payload };
        body = row.revision;
      }
    } else throw Error(`Unexpected mocked Supabase path: ${path}`);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return {
    requests,
    token,
    get row() {
      return row;
    },
    get profile() {
      return profile;
    },
    set profile(value) {
      profile = value;
    },
    set summary(value) {
      summary = value;
    },
    set row(value) {
      row = value;
    },
  };
}
async function signIn(page) {
  await openAccount(page);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("learner@example.com");
  await page
    .getByRole("button", { name: "Send sign-in email", exact: true })
    .click();
  const code = page.getByRole("textbox", { name: "Email code", exact: true });
  await expect(code).toBeFocused();
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByText("learner@example.com", { exact: true }),
  ).toBeVisible();
}
async function sync(page) {
  await openAccount(page, "sync");
  await page
    .getByRole("dialog", { name: "Sync status", exact: true })
    .getByRole("button", { name: "Check sync", exact: true })
    .click();
  await expect(page.locator(".header-sync")).toHaveAttribute(
    "data-state",
    /^(synced|guest-separate)$/,
  );
}

for (const theme of ["light", "dark"])
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`missing profile migration retains owner and public pages at ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, info) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript(
        ({ theme }) => {
          localStorage.setItem("last-layer-theme", theme);
          // Inject the unavailable-schema response at the fetch boundary so the
          // shared fixture still rejects every unexpected failed network request.
          const request = window.fetch.bind(window);
          window.fetch = (input, options) => {
            const url = new URL(
              input instanceof Request ? input.url : input,
              location.href,
            );
            if (
              url.pathname === "/rest/v1/rpc/profile_for_username" &&
              !window.__profileMigrationReady
            )
              return Promise.resolve(
                Response.json({ code: "PGRST202" }, { status: 404 }),
              );
            return request(input, options);
          };
        },
        { theme },
      );
      const api = await mockSupabase(page, null, {
        username: "learner",
        is_public: true,
        display_name: "Learner",
        bio: "Learning PLL",
        learning_goal: "Full PLL",
      });
      await seed(page);
      await signIn(page);
      await page
        .getByRole("banner")
        .getByRole("link", { name: "My profile", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Learner", exact: true }),
      ).toBeVisible();
      const notice = page.getByText(
        "Progress summary is temporarily unavailable.",
        { exact: true },
      );
      await expect(notice).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Edit profile", exact: true }),
      ).toBeVisible();
      await openAccount(page);
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      await expect(
        page.getByRole("textbox", { name: "Email", exact: true }),
      ).toBeFocused();
      await page.evaluate(() => {
        location.hash = "/u/learner";
      });
      await expect(
        page.getByRole("heading", { name: "Learner", exact: true }),
      ).toBeVisible();
      await expect(notice).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "All-time progress", exact: true }),
      ).toHaveCount(0);
      const retry = page.getByRole("button", {
        name: "Try again",
        exact: true,
      });
      for (const control of [notice, retry]) {
        await control.scrollIntoViewIfNeeded();
        const bounds = await control.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        if (control === retry) {
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          await expect(retry).toBeInViewport();
        }
      }
      await captureScreenshot(page, {
        path: info.outputPath("profile-migration-pending.png"),
        fullPage: true,
      });
      // A private summary leaves the identity discoverable, even on fallback.
      api.profile = { ...api.profile, is_public: false };
      await retry.click();
      await expect(
        page.getByText("Statistics are private.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Learner", exact: true }),
      ).toBeVisible();
      await expect(notice).toHaveCount(0);
      api.profile = { ...api.profile, is_public: true };
      await page
        .getByRole("link", { name: "Find a learner", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Look up a username", exact: true })
        .fill("learner");
      await page
        .getByRole("button", { name: "View profile", exact: true })
        .click();
      await expect(notice).toBeVisible();
      api.summary = {
        practice_count: 12,
        active_days: 4,
        confident_count: 2,
        case_count: 78,
        total_time_ms: 60000,
        solve_count: 5,
        best_ms: 10000,
        median_ms: 12000,
        best_ao5_ms: 12000,
        best_ao12_ms: null,
      };
      await page.evaluate(() => {
        window.__profileMigrationReady = true;
      });
      await retry.click();
      await expect(
        page.getByRole("heading", { name: "All-time progress", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("group", { name: "Activity summary", exact: true }),
      ).toContainText("12");
      await expect(notice).toHaveCount(0);
      await expect(retry).toHaveCount(0);
    });
  }

test("email-code sign-in isolates guest data, persists sync across reload and restores guest on sign-out", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  await seed(page, progressFixture());
  const guest = await page.evaluate(
    (key) => localStorage.getItem(key),
    guestKey,
  );
  await signIn(page);
  await sync(page);
  expect(api.row.payload.progress.selected).toEqual([]);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), guestKey),
  ).toBe(guest);
  await page.reload();
  await openAccount(page);
  await expect(
    page.getByText("learner@example.com", { exact: true }),
  ).toBeVisible();
  await sync(page);
  await openAccount(page, "settings");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send sign-in email" }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), guestKey),
  ).toBe(guest);
  expect(api.requests.filter((path) => path.endsWith("/otp"))).toHaveLength(1);
});

test("default email sign-in links restore existing cloud progress on a fresh device and remove URL credentials", async ({
  page,
}) => {
  const api = await mockSupabase(page, { revision: 4, payload: cloudBackup() });
  await seed(page);
  const guest = await page.evaluate(
    (key) => localStorage.getItem(key),
    guestKey,
  );
  await page.goto(
    `/?email-callback=1#access_token=${api.token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=magiclink`,
  );
  await openAccount(page);
  await expect(
    page.getByText("learner@example.com", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/account$/);
  expect(page.url()).not.toContain("access_token");
  expect(page.url()).not.toContain("refresh_token");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), guestKey),
  ).toBe(guest);
  await sync(page);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).selected,
      accountKey,
    ),
  ).toEqual(["pll-Ua"]);
  expect(api.row.revision).toBe(4);
  await expect(
    page.getByRole("button", { name: "Use cloud data", exact: true }),
  ).toHaveCount(0);
});

test("expired email links preserve guest progress and offer a fresh sign-in", async ({
  page,
}) => {
  await mockSupabase(page);
  await seed(page);
  const guest = await page.evaluate(
    (key) => localStorage.getItem(key),
    guestKey,
  );
  await page.goto(
    "/?email-callback=expired#error=access_denied&error_code=otp_expired&error_description=Expired",
  );
  await openAccount(page);
  await expect(
    page.getByRole("button", { name: "Send sign-in email", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/request a new sign-in email/)).toBeVisible();
  expect(page.url()).not.toContain("error_description");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), guestKey),
  ).toBe(guest);
});

test("cloud conflict requires a choice, validates downloads and keeps test data out of cloud", async ({
  page,
}) => {
  const api = await mockSupabase(page, { revision: 4, payload: cloudBackup() });
  await seed(page);
  await page.evaluate(
    ([key, progress]) => localStorage.setItem(key, JSON.stringify(progress)),
    [accountKey, cloudBackup(["pll-T"]).progress],
  );
  await signIn(page);
  await openAccount(page, "sync");
  await page
    .getByRole("dialog", { name: "Sync status", exact: true })
    .getByRole("button", { name: "Check sync", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use cloud data", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use cloud data", exact: true })
    .click();
  await expect(page.locator(".header-sync")).toHaveAttribute(
    "data-state",
    /^(synced|guest-separate)$/,
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).selected,
      accountKey,
    ),
  ).toEqual(["pll-Ua"]);
  const before = JSON.stringify(api.row);
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .check();
  await openAccount(page, "sync");
  await expect(
    page
      .getByRole("dialog", { name: "Sync status", exact: true })
      .getByRole("button", { name: "Check sync", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("learner@example.test", { exact: true }),
  ).toBeVisible();
  await openAccount(page, "profile");
  await page
    .getByRole("textbox", { name: "Bio", exact: true })
    .fill("Demo bio only");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await openAccount(page, "sync");
  await page
    .getByRole("dialog", { name: "Sync status", exact: true })
    .getByRole("button", { name: "Check sync", exact: true })
    .click();
  await expect(
    page.getByText("Saved in demo. No cloud requests.", { exact: true }),
  ).toBeVisible();
  expect(JSON.stringify(api.row)).toBe(before);
  await openSettings(page);
  await page
    .getByRole("checkbox", { name: "Enable test data", exact: true })
    .uncheck();
  await openAccount(page, "overview");
  await expect(
    page.getByText("learner@example.com", { exact: true }),
  ).toBeVisible();
  await openAccount(page, "profile");
  await expect(
    page.getByRole("textbox", { name: "Bio", exact: true }),
  ).toHaveValue("");
  await sync(page);
  api.row = { revision: 5, payload: { broken: true } };
  await openAccount(page, "sync");
  await page
    .getByRole("dialog", { name: "Sync status", exact: true })
    .getByRole("button", { name: "Check sync", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Sync status", exact: true })
      .getByText(/Sync could not finish/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).selected,
      accountKey,
    ),
  ).toEqual(["pll-Ua"]);
  await closeSettings(page);
});

test("account backup imports sync solves and cubes, while failed saves keep drafts off the cloud", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  await seed(page);
  await signIn(page);
  await sync(page);
  await closeSettings(page);
  const imported = cloudBackup(["pll-T"]);
  imported.cubeCollection = {
    cubes: [{ id: "main", name: "Main", description: "" }],
    defaultId: "main",
  };
  imported.solves = [
    {
      id: "solve-1",
      cubeId: "main",
      elapsed: 15321,
      date: "2026-10-20T12:00:00Z",
      day: "2026-10-20",
      scramble: Array(10).fill("R U").join(" "),
      notes: "Imported note",
    },
  ];
  await importBackup(page, imported);
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  await openAccount(page);
  await sync(page);
  expect(api.row.payload.solves[0].notes).toBe("Imported note");
  expect(api.row.payload.cubeCollection.defaultId).toBe("main");
  const saved = JSON.stringify(api.row);
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await page.locator("#cube-editor summary").click();
  await page.getByLabel("Name", { exact: true }).fill("Unsaved cube");
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.restoreCubeStorage = () => {
      Storage.prototype.setItem = set;
    };
    Storage.prototype.setItem = function (key, value) {
      if (key.includes(".account.") && key.endsWith("last-layer.cubes.v1"))
        throw new DOMException("Full", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Add cube", exact: true }).click();
  await expect(page.getByText("Unsaved cube", { exact: true })).toBeVisible();
  await openAccount(page);
  await openAccount(page, "sync");
  await expect(
    page
      .getByRole("dialog", { name: "Sync status", exact: true })
      .getByRole("button", { name: "Check sync", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(
    page
      .getByRole("dialog", { name: "Sync status", exact: true })
      .getByText(/Cubes could not be saved/),
  ).toBeVisible();
  expect(JSON.stringify(api.row)).toBe(saved);
  await page.evaluate(() => window.restoreCubeStorage());
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Unsaved cube", exact: true })
    .click();
  await page.getByRole("button", { name: "Save cube", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check sync", exact: true }),
  ).toHaveAttribute("title", "Guest progress is not in your account");
  expect(
    api.row.payload.cubeCollection.cubes.some(
      (cube) => cube.name === "Unsaved cube",
    ),
  ).toBe(true);
  await expect(page.getByText(/Cubes could not be saved/)).toHaveCount(0);
});

for (const theme of ["light", "dark"]) {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 667, height: 375 },
  ]) {
    test(`account conflict fits ${viewport.width}x${viewport.height} in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await mockSupabase(page, { revision: 1, payload: cloudBackup() });
      await seed(page);
      await page.evaluate(
        ([key, progress]) =>
          localStorage.setItem(key, JSON.stringify(progress)),
        [accountKey, cloudBackup(["pll-T"]).progress],
      );
      await page.evaluate(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await page.reload();
      await openAccount(page);
      const email = page.getByRole("textbox", { name: "Email", exact: true });
      expect(
        await email.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
      await email.scrollIntoViewIfNeeded();
      await captureScreenshot(page, {
        path: testInfo.outputPath(
          `account-signin-${theme}-${viewport.width}.png`,
        ),
      });
      await signIn(page);
      await openAccount(page, "sync");
      await page
        .getByRole("dialog", { name: "Sync status", exact: true })
        .getByRole("button", { name: "Check sync", exact: true })
        .click();
      const choice = page.getByRole("button", {
        name: "Use cloud data",
        exact: true,
      });
      await expect(choice).toBeVisible();
      await choice.scrollIntoViewIfNeeded();
      const bounds = await page.locator("#sync-dialog").evaluate((root) => {
        const rect = root.getBoundingClientRect();
        return Array.from(
          root.querySelectorAll('button,input:not([aria-hidden="true"]),p'),
        ).map((el) => {
          const b = el.getBoundingClientRect();
          return {
            left: b.left,
            right: b.right,
            height: b.height,
            control: el.matches("button,input"),
            parentLeft: rect.left,
            parentRight: rect.right,
          };
        });
      });
      for (const b of bounds) {
        expect(b.left).toBeGreaterThanOrEqual(b.parentLeft - 1);
        expect(b.right).toBeLessThanOrEqual(b.parentRight + 1);
        expect(b.right).toBeLessThanOrEqual(viewport.width);
        if (b.control) expect(b.height).toBeGreaterThanOrEqual(44);
      }
      await captureScreenshot(page, {
        path: testInfo.outputPath(`account-${theme}-${viewport.width}.png`),
      });
      await choice.click();
      await expect(page.locator(".header-sync")).toHaveAttribute(
        "data-state",
        /^(synced|guest-separate)$/,
      );
      await openSettings(page);
      const close = page.getByRole("button", {
        name: "Close settings",
        exact: true,
      });
      await close.scrollIntoViewIfNeeded();
      await expect(close).toBeInViewport();
      await close.click();
      await expect(
        page.getByRole("button", { name: "Settings", exact: true }),
      ).toBeFocused();
    });
  }
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`required username and discoverable profile with private statistics at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const api = await mockSupabase(page, null, null);
    await seed(page);
    await signIn(page);
    const field = page.getByRole("textbox", { name: "Choose your username" });
    await expect(field).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Check sync", exact: true }),
    ).toHaveCount(0);
    expect(api.row).toBeNull();
    await field.fill("New_Learner");
    await page
      .getByRole("button", { name: "Create my page", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "@new_learner", exact: true }),
    ).toBeVisible();
    expect(api.profile).toEqual({ username: "new_learner", is_public: false });
    await sync(page);
    await openDataSettings(page);
    await page
      .getByRole("button", { name: "Bring guest progress into my account" })
      .click();
    await page
      .getByRole("button", { name: "Add guest progress", exact: true })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Settings", exact: true })
        .getByText(
          "Guest progress added. The guest copy is kept on this device.",
          { exact: true },
        ),
    ).toBeVisible();
    await sync(page);
    expect(api.row.payload.progress.selected).toEqual(["pll-T", "pll-Ua"]);
    await openAccount(page, "profile");
    await page.getByRole("link", { name: "@new_learner", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "@new_learner" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your profile is discoverable. Only you can view your statistics.",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await openAccount(page, "profile");
    await page
      .getByRole("button", { name: "Make stats public", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Make stats private", exact: true }),
    ).toBeVisible();
    await openAccount(page, "settings");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    // Sign-out redirects after the auth request completes. Wait for its final
    // focus restoration before navigating, or that redirect can win the race.
    await expect(
      page.getByRole("textbox", { name: "Email", exact: true }),
    ).toBeFocused();
    await closeSettings(page);
    await page.goto("/#/u/new_learner");
    await expect(
      page.getByRole("heading", { name: "@new_learner" }),
    ).toBeVisible();
    api.profile.is_public = false;
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "@new_learner", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Statistics are private.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Find a learner", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Look up a username" })
      .fill("missing_learner");
    await page
      .getByRole("button", { name: "View profile", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/u\/missing_learner$/);
    await expect(
      page.getByText("This profile is unavailable.", { exact: true }),
    ).toBeVisible();
    const bounds = await page.locator(".profile-page").evaluate((root) =>
      Array.from(root.querySelectorAll("input,button,h1,p")).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          height: r.height,
          control: el.matches("input,button"),
        };
      }),
    );
    for (const bound of bounds) {
      expect(bound.left).toBeGreaterThanOrEqual(0);
      expect(bound.right).toBeLessThanOrEqual(viewport.width);
      if (bound.control) expect(bound.height).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  test(`profile editing, summary sharing, export and confirmed deletion at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const api = await mockSupabase(page);
    await seed(page);
    await signIn(page);
    await sync(page);
    api.summary = {
      practice_count: 8,
      active_days: 4,
      confident_count: 2,
      case_count: 78,
      total_time_ms: 78000,
      solve_count: 12,
      best_ms: 1000,
      median_ms: 6500,
      best_ao5_ms: null,
      best_ao12_ms: 6500,
    };
    await openAccount(page, "profile");
    await page
      .getByRole("textbox", { name: "Display name", exact: true })
      .fill("Last Layer Learner");
    await page
      .getByRole("textbox", { name: "Bio", exact: true })
      .fill("<script>plain text</script>");
    await page
      .getByRole("textbox", { name: "Learning goal", exact: true })
      .fill("Learning full PLL");
    await expect(
      page.getByRole("checkbox", {
        name: "Show statistics on my public profile",
      }),
    ).toHaveCount(0);
    const controls = await page
      .getByRole("region", { name: "Profile settings", exact: true })
      .evaluate((root) =>
        Array.from(
          root.querySelectorAll(
            'input:not([aria-hidden="true"]),textarea,label,button',
          ),
        ).map((el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height };
        }),
      );
    for (const control of controls) {
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(viewport.width);
      expect(control.height).toBeGreaterThanOrEqual(44);
    }
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(
      page.getByText("Profile saved.", { exact: true }),
    ).toBeVisible();

    await openDataSettings(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "Export account backup", exact: true })
        .click(),
    ]);
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported.account.display_name).toBe("Last Layer Learner");
    expect(exported.account.email).toBe("learner@example.com");
    expect(exported.format).toBe("last-layer-training");
    await openAccount(page, "profile");
    await page.getByRole("link", { name: "@learner", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Last Layer Learner", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("<script>plain text</script>", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Timer summary", exact: true }),
    ).toContainText("Best ao5");
    await page
      .getByRole("button", { name: "Copy profile link", exact: true })
      .click();
    await expect(
      page.getByText(/Profile link copied|Copy this profile link/),
    ).toBeVisible();
    const bounds = await page.locator(".profile-page").evaluate((root) =>
      Array.from(root.querySelectorAll("input,button,h1,p,dt,dd")).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }),
    );
    for (const bound of bounds) {
      expect(bound.left).toBeGreaterThanOrEqual(0);
      expect(bound.right).toBeLessThanOrEqual(viewport.width);
    }
    await openAccount(page, "management");
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Type learner to confirm", exact: true })
      .fill("different");
    await page
      .getByRole("button", {
        name: "Permanently delete my account",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Type the confirmation exactly to delete your account.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(api.profile).not.toBeNull();
    await page
      .getByRole("textbox", { name: "Type learner to confirm", exact: true })
      .fill("learner");
    await page
      .getByRole("button", {
        name: "Permanently delete my account",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Account deleted. Guest data is kept.", { exact: true }),
    ).toBeVisible();
    expect(api.profile).toBeNull();
    expect(api.row).toBeNull();
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) =>
          key.startsWith("last-layer.account."),
        ),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("last-layer.progress.v2")).selected,
      ),
    ).toEqual(["pll-T", "pll-Ua"]);
  });
}

test("reconnection reloads unfinished account setup and starts sync without a manual sync click", async ({
  page,
}) => {
  const api = await mockSupabase(page, null, null);
  await seed(page);
  await signIn(page);
  await expect(
    page.getByRole("textbox", { name: "Choose your username" }),
  ).toBeVisible();
  api.profile = { username: "online_learner", is_public: false };
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("link", { name: "@online_learner", exact: true }),
  ).toBeVisible();
  await openAccount(page, "sync");
  await expect(page.locator(".header-sync")).toHaveAttribute(
    "data-state",
    /^(synced|guest-separate)$/,
  );
  expect(api.row).not.toBeNull();
});

test("saved training changes upload automatically without pressing Sync now", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  await seed(page);
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Check sync", exact: true }),
  ).toHaveAttribute("title", "Guest progress is not in your account");
  await closeSettings(page);
  await importBackup(page, cloudBackup(["pll-T"]));
  await page
    .getByRole("button", { name: "Replace with this backup", exact: true })
    .click();
  await expect
    .poll(() => api.row?.payload.progress.selected)
    .toEqual(["pll-T"]);
});

test("manual checks confirm server acknowledgement without reloading and defer incoming updates during a solve", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  await seed(page);
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Check sync", exact: true }),
  ).toHaveAttribute("title", "Guest progress is not in your account");
  await page.getByRole("button", { name: "Timer", exact: true }).click();
  await page.clock.install();
  const check = page.getByRole("button", { name: "Check sync", exact: true });
  await check.click();
  await expect(page.locator("#toast")).toContainText(
    "Guest progress is not in your account",
  );
  await expect(page).toHaveURL(/#\/timer$/);
  await holdStartTimer(page);
  const changed = cloudBackup(["pll-T"]);
  api.row = { revision: api.row.revision + 1, payload: changed };
  await check.click();
  await expect(page.locator("#toast")).toContainText("Updates waiting");
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sync-marker")).toHaveText("!");
  await page.getByRole("button", { name: "Review sync", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Sync status", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close sync status", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop timer", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(1500);
  await page.getByRole("button", { name: "Stop timer", exact: true }).click();
  await expect.poll(() => api.row.payload.solves.length).toBe(1);
  await expect(check).toHaveAttribute("title", "Updates waiting");
  await expect(
    page.getByRole("group", { name: "Solve penalty", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next scramble (Tab)", exact: true })
    .click();
  await expect(check).toHaveAttribute(
    "title",
    "Guest progress is not in your account",
  );
  expect(api.row.payload.progress.selected).toEqual(["pll-T"]);
  expect(api.row.payload.solves).toHaveLength(1);
});

test("equipment description drafts defer cloud and other-tab data until cancellation", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  await seed(page);
  await signIn(page);
  await sync(page);
  await closeSettings(page);
  await openSettings(page);
  await page.getByRole("button", { name: "Cubes", exact: true }).click();
  const description = page.getByRole("textbox", {
    name: "Description (optional)",
    exact: true,
  });
  await description.fill("Equipment draft to preserve");
  api.row = { revision: api.row.revision + 1, payload: cloudBackup(["pll-T"]) };
  const check = page.getByRole("button", { name: "Check sync", exact: true });
  await check.click();
  await expect(check).toHaveAttribute("title", "Updates waiting");
  await expect(description).toHaveValue("Equipment draft to preserve");

  const sibling = await page.context().newPage();
  try {
    await sibling.route("**/*", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Storage writer</title>",
      }),
    );
    await sibling.goto("/");
    await page.evaluate((key) => {
      window.accountStorageChange = new Promise((resolve) => {
        window.addEventListener("storage", function changed(event) {
          if (event.key !== key) return;
          window.removeEventListener("storage", changed);
          resolve(event.newValue);
        });
      });
    }, `last-layer.account.${owner}.last-layer.cubes.v1`);
    await sibling.evaluate(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            cubes: [
              { id: "other-tab", name: "Other tab cube", description: "" },
            ],
            defaultId: "other-tab",
          }),
        );
      },
      { key: `last-layer.account.${owner}.last-layer.cubes.v1` },
    );
    const changed = await page.evaluate(() => window.accountStorageChange);
    expect(JSON.parse(changed).defaultId).toBe("other-tab");
    await expect(check).toHaveAttribute("title", "Updates waiting");
    await expect(description).toHaveValue("Equipment draft to preserve");
    await expect(
      page.getByRole("heading", { name: "Other tab cube", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Other tab cube", exact: true }),
    ).toBeVisible();
    await expect(check).toHaveAttribute(
      "title",
      "Guest progress is not in your account",
    );
    expect(api.row.payload.progress.selected).toEqual(["pll-T"]);
    expect(api.row.payload.cubeCollection.cubes[0].id).toBe("other-tab");
    await page.locator("#cube-editor > summary").click();
    await expect(description).toHaveValue("");
  } finally {
    await sibling.close();
  }
});

test("sign-in offers optional additive guest import, cancellation keeps both stores, and repeat transfer retains account edits", async ({
  page,
}) => {
  const cloud = cloudBackup(["pll-Ub"]);
  cloud.solves = [
    {
      id: "shared",
      elapsed: 10000,
      date: "2026-10-17T01:00:00Z",
      day: "2026-10-16",
      notes: "Account note",
      scramble: Array(10).fill("R U").join(" "),
    },
  ];
  const api = await mockSupabase(page, { revision: 2, payload: cloud });
  await seed(page, progressFixture());
  const guestSolve = { ...cloud.solves[0], notes: "Guest note", penalty: "+2" };
  await page.evaluate(
    (solve) =>
      localStorage.setItem(
        "last-layer.solves.v1",
        JSON.stringify([solve, { ...solve, id: "guest-only" }]),
      ),
    guestSolve,
  );
  await page.reload();
  const before = await page.evaluate(() => [
    localStorage.getItem("last-layer.progress.v2"),
    localStorage.getItem("last-layer.solves.v1"),
  ]);
  await signIn(page);
  const offer = page.getByRole("region", {
    name: "Guest progress transfer",
    exact: true,
  });
  await expect(offer).toBeVisible();
  await expect(offer).toContainText("2 solves");
  await expect(offer).toContainText(
    /Merge adds 0 attempts, 1 solves,\s+0 cubes, 2 selected cases/,
  );
  await expect(offer).toContainText(
    "1 differing records keep the current version",
  );
  await offer
    .getByRole("button", { name: "Keep separate", exact: true })
    .click();
  await expect(offer).toHaveCount(0);
  await sync(page);
  await expect(
    page.getByRole("dialog", { name: "Sync status", exact: true }),
  ).toContainText("Guest progress is not in your account");
  await expect(
    page.getByRole("button", { name: "Review guest progress", exact: true }),
  ).toBeVisible();
  expect(api.row.payload).toEqual(cloud);
  await page
    .getByRole("button", { name: "Close sync status", exact: true })
    .click();
  await openDataSettings(page);
  await page
    .getByRole("button", {
      name: "Bring guest progress into my account",
      exact: true,
    })
    .click();
  await expect(offer).toBeVisible();
  await offer
    .getByRole("button", { name: "Add guest progress", exact: true })
    .click();
  const transferOpener = page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("button", {
      name: "Bring guest progress into my account",
      exact: true,
    });
  await expect(transferOpener).toBeFocused();
  await expect(transferOpener).toBeInViewport({ ratio: 1 });
  await sync(page);
  expect(new Set(api.row.payload.progress.selected)).toEqual(
    new Set(["pll-Ub", "pll-T", "pll-Ua"]),
  );
  expect(api.row.payload.solves).toHaveLength(2);
  await expect(page.locator(".header-sync")).toHaveAttribute(
    "data-state",
    "synced",
  );
  expect(api.row.payload.solves.find((s) => s.id === "shared")).toEqual(
    cloud.solves[0],
  );
  const once = structuredClone(api.row.payload);
  const onceRevision = api.row.revision;
  await openDataSettings(page);
  await page
    .getByRole("button", {
      name: "Bring guest progress into my account",
      exact: true,
    })
    .click();
  await expect(
    offer.getByRole("heading", { name: "No new guest progress", exact: true }),
  ).toBeVisible();
  await expect(
    offer.getByRole("button", { name: "Add guest progress", exact: true }),
  ).toBeDisabled();
  await offer.getByRole("button", { name: "Close", exact: true }).click();
  await sync(page);
  expect(api.row.revision).toBe(onceRevision);
  expect(api.row.payload).toEqual(once);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("last-layer.progress.v2"),
      localStorage.getItem("last-layer.solves.v1"),
    ]),
  ).toEqual(before);
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 667, height: 375 },
]) {
  for (const theme of ["light", "dark"]) {
    test(`guest import and merge previews fit ${viewport.width}x${viewport.height} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport);
      await mockSupabase(page, { revision: 1, payload: cloudBackup() });
      await seed(page, progressFixture());
      await page.evaluate(
        (theme) => localStorage.setItem("last-layer-theme", theme),
        theme,
      );
      await page.reload();
      await signIn(page);
      const offer = page.getByRole("region", {
        name: "Guest progress transfer",
        exact: true,
      });
      await expect(offer).toBeVisible();
      const assertBounds = async (root) => {
        for (const node of await root.locator("p, h2, button, input").all()) {
          await node.scrollIntoViewIfNeeded();
          const box = await node.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        }
      };
      await assertBounds(offer);
      const skip = offer.getByRole("button", {
        name: "Keep separate",
        exact: true,
      });
      await skip.scrollIntoViewIfNeeded();
      await captureScreenshot(page, {
        path: testInfo.outputPath("guest-offer.png"),
        fullPage: true,
      });
      await skip.click();
      await importBackup(page, cloudBackup(["pll-T"]));
      const dialog = page.getByRole("dialog", {
        name: "Backup & transfer",
        exact: true,
      });
      const merge = dialog.getByRole("button", {
        name: "Merge with current data",
        exact: true,
      });
      await expect(merge).toBeEnabled();
      await assertBounds(dialog);
      await merge.evaluate((button) =>
        button.scrollIntoView({ block: "center" }),
      );
      await expect(merge).toBeInViewport();
      expect(
        await merge.evaluate((button) => {
          const box = button.getBoundingClientRect();
          return button.contains(
            document.elementFromPoint(
              box.x + box.width / 2,
              box.y + box.height / 2,
            ),
          );
        }),
      ).toBe(true);
      await captureScreenshot(page, {
        path: testInfo.outputPath("merge-preview.png"),
      });
      await dialog
        .getByRole("button", { name: "Close backup", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Backup and transfer training data",
          exact: true,
        }),
      ).toBeFocused();
      await importBackup(page, cloudBackup(["pll-T"]));
      await expect(merge).toBeEnabled();
      await merge.click();
      await expect(dialog).toHaveCount(0);
      const selected = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).selected,
        accountKey,
      );
      expect(new Set(selected)).toEqual(new Set(["pll-T", "pll-Ua"]));
    });
  }
}

test("guest progress already included in the account does not prompt on sign-in or reload and explicit review is a read-only no-op", async ({
  page,
}) => {
  const cloud = cloudBackup(["pll-T", "pll-Ua"]);
  const api = await mockSupabase(page, { revision: 7, payload: cloud });
  await seed(page, cloud.progress);
  const guestBefore = await page.evaluate(
    (key) => localStorage.getItem(key),
    guestKey,
  );
  await signIn(page);
  const offer = page.getByRole("region", {
    name: "Guest progress transfer",
    exact: true,
  });
  const check = page.locator(".header-sync");
  await expect(check).toHaveAttribute("data-state", "synced");
  await expect(offer).toHaveCount(0);
  await page.reload();
  await expect(check).toHaveAttribute("data-state", "synced");
  await expect(offer).toHaveCount(0);
  await openDataSettings(page);
  const opener = page.getByRole("button", {
    name: "Bring guest progress into my account",
    exact: true,
  });
  await opener.click();
  await expect(
    offer.getByRole("heading", { name: "No new guest progress", exact: true }),
  ).toBeVisible();
  await expect(
    offer.getByRole("button", { name: "Add guest progress", exact: true }),
  ).toBeDisabled();
  await offer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(opener).toBeFocused();
  expect(api.row).toEqual({ revision: 7, payload: cloud });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), guestKey),
  ).toBe(guestBefore);
});

test("guest metadata-only learning choices are offered and sync without inventing practice records", async ({
  page,
}) => {
  const api = await mockSupabase(page);
  const guest = {
    version: 2,
    selected: [],
    attempts: [],
    variants: { "pll-Y": 1 },
    activeCourse: "cfop",
    resume: { cfop: "full-pll" },
    transfers: [{ caseId: "oll-2", variant: 0, method: "full" }],
  };
  await seed(page, guest);
  await signIn(page);
  const offer = page.getByRole("region", {
    name: "Guest progress transfer",
    exact: true,
  });
  await expect(offer).toContainText(
    /Also adds 1 saved algorithm choices,\s+1 course positions,\s+1 recognition links and\s+1 current course choice/,
  );
  await offer
    .getByRole("button", { name: "Add guest progress", exact: true })
    .click();
  await expect(offer).toHaveCount(0);
  await expect.poll(() => api.row?.payload.progress).toEqual(guest);
  expect(api.row.payload.solves).toEqual([]);
});
