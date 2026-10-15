import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "smh-hosts-"));
const hostsPath = path.join(dir, "hosts");
const backupDir = path.join(dir, "backups");
await fs.writeFile(hostsPath, "127.0.0.1 localhost\n");

process.env.SMH_HOSTS = hostsPath;
process.env.SMH_HOSTS_PRIVILEGED = "0";
process.env.SMH_BACKUP_DIR = backupDir;

const { readHosts, writeHosts, listBackups, restoreBackup } = await import("../server/hostsFile.js");

test("readHosts returns the file contents", async () => {
  const data = await readHosts();
  assert.equal(data.path, hostsPath);
  assert.match(data.text, /127\.0\.0\.1 localhost/);
  assert.equal(data.privileged, false);
});

test("writeHosts refuses empty content", async () => {
  await assert.rejects(() => writeHosts("   \n"), /empty hosts file/);
});

test("writeHosts refuses NUL bytes", async () => {
  await assert.rejects(() => writeHosts("127.0.0.1 localhost\u0000\n"), /NUL/);
});

test("writeHosts backs up the previous content and writes the new file", async () => {
  const result = await writeHosts("127.0.0.1 localhost\n10.0.0.5 api.local");
  assert.match(result.backup, /^hosts-.*\.bak$/);
  const onDisk = await fs.readFile(hostsPath, "utf8");
  assert.equal(onDisk, "127.0.0.1 localhost\n10.0.0.5 api.local\n");
  const backups = await listBackups();
  assert.ok(backups.length >= 1);
});

test("restoreBackup brings back an earlier version", async () => {
  const before = await fs.readFile(hostsPath, "utf8");
  await writeHosts("127.0.0.1 localhost\n");
  const [latest] = await listBackups();
  await restoreBackup(latest.name);
  const onDisk = await fs.readFile(hostsPath, "utf8");
  assert.equal(onDisk, before);
});

test("restoreBackup rejects path traversal", async () => {
  await assert.rejects(() => restoreBackup("../hosts"), /Invalid backup/);
});

test.after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
