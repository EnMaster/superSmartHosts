import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export const CONFIG_BACKUP_DIR =
  process.env.SMH_CONFIG_BACKUP_DIR || path.join(os.homedir(), ".super-smart-hosts", "config-backups");

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const DIR_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function statusErr(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function listConfigNames(configDir) {
  try {
    const entries = await fs.readdir(configDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && NAME_RE.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function newBundleDir(prefix) {
  await fs.mkdir(CONFIG_BACKUP_DIR, { recursive: true, mode: 0o700 });
  const dir = path.join(CONFIG_BACKUP_DIR, `${prefix}-${stamp()}-${crypto.randomBytes(2).toString("hex")}`);
  await fs.mkdir(dir, { recursive: false, mode: 0o700 });
  return dir;
}

// Snapshot every config file into a fresh timestamped folder.
export async function backupAll(configDir) {
  const names = await listConfigNames(configDir);
  if (names.length === 0) throw statusErr("No config files to back up", 400);
  const dir = await newBundleDir("all");
  for (const name of names) {
    await fs.copyFile(path.join(configDir, name), path.join(dir, name));
  }
  return { dir, files: names };
}

// Snapshot a single config file.
export async function backupOne(configDir, name) {
  const clean = String(name || "").trim();
  if (!NAME_RE.test(clean) || clean.includes("..")) throw statusErr("Invalid file name", 400);
  const full = path.resolve(configDir, clean);
  if (path.dirname(full) !== path.resolve(configDir)) throw statusErr("Invalid file name", 400);
  try {
    await fs.access(full);
  } catch {
    throw statusErr("Config file not found", 404);
  }
  const dir = await newBundleDir("one");
  await fs.copyFile(full, path.join(dir, clean));
  return { dir, files: [clean] };
}

export async function listBackups() {
  let entries;
  try {
    entries = await fs.readdir(CONFIG_BACKUP_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory() || !DIR_RE.test(e.name)) continue;
    const full = path.join(CONFIG_BACKUP_DIR, e.name);
    const files = (await fs.readdir(full)).filter((n) => NAME_RE.test(n)).sort();
    const stat = await fs.stat(full);
    let size = 0;
    for (const f of files) {
      try {
        size += (await fs.stat(path.join(full, f))).size;
      } catch {
        /* ignore */
      }
    }
    out.push({ name: e.name, files, size, mtime: stat.mtimeMs });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Copy a bundle's files back over the live config dir (overwrites in place).
export async function restoreBackup(configDir, name) {
  const clean = String(name || "");
  if (!DIR_RE.test(clean) || clean.includes("..")) throw statusErr("Invalid backup name", 400);
  const full = path.join(CONFIG_BACKUP_DIR, clean);
  if (path.dirname(full) !== path.resolve(CONFIG_BACKUP_DIR)) throw statusErr("Invalid backup name", 400);
  let entries;
  try {
    entries = await fs.readdir(full, { withFileTypes: true });
  } catch {
    throw statusErr("Backup not found", 404);
  }
  const files = entries.filter((e) => e.isFile() && NAME_RE.test(e.name));
  if (files.length === 0) throw statusErr("Backup is empty", 400);
  await fs.mkdir(configDir, { recursive: true });
  const restored = [];
  for (const f of files) {
    await fs.copyFile(path.join(full, f.name), path.join(configDir, f.name));
    restored.push(f.name);
  }
  return { restored };
}
