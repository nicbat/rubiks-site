import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import AccountIdentity from "../src/components/AccountIdentity.svelte";
import {
  accountSetupStage,
  setupDestination,
  setupIntent,
  emailCode,
  signInFailure,
} from "../src/account-setup.js";

test("setup requires verified identity and a username, then transfer before optional onboarding", () => {
  const optional = [{ id: "learning-goal", completed: false }];
  const account = {};
  assert.equal(accountSetupStage(account, optional), "email");
  account.codeSent = true;
  assert.equal(accountSetupStage(account, optional), "verify");
  account.email = "learner@example.test";
  account.profileLoading = true;
  assert.equal(accountSetupStage(account, optional), "loading");
  account.profileLoading = false;
  account.profileError = true;
  assert.equal(accountSetupStage(account, optional), "error");
  account.profileError = false;
  assert.equal(accountSetupStage(account, optional), "username");
  account.profile = { username: "learner" };
  account.guestImportPreview = { attempts: 2 };
  assert.equal(accountSetupStage(account, optional), "comparing");
  account.guestImportPending = true;
  assert.equal(accountSetupStage(account, optional), "transfer");
  account.guestImportPending = false;
  account.guestImportDismissed = true;
  assert.equal(accountSetupStage(account, optional), "learning-goal");
  // No optional onboarding is registered yet. Sync eligibility stays profile-based.
  assert.equal(accountSetupStage(account), "ready");
  assert.equal(
    accountSetupStage(account, [{ ...optional[0], completed: true }]),
    "ready",
  );
  account.reauth = true;
  assert.equal(accountSetupStage(account, optional), "verify");
});

test("setup continuation only retains canonical local learning destinations", () => {
  for (const path of [
    "/timer",
    "/progress",
    "/courses",
    "/cfop/pll/two-look",
    "/guides/f2l",
    "/courses/beginner/beginner-introduction",
  ])
    assert.equal(setupDestination(path), path);
  assert.equal(
    setupDestination("/timer?access_token=secret&settings"),
    "/timer",
  );
  for (const path of [
    undefined,
    "https://example.com",
    "//example.com/timer",
    "/account",
    "/u/learner",
    "/practice",
    "javascript:alert(1)",
  ])
    assert.equal(setupDestination(path), "/dashboard");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  assert.equal(setupIntent(storage), null);
  assert.equal(setupIntent(storage, "/timer?settings"), "/timer");
  assert.equal(setupIntent(storage), "/timer");
  setupIntent(storage, null);
  assert.equal(setupIntent(storage), null);
  const broken = new Proxy(
    {},
    {
      get() {
        throw Error("Storage unavailable");
      },
    },
  );
  assert.equal(setupIntent(broken, "/progress"), "/progress");
  assert.equal(setupIntent(broken), null);
  assert.equal(setupIntent(broken, null), null);
});

test("email codes allow full-code paste without accepting nonnumeric or incomplete input", () => {
  assert.equal(emailCode(" 123 456 "), "123456");
  assert.equal(emailCode("1234-5678"), "12345678");
  assert.equal(emailCode("1234567890"), "1234567890");
  for (const code of ["", "12345", "12345678901", "123abc", "<script>", null])
    assert.throws(() => emailCode(code), /code from your email/);
  assert.match(signInFailure({ status: 429 }, false), /Wait a minute/);
  assert.match(
    signInFailure({ code: "over_email_send_rate_limit" }, false),
    /Wait a minute/,
  );
  assert.match(signInFailure({ code: "otp_expired" }, true), /expired/);
  assert.match(signInFailure({}, false), /email could not be sent/);
});

test("username errors are associated with the field, preserve drafts, and don't depend on browser pattern validation", () => {
  const html = render(AccountIdentity, {
    props: {
      account: {
        configured: true,
        email: "learner@example.test",
        usernameDraft: " New_Learner ",
        usernameError: "That username is already taken. Choose another name.",
      },
    },
  }).body;
  assert.match(html, /value=" New_Learner "/);
  assert.match(html, /@new_learner/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(
    html,
    /aria-describedby="username-error username-help username-policy"/,
  );
  assert.match(html, /id="username-error"[^>]*role="alert"/);
  assert.match(html, /novalidate/);
  assert.doesNotMatch(html, /pattern=|maxlength=/);
  assert.match(html, /Cannot be changed/);
});

test("code verification shows the recipient with one editable field and retains accessible recovery", () => {
  const html = render(AccountIdentity, {
    props: {
      account: {
        configured: true,
        signInEmail: "learner@example.test",
        codeSent: true,
        codeDraft: "123 456",
        signInError: "That code has expired.",
      },
    },
  }).body;
  assert.doesNotMatch(html, /id="account-email"/);
  assert.match(html, /learner@example.test/);
  assert.match(html, /value="123 456"/);
  assert.match(html, /autocomplete="one-time-code"/);
  assert.match(html, /aria-describedby="signin-error code-help"/);
  assert.match(html, /data-action="account-reset"/);
  assert.match(html, /data-action="account-resend"/);
  assert.equal([...html.matchAll(/<input[\s>]/g)].length, 1);
});
