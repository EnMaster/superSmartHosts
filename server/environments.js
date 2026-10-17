import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

// Manual "production / test / none" tags the user sets from the UI. They live in
// a single JSON file so the .conf files themselves are never touched:
//
//   {
//     "files": { "work.conf": "prod" | "staging" | "none" },
//     "hosts": { "work.conf": { "<host patterns>": "prod" | "staging" | "none" } }
//   }
//
// A missing entry means "automatic" (guess from names).

const ENV_DIR = process.env.SMH_ENV_DIR || path.join(os.homedir(), ".super-smart-hosts");
const ENV_FILE = path.join(ENV_DIR, "environments.json");
const VALID = new Set(["prod", "staging", "none"]);

function sanitizeFiles(files) {
  const out = {};
  if (files && typeof files === "object" && !Array.isArray(files)) {
    for (const [name, value] of Object.entries(files)) {
      if (VALID.has(value)) out[name] = value;
    }
  }
  return out;
}

function sanitizeHosts(hosts) {
  const out = {};
  if (hosts && typeof hosts === "object" && !Array.isArray(hosts)) {
    for (const [file, map] of Object.entries(hosts)) {
      if (!map || typeof map !== "object" || Array.isArray(map)) continue;
      const clean = {};
      for (const [host, value] of Object.entries(map)) {
        if (VALID.has(value)) clean[host] = value;
      }
      if (Object.keys(clean).length) out[file] = clean;
    }
  }
  return out;
}

async function readAll() {
  try {
    const raw = await fs.readFile(ENV_FILE, "utf8");
    const data = JSON.parse(raw);
    return { files: sanitizeFiles(data?.files), hosts: sanitizeHosts(data?.hosts) };
  } catch (err) {
    if (err.code === "ENOENT" || err instanceof SyntaxError) return { files: {}, hosts: {} };
    throw err;
  }
}

async function writeAll(data) {
  await fs.mkdir(ENV_DIR, { recursive: true });
  const tmp = `${ENV_FILE}.tmp-${process.pid}`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, ENV_FILE);
}

// Returns { files: {...}, hosts: {...} }. Never throws on a missing/corrupt file.
export async function readEnvironments() {
  return readAll();
}

// `env` is "prod" | "staging" | "none" to set, or "auto"/null to clear.
export async function setFileEnvironment(name, env) {
  const data = await readAll();
  if (env == null || env === "auto") delete data.files[name];
  else if (VALID.has(env)) data.files[name] = env;
  else return readAll();
  await writeAll(data);
  return data;
}

export async function setHostEnvironment(name, hostKey, env) {
  const data = await readAll();
  const map = data.hosts[name] || {};
  if (env == null || env === "auto") delete map[hostKey];
  else if (VALID.has(env)) map[hostKey] = env;
  else return readAll();
  if (Object.keys(map).length) data.hosts[name] = map;
  else delete data.hosts[name];
  await writeAll(data);
  return data;
}

export const ENVIRONMENTS_FILE = ENV_FILE;
export const ENVIRONMENTS_DIR = ENV_DIR;

// Keep the manual tags attached to a file after it is renamed.
export async function renameFileEnvironment(oldName, newName) {
  if (oldName === newName) return readAll();
  const data = await readAll();
  let changed = false;
  if (data.files[oldName] !== undefined) {
    data.files[newName] = data.files[oldName];
    delete data.files[oldName];
    changed = true;
  }
  if (data.hosts[oldName] !== undefined) {
    data.hosts[newName] = data.hosts[oldName];
    delete data.hosts[oldName];
    changed = true;
  }
  if (changed) await writeAll(data);
  return data;
}
