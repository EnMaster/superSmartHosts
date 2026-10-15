import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { shellQuote } from "./launcher.js";

const execFileAsync = promisify(execFile);

export const HOSTS_PATH = process.env.SMH_HOSTS ? path.resolve(process.env.SMH_HOSTS) : "/etc/hosts";
const BACKUP_DIR =
  process.env.SMH_BACKUP_DIR || path.join(os.homedir(), ".super-smart-hosts", "backups");
const MAX_BYTES = 512 * 1024;
const BACKUP_RE = /^hosts-[A-Za-z0-9._-]+\.bak$/;

function statusErr(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// The real system file needs root. An overridden path (tests/dev) is written
// directly so the flow can be exercised without a password prompt.
function needsPrivilege() {
  if (process.env.SMH_HOSTS_PRIVILEGED === "1") return true;
  if (process.env.SMH_HOSTS_PRIVILEGED === "0") return false;
  return path.resolve(HOSTS_PATH) === path.resolve("/etc/hosts");
}

export async function readHosts() {
  let text = "";
  let exists = true;
  try {
    text = await fs.readFile(HOSTS_PATH, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      exists = false;
    } else {
      throw err;
    }
  }
  return {
    path: HOSTS_PATH,
    text,
    exists,
    privileged: needsPrivilege(),
    backupDir: BACKUP_DIR,
  };
}

function validate(text) {
  if (typeof text !== "string") throw statusErr("Hosts file contents must be sent as `text`", 400);
  if (text.includes("\0")) throw statusErr("Content contains a NUL byte", 400);
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw statusErr("File too large (max 512 KB)", 400);
  const body = text.trim() === "" ? "" : text;
  if (body === "") throw statusErr("Refusing to save an empty hosts file", 400);
  return body.endsWith("\n") ? body : `${body}\n`;
}

async function writeBackup(text) {
  await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `hosts-${stamp}-${crypto.randomBytes(2).toString("hex")}.bak`;
  await fs.writeFile(path.join(BACKUP_DIR, name), text, { mode: 0o600 });
  return name;
}

async function writeDirect(text) {
  const tmp = `${HOSTS_PATH}.tmp-${process.pid}`;
  await fs.writeFile(tmp, text, { mode: 0o644 });
  await fs.rename(tmp, HOSTS_PATH);
}

async function writeWithPrivilege(text) {
  const stage = path.join(os.tmpdir(), `smh-hosts-${crypto.randomBytes(6).toString("hex")}`);
  await fs.writeFile(stage, text, { mode: 0o600 });
  const owner = process.platform === "darwin" ? "-o root -g wheel" : "-o root -g root";
  const cmd = `install -m 644 ${owner} ${shellQuote(stage)} ${shellQuote(HOSTS_PATH)}`;
  try {
    if (process.platform === "darwin") {
      const script = `do shell script "${cmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" with administrator privileges`;
      try {
        await execFileAsync("osascript", ["-e", script], { timeout: 120000 });
      } catch (err) {
        const detail = String(err.stderr || err.message || "");
        if (/cancel/i.test(detail)) throw statusErr("Authorization was cancelled", 403);
        throw statusErr(`Could not write with administrator privileges: ${detail.trim()}`, 500);
      }
    } else {
      try {
        await execFileAsync("sudo", ["-n", "sh", "-c", cmd], { timeout: 30000 });
      } catch (err) {
        const detail = String(err.stderr || err.message || "");
        throw statusErr(
          `Could not write ${HOSTS_PATH}. Configure passwordless sudo or run the server as root. ${detail.trim()}`,
          500
        );
      }
    }
  } finally {
    await fs.rm(stage, { force: true });
  }
}

export async function writeHosts(text) {
  const clean = validate(text);
  let backup = null;
  try {
    const current = await fs.readFile(HOSTS_PATH, "utf8");
    if (current.trim() !== "") backup = await writeBackup(current);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  if (needsPrivilege()) await writeWithPrivilege(clean);
  else await writeDirect(clean);
  return { ok: true, path: HOSTS_PATH, backup };
}

export async function listBackups() {
  try {
    const names = (await fs.readdir(BACKUP_DIR)).filter((n) => BACKUP_RE.test(n));
    const out = [];
    for (const name of names) {
      const stat = await fs.stat(path.join(BACKUP_DIR, name));
      out.push({ name, size: stat.size, mtime: stat.mtimeMs });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function restoreBackup(name) {
  const clean = String(name || "");
  if (!BACKUP_RE.test(clean)) throw statusErr("Invalid backup name", 400);
  const full = path.join(BACKUP_DIR, clean);
  if (path.dirname(full) !== path.resolve(BACKUP_DIR)) throw statusErr("Invalid backup name", 400);
  const text = await fs.readFile(full, "utf8");
  return writeHosts(text);
}
