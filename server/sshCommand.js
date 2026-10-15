import { mkdirSync, writeFileSync, existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { displayCommand } from "./launcher.js";

const TEMP_DIR = path.join(tmpdir(), "super-smart-hosts");

function ensureTempDir() {
  mkdirSync(TEMP_DIR, { recursive: true });
  return TEMP_DIR;
}

// Remove generated configs older than a day so the temp dir never grows forever.
export function pruneTempConfigs(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    if (!existsSync(TEMP_DIR)) return;
    const now = Date.now();
    for (const name of readdirSync(TEMP_DIR)) {
      const full = path.join(TEMP_DIR, name);
      try {
        if (now - statSync(full).mtimeMs > maxAgeMs) unlinkSync(full);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

const VALID_KEY = /^[A-Za-z][A-Za-z0-9-]*$/;
const VALID_ALIAS = /^[^\s"'`$\\]+$/;

export function validateHost(host) {
  const h = String(host || "").trim();
  if (!h || !VALID_ALIAS.test(h) || h.startsWith("-")) {
    const err = new Error(`Invalid host alias: ${JSON.stringify(host)}`);
    err.status = 400;
    throw err;
  }
  return h;
}

export function normalizeDirectives(directives) {
  if (!Array.isArray(directives)) return [];
  const out = [];
  for (const d of directives) {
    if (!d || typeof d !== "object") continue;
    const key = String(d.key || "").trim();
    const value = String(d.value ?? "");
    if (!VALID_KEY.test(key)) {
      const err = new Error(`Invalid option name: ${JSON.stringify(d.key)}`);
      err.status = 400;
      throw err;
    }
    // An empty value would produce `Keyword` with no argument, which ssh rejects.
    if (value.trim() === "") continue;
    out.push({ key, value });
  }
  return out;
}

// Build the ssh invocation.
// - Without directives: plain `ssh <alias>`, resolved through the user's own config.
// - With directives: write a throw-away config that pins the alias to a synthetic
//   name (so it wins over any same-named block) and re-includes the user's config
//   for global settings and jump hosts. Nothing is written to config.d.
export function buildLaunch({ host, directives, mainConfigPath, systemConfigPath = "/etc/ssh/ssh_config" }) {
  const alias = validateHost(host);
  const dirs = normalizeDirectives(directives);

  if (dirs.length === 0) {
    const args = ["ssh", alias];
    return { args, command: displayCommand(args), usedOverrides: false, tempFile: null };
  }

  const synthetic = `super-smart-${crypto.randomBytes(4).toString("hex")}`;
  const lines = [`Host ${synthetic}`];
  for (const d of dirs) lines.push(`    ${d.key} ${d.value}`.trimEnd());

  const includes = [];
  if (mainConfigPath && existsSync(mainConfigPath)) includes.push(mainConfigPath);
  if (existsSync(systemConfigPath)) includes.push(systemConfigPath);
  if (includes.length) {
    lines.push("");
    for (const inc of includes) lines.push(`Include ${inc}`);
  }

  const dir = ensureTempDir();
  const file = path.join(dir, `${synthetic}.conf`);
  writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });

  const args = ["ssh", "-F", file, synthetic];
  return {
    args,
    command: displayCommand(args),
    friendly: `ssh ${alias}${dirs.map((d) => ` -o "${d.key} ${d.value}"`).join("")}`,
    usedOverrides: true,
    tempFile: file,
    alias,
  };
}
