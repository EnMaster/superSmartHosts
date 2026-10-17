import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

// The module reads SMH_ENV_DIR at import time, so point it at a temp dir first.
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "smh-env-"));
process.env.SMH_ENV_DIR = tmp;

const { readEnvironments, setFileEnvironment, setHostEnvironment, renameFileEnvironment, ENVIRONMENTS_FILE } = await import(
  "../server/environments.js"
);

test.after(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test("starts empty when no file exists", async () => {
  assert.deepEqual(await readEnvironments(), { files: {}, hosts: {} });
});

test("sets and clears a file environment", async () => {
  await setFileEnvironment("work.conf", "prod");
  assert.deepEqual((await readEnvironments()).files, { "work.conf": "prod" });
  await setFileEnvironment("work.conf", "auto");
  assert.deepEqual((await readEnvironments()).files, {});
});

test("sets and clears a host environment under its file", async () => {
  await setHostEnvironment("work.conf", "db1", "staging");
  assert.deepEqual((await readEnvironments()).hosts, { "work.conf": { db1: "staging" } });
  await setHostEnvironment("work.conf", "db1", "auto");
  assert.deepEqual((await readEnvironments()).hosts, {});
});

test("rejects unknown values without writing", async () => {
  await setFileEnvironment("work.conf", "bogus");
  await setHostEnvironment("work.conf", "db1", "bogus");
  assert.deepEqual(await readEnvironments(), { files: {}, hosts: {} });
});

test("persists to disk as JSON and tolerates corruption", async () => {
  await setFileEnvironment("work.conf", "none");
  const onDisk = JSON.parse(await fs.readFile(ENVIRONMENTS_FILE, "utf8"));
  assert.deepEqual(onDisk.files, { "work.conf": "none" });

  await fs.writeFile(ENVIRONMENTS_FILE, "{ not json", "utf8");
  assert.deepEqual(await readEnvironments(), { files: {}, hosts: {} });
});

test("rename moves file and host tags to the new name", async () => {
  await setFileEnvironment("work.conf", "prod");
  await setHostEnvironment("work.conf", "db1", "staging");
  await renameFileEnvironment("work.conf", "prod.conf");
  const data = await readEnvironments();
  assert.deepEqual(data.files, { "prod.conf": "prod" });
  assert.deepEqual(data.hosts, { "prod.conf": { db1: "staging" } });
  assert.equal(data.files["work.conf"], undefined);
});
