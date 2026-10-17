import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = await fs.mkdtemp(path.join(os.tmpdir(), "smh-confbackup-"));
const configDir = path.join(dir, "config.d");
const backupDir = path.join(dir, "backups");
await fs.mkdir(configDir, { recursive: true });
await fs.writeFile(path.join(configDir, "work.conf"), "Host work\n  HostName work.example\n");
await fs.writeFile(path.join(configDir, "home.config"), "Host home\n  HostName home.example\n");
await fs.writeFile(path.join(configDir, "extra"), "extensionless\n");
await fs.writeFile(path.join(configDir, ".hidden"), "dotfile\n");
await fs.mkdir(path.join(configDir, "subdir"));

process.env.SMH_CONFIG_BACKUP_DIR = backupDir;

const { backupAll, backupOne, listBackups, restoreBackup, CONFIG_BACKUP_DIR } = await import(
  "../server/configBackup.js"
);

test("backup dir honours the env override", () => {
  assert.equal(CONFIG_BACKUP_DIR, backupDir);
});

test("backupAll snapshots every config file (skipping dotfiles and dirs)", async () => {
  const res = await backupAll(configDir);
  assert.deepEqual(res.files, ["extra", "home.config", "work.conf"]);
  const onDisk = await fs.readdir(res.dir);
  assert.deepEqual(onDisk.sort(), ["extra", "home.config", "work.conf"]);
});

test("backupAll rejects when there is nothing to back up", async () => {
  const empty = path.join(dir, "empty");
  await fs.mkdir(empty, { recursive: true });
  await assert.rejects(() => backupAll(empty), /No config files/);
});

test("backupOne snapshots a single file", async () => {
  const res = await backupOne(configDir, "work.conf");
  assert.deepEqual(res.files, ["work.conf"]);
  const onDisk = await fs.readdir(res.dir);
  assert.deepEqual(onDisk, ["work.conf"]);
});

test("backupOne rejects missing files and path traversal", async () => {
  await assert.rejects(() => backupOne(configDir, "missing.conf"), /not found/);
  await assert.rejects(() => backupOne(configDir, "../work.conf"), /Invalid file name/);
});

test("listBackups reports bundles newest-first", async () => {
  const backups = await listBackups();
  assert.ok(backups.length >= 2);
  for (let i = 1; i < backups.length; i++) {
    assert.ok(backups[i - 1].mtime >= backups[i].mtime);
  }
  const files = backups.flatMap((b) => b.files);
  assert.ok(files.includes("work.conf"));
});

test("restoreBackup overwrites the live file", async () => {
  await fs.writeFile(path.join(configDir, "work.conf"), "Host changed\n");
  const target = (await listBackups()).find((b) => b.files.includes("work.conf"));
  const res = await restoreBackup(configDir, target.name);
  assert.ok(res.restored.includes("work.conf"));
  const restored = await fs.readFile(path.join(configDir, "work.conf"), "utf8");
  assert.match(restored, /Host work/);
});

test("restoreBackup rejects path traversal", async () => {
  await assert.rejects(() => restoreBackup(configDir, "../config.d"), /Invalid backup/);
});

test.after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
