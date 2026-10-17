import test from "node:test";
import assert from "node:assert/strict";
import { classifyEnv, fileEnv, effectiveFileEnv, effectiveHostEnv, ENV_CHOICES, isOverride } from "../public/lib/env.js";

test("classifyEnv detects production", () => {
  assert.equal(classifyEnv("acme-prod.conf"), "prod");
  assert.equal(classifyEnv("prod-web"), "prod");
  assert.equal(classifyEnv("prd1"), "prod");
  assert.equal(classifyEnv("web.production"), "prod");
  assert.equal(classifyEnv("live-db"), "prod");
});

test("classifyEnv detects staging/test", () => {
  assert.equal(classifyEnv("staging-web"), "staging");
  assert.equal(classifyEnv("stage.conf"), "staging");
  assert.equal(classifyEnv("web-test"), "staging");
  assert.equal(classifyEnv("qa"), "staging");
  assert.equal(classifyEnv("sandbox2"), "staging");
  assert.equal(classifyEnv("dev-box"), "staging");
});

test("classifyEnv avoids false positives", () => {
  assert.equal(classifyEnv("10.0.0.5"), null);
  assert.equal(classifyEnv("latest"), null); // "latest" must not match "test"
  assert.equal(classifyEnv("product"), null); // "product" must not match "prod"
  assert.equal(classifyEnv("contest"), null);
  assert.equal(classifyEnv("database"), null);
});

test("production wins over staging", () => {
  assert.equal(classifyEnv("prod-staging"), "prod");
  assert.equal(classifyEnv("test", "production-db"), "prod");
});

test("case and camelCase are handled", () => {
  assert.equal(classifyEnv("ProdWeb"), "prod");
  assert.equal(classifyEnv("myStagingBox"), "staging");
});

test("fileEnv aggregates over its hosts", () => {
  assert.equal(fileEnv("work.conf", []), null);
  assert.equal(fileEnv("work.conf", [null]), null);
  assert.equal(fileEnv("work.conf", [null, "staging"]), "staging");
  assert.equal(fileEnv("work.conf", ["staging", "prod"]), "prod");
  assert.equal(fileEnv("acme-prod.conf", []), "prod");
  assert.equal(fileEnv("acme-prod.conf", ["staging"]), "prod");
});

test("the user's explicit file override beats the name guess", () => {
  // A file whose *name* looks prod can be forced neutral / test by hand.
  assert.equal(effectiveFileEnv("acme-prod.conf", "none", []), null);
  assert.equal(effectiveFileEnv("acme-prod.conf", "staging", []), "staging");
  assert.equal(effectiveFileEnv("acme-prod.conf", "prod", []), "prod");
  // "auto"/undefined falls back to the guess.
  assert.equal(effectiveFileEnv("acme-prod.conf", "auto", []), "prod");
  assert.equal(effectiveFileEnv("work.conf", undefined, ["staging"]), "staging");
});

test("host resolution precedence: host override > file override > guess", () => {
  // Host guess is prod, but the user forced this host to test.
  assert.equal(effectiveHostEnv("staging", "auto", "prod"), "staging");
  // No host override: an explicit file choice wins over the host guess.
  assert.equal(effectiveHostEnv("auto", "staging", "prod"), "staging");
  // A file forced to "none" neutralises even a prod-looking host.
  assert.equal(effectiveHostEnv("auto", "none", "prod"), null);
  // "none" on the host itself stops inheritance from the file too.
  assert.equal(effectiveHostEnv("none", "prod", "prod"), null);
  // Nothing forced: fall back to the host's own guess.
  assert.equal(effectiveHostEnv("auto", "auto", "prod"), "prod");
  assert.equal(effectiveHostEnv(undefined, undefined, null), null);
});

test("ENV_CHOICES and isOverride stay in sync", () => {
  assert.deepEqual(
    ENV_CHOICES.map((c) => c.value),
    ["auto", "prod", "staging", "none"]
  );
  assert.equal(isOverride("prod"), true);
  assert.equal(isOverride("auto"), false);
  assert.equal(isOverride(undefined), false);
});
