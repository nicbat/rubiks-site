import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { render } from "svelte/server";
import {
  profilePicture,
  profilePictures,
  DEFAULT_AVATAR_ID,
} from "../src/pfps.js";
import {
  profileDetails,
  profileRemote,
  profileHasDraft,
  visitorProfile,
} from "../src/profiles.js";
import ProfilePicture from "../src/components/ProfilePicture.svelte";

test("catalog has unique stable IDs, local assets and a permanent default", async () => {
  assert.equal(
    new Set(profilePictures.map((p) => p.id)).size,
    profilePictures.length,
  );
  for (const picture of profilePictures) {
    assert.match(picture.id, /^[a-z][a-z0-9_-]{0,63}$/);
    assert.match(picture.file, /^[a-z0-9_-]+\.svg$/);
    assert.ok(
      await readFile(
        new URL(`../public/pfps/${picture.file}`, import.meta.url),
      ),
    );
    assert.equal(profilePicture(picture.id).id, picture.id);
  }
  for (const id of [
    undefined,
    null,
    "deleted-picture",
    "https://untrusted.test/a",
    "../../a",
  ])
    assert.equal(profilePicture(id).id, DEFAULT_AVATAR_ID);
});

test("missing and retired pictures render the default without mutating the stored ID", () => {
  const profile = { username: "learner", avatar_id: "retired-cube" };
  assert.equal(profileDetails({}).avatar_id, DEFAULT_AVATAR_ID);
  assert.equal(profileDetails(profile).avatar_id, "retired-cube");
  assert.equal(visitorProfile(profile).avatar_id, "retired-cube");
  assert.equal(
    profileHasDraft({ profile, profileDraft: profileDetails(profile) }),
    false,
  );
  const html = render(ProfilePicture, {
    props: { id: profile.avatar_id },
  }).body;
  assert.match(html, /src="\/pfps\/cube.svg"/);
  assert.doesNotMatch(html, /retired-cube/);
  assert.equal(profile.avatar_id, "retired-cube");
  for (const avatar_id of [
    123,
    {},
    "",
    "../cube",
    "https://external.test/a",
    "a".repeat(65),
  ])
    assert.throws(() => profileDetails({ avatar_id }));
});

test("picture changes save one string and return from owner and visitor lookups", async () => {
  let saved = "cube";
  const api = profileRemote(
    {
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: "owner" }, access_token: "token" } },
        }),
      },
    },
    "owner",
    { url: "https://example.supabase.co", key: "test" },
    async (url, options) => {
      if (options.method === "PATCH") {
        const body = JSON.parse(options.body);
        assert.equal(body.avatar_id, "ocean");
        assert.deepEqual(Object.keys(body).sort(), [
          "avatar_id",
          "bio",
          "display_name",
          "learning_goal",
        ]);
        saved = body.avatar_id;
      }
      const value = { username: "learner", is_public: false, avatar_id: saved };
      return Response.json(
        url.includes("rpc/") ? { ...value, stats: null } : [value],
      );
    },
  );
  assert.equal((await api.save({ avatar_id: "ocean" })).avatar_id, "ocean");
  assert.equal((await api.own()).avatar_id, "ocean");
  assert.equal((await api.find("learner")).avatar_id, "ocean");
});
