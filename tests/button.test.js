import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "svelte/server";
import Button, {
  buttonVariants,
} from "../src/lib/components/ui/button/button.svelte";

test("shared buttons retain semantic variants, caller overrides and native disabled behavior", () => {
  const { body } = render(Button, {
    props: {
      variant: "destructive",
      size: "icon",
      class: "mt-2 mt-4",
      disabled: true,
      "aria-label": "Delete cube",
    },
  });
  assert.match(
    body,
    /<button[^>]*class="secondary cube-delete icon-button mt-4"/,
  );
  assert.match(body, /aria-label="Delete cube"/);
  assert.match(body, /\sdisabled=""/);
  assert.match(body, /type="button"/);
  assert.equal(buttonVariants(), "");
});

test("shared link buttons retain navigation and remove disabled links from keyboard activation", () => {
  const enabled = render(Button, {
    props: { href: "#/account/profile", variant: "secondary" },
  }).body;
  assert.match(
    enabled,
    /<a[^>]*class="secondary"[^>]*href="#\/account\/profile"/,
  );
  const disabled = render(Button, {
    props: { href: "#/account/profile", variant: "secondary", disabled: true },
  }).body;
  assert.doesNotMatch(disabled, /href=/);
  assert.match(disabled, /aria-disabled="true"/);
  assert.match(disabled, /role="link"/);
  assert.match(disabled, /tabindex="-1"/);
});
