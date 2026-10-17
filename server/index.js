import express from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { parse, serialize, hostAliases, makeHostBlock, newBlockId } from "./sshConfig.js";
import { GROUPS, OPTIONS } from "./options.js";
import { buildLaunch, pruneTempConfigs } from "./sshCommand.js";
import { launchTerminal, detectTerminal, sshEffectiveConfig } from "./launcher.js";
import { readHosts, writeHosts, listBackups, restoreBackup, HOSTS_PATH } from "./hostsFile.js";
import { backupAll, backupOne, listBackups as listConfigBackups, restoreBackup as restoreConfigBackup, CONFIG_BACKUP_DIR } from "./configBackup.js";
import { classifyEnv, effectiveFileEnv, effectiveHostEnv } from "../public/lib/env.js";
import { readEnvironments, setFileEnvironment, setHostEnvironment, renameFileEnvironment, ENVIRONMENTS_FILE } from "./environments.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const CONFIG_DIR = process.env.SMH_DIR
  ? path.resolve(process.env.SMH_DIR)
  : path.join(os.homedir(), ".ssh", "config.d");
const MAIN_CONFIG = process.env.SMH_MAIN || path.join(os.homedir(), ".ssh", "config");
const PORT = Number(process.env.PORT || 4317);
const BIND = process.env.HOST || "127.0.0.1";
const TERMINAL = process.env.SMH_TERMINAL || "auto";
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

pruneTempConfigs();

const app = express();
app.use(express.json({ limit: "2mb" }));

// Mutating a local file or opening a terminal must not be triggerable by a
// random page open in the browser, so reject cross-origin state changes.
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (origin && origin !== "null") {
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return res.status(403).json({ error: "Bad request origin" });
    }
    if (host !== req.headers.host) return res.status(403).json({ error: "Cross-origin request blocked" });
  }
  next();
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

function resolveFile(name) {
  const clean = String(name || "").trim();
  if (!FILE_RE.test(clean) || clean.includes("..")) {
    const err = new Error(
      "Invalid file name. Use letters, digits, dot, dash or underscore (e.g. `work.conf`, `base.config` or `base`)."
    );
    err.status = 400;
    throw err;
  }
  const full = path.resolve(CONFIG_DIR, clean);
  if (path.dirname(full) !== path.resolve(CONFIG_DIR)) {
    const err = new Error("Invalid file name");
    err.status = 400;
    throw err;
  }
  return { name: clean, full };
}

// Every regular file ssh would pick up through `Include .../config.d/*`
// (any name, any extension — hidden files excluded, matching glob semantics).
async function listConfigFiles() {
  await ensureConfigDir();
  const entries = await fs.readdir(CONFIG_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

// Compact, searchable summary of the Host blocks in a parsed file.
function hostIndex(model) {
  const hosts = [];
  for (const block of model?.blocks ?? []) {
    if (block.type !== "host") continue;
    const dirs = block.items.filter((it) => it.kind === "directive");
    const get = (key) => {
      const d = dirs.find((x) => x.key.toLowerCase() === key);
      return d ? d.value : "";
    };
    const patterns = block.patterns || "";
    const alias = patterns.split(/\s+/).filter(Boolean)[0] || "";
    const hostname = get("hostname");
    hosts.push({
      id: block.id,
      alias,
      patterns,
      hostname,
      user: get("user"),
      port: get("port"),
      env: classifyEnv(alias, hostname, patterns),
      directives: dirs.map((d) => ({ key: d.key, value: d.value })),
    });
  }
  return hosts;
}

async function mainConfigIncludesConfigDir() {
  try {
    const text = await fs.readFile(MAIN_CONFIG, "utf8");
    const home = os.homedir();
    const bases = [CONFIG_DIR, path.join(home, ".ssh", "config.d")].map((b) => path.resolve(b));
    const inBase = (p) => bases.some((base) => p === base || p.startsWith(base + path.sep));
    return text.split(/\r?\n/).some((line) => {
      const m = line.match(/^\s*Include\s+(.+?)\s*$/i);
      if (!m) return false;
      const token = m[1].replace(/^~(?=\/|$)/, home);
      // ssh resolves relative Include paths against ~/.ssh (and the config's own dir).
      const candidates = path.isAbsolute(token)
        ? [token]
        : [path.resolve(path.join(home, ".ssh"), token), path.resolve(path.dirname(MAIN_CONFIG), token)];
      return candidates.some(inBase);
    });
  } catch {
    return false;
  }
}

// ---- Static assets ---------------------------------------------------------

app.use(express.static(PUBLIC_DIR, { index: "index.html" }));
app.get(
  "/vendor/preact.mjs",
  asyncHandler(async (_req, res) => {
    const file = path.join(__dirname, "..", "node_modules", "htm", "preact", "standalone.module.js");
    res.type("application/javascript").send(await fs.readFile(file, "utf8"));
  })
);

// ---- API -------------------------------------------------------------------

app.get(
  "/api/config",
  asyncHandler(async (_req, res) => {
    await ensureConfigDir();
    res.json({
      configDir: CONFIG_DIR,
      mainConfig: MAIN_CONFIG,
      includesConfigDir: await mainConfigIncludesConfigDir(),
      terminal: detectTerminal(TERMINAL),
      platform: process.platform,
      hostsFile: HOSTS_PATH,
      environmentsFile: ENVIRONMENTS_FILE,
    });
  })
);

app.get("/api/options", (_req, res) => {
  res.json({ groups: GROUPS, options: OPTIONS });
});

app.post("/api/parse", (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text : "";
  res.json({ model: parse(text) });
});

app.post("/api/serialize", (req, res) => {
  const model = req.body?.model;
  if (!model || !Array.isArray(model.blocks)) {
    const err = new Error("Provide a `model` with a `blocks` array");
    err.status = 400;
    return res.status(400).json({ error: err.message });
  }
  res.json({ text: serialize(model) });
});

app.get(
  "/api/files",
  asyncHandler(async (_req, res) => {
    const names = await listConfigFiles();
    const envs = await readEnvironments();
    const files = [];
    for (const name of names) {
      const full = path.join(CONFIG_DIR, name);
      const stat = await fs.stat(full);
      let aliases = [];
      let hosts = [];
      let error = null;
      const fileOverride = envs.files[name];
      const hostOverrides = envs.hosts[name] || {};
      try {
        const model = parse(await fs.readFile(full, "utf8"));
        aliases = hostAliases(model);
        hosts = hostIndex(model);
        for (const h of hosts) {
          const override = hostOverrides[h.patterns || h.id];
          h.envOverride = override || "auto";
          h.env = effectiveHostEnv(override, fileOverride, h.env);
        }
      } catch (err) {
        error = err.message;
      }
      const env = effectiveFileEnv(name, fileOverride, hosts.map((h) => h.env));
      files.push({
        name,
        size: stat.size,
        mtime: stat.mtimeMs,
        aliases,
        hostCount: aliases.length,
        env,
        envOverride: fileOverride || "auto",
        hosts,
        error,
      });
    }
    res.json({ configDir: CONFIG_DIR, files });
  })
);

app.get(
  "/api/files/:name",
  asyncHandler(async (req, res) => {
    const { name, full } = resolveFile(req.params.name);
    const text = await fs.readFile(full, "utf8");
    res.json({ name, text, model: parse(text) });
  })
);

app.post(
  "/api/files",
  asyncHandler(async (req, res) => {
    const { name, full } = resolveFile(req.body?.name);
    await ensureConfigDir();
    try {
      await fs.access(full);
      const err = new Error(`${name} already exists`);
      err.status = 409;
      throw err;
    } catch (e) {
      if (e.status) throw e;
    }
    const model = { blocks: [{ id: newBlockId(), type: "global", header: "", patterns: "", items: [] }, makeHostBlock("my-host")] };
    const text = req.body?.sample === false ? "" : serialize(model);
    await fs.writeFile(full, text, { mode: 0o600 });
    res.status(201).json({ name, text, model: parse(text) });
  })
);

app.put(
  "/api/files/:name",
  asyncHandler(async (req, res) => {
    const { name, full } = resolveFile(req.params.name);
    let text;
    if (typeof req.body?.text === "string") {
      text = req.body.text;
    } else if (req.body?.model) {
      text = serialize(req.body.model);
    } else {
      const err = new Error("Provide either `text` or `model`");
      err.status = 400;
      throw err;
    }
    const tmp = `${full}.tmp-${process.pid}`;
    await fs.writeFile(tmp, text, { mode: 0o600 });
    await fs.rename(tmp, full);
    res.json({ name, text, model: parse(text) });
  })
);

app.delete(
  "/api/files/:name",
  asyncHandler(async (req, res) => {
    const { name, full } = resolveFile(req.params.name);
    await fs.rm(full);
    res.json({ ok: true, name });
  })
);

app.post(
  "/api/files/:name/rename",
  asyncHandler(async (req, res) => {
    const { name, full } = resolveFile(req.params.name);
    const { name: to, full: toFull } = resolveFile(req.body?.to);
    if (to === name) return res.json({ ok: true, from: name, name: to });
    await ensureConfigDir();
    try {
      await fs.access(toFull);
      const err = new Error(`${to} already exists`);
      err.status = 409;
      throw err;
    } catch (e) {
      if (e.status) throw e;
    }
    await fs.rename(full, toFull);
    await renameFileEnvironment(name, to);
    res.json({ ok: true, from: name, name: to });
  })
);

// ---- Config backups --------------------------------------------------------

app.get(
  "/api/backups",
  asyncHandler(async (_req, res) => {
    res.json({ backupDir: CONFIG_BACKUP_DIR, backups: await listConfigBackups() });
  })
);

app.post(
  "/api/backups",
  asyncHandler(async (_req, res) => {
    const { dir, files } = await backupAll(CONFIG_DIR);
    res.json({ ok: true, dir, files });
  })
);

app.post(
  "/api/files/:name/backup",
  asyncHandler(async (req, res) => {
    const { name } = resolveFile(req.params.name);
    const { dir, files } = await backupOne(CONFIG_DIR, name);
    res.json({ ok: true, dir, files });
  })
);

app.post(
  "/api/backups/restore",
  asyncHandler(async (req, res) => {
    const { restored } = await restoreConfigBackup(CONFIG_DIR, req.body?.name);
    res.json({ ok: true, restored });
  })
);

// ---- Manual environment tags -----------------------------------------------

app.put(
  "/api/environments/file",
  asyncHandler(async (req, res) => {
    const { name } = resolveFile(req.body?.name);
    await setFileEnvironment(name, req.body?.env);
    res.json({ ok: true, name, env: req.body?.env || "auto" });
  })
);

app.put(
  "/api/environments/host",
  asyncHandler(async (req, res) => {
    const { name } = resolveFile(req.body?.name);
    const host = String(req.body?.host || "").trim();
    if (!host) {
      const err = new Error("Missing `host`");
      err.status = 400;
      throw err;
    }
    await setHostEnvironment(name, host, req.body?.env);
    res.json({ ok: true, name, host, env: req.body?.env || "auto" });
  })
);

app.get(
  "/api/hosts",
  asyncHandler(async (_req, res) => {
    const names = await listConfigFiles();
    const byAlias = new Map();
    for (const name of names) {
      const model = parse(await fs.readFile(path.join(CONFIG_DIR, name), "utf8"));
      for (const alias of hostAliases(model)) {
        if (!byAlias.has(alias)) byAlias.set(alias, []);
        byAlias.get(alias).push(name);
      }
    }
    res.json({
      hosts: [...byAlias.entries()].map(([alias, files]) => ({ alias, files })),
    });
  })
);

function buildForRequest(body) {
  const host = body?.host;
  if (!host) {
    const err = new Error("Missing `host`");
    err.status = 400;
    throw err;
  }
  return buildLaunch({ host, directives: body?.directives, mainConfigPath: MAIN_CONFIG });
}

app.post(
  "/api/preview",
  asyncHandler(async (req, res) => {
    const plan = buildForRequest(req.body);
    res.json({ command: plan.command, friendly: plan.friendly || plan.command, usedOverrides: plan.usedOverrides });
  })
);

function parseSshG(text) {
  const values = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^([a-z0-9]+)\s+(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2];
    if (value === "" ) continue;
    (values[key] ||= []).push(value);
  }
  return values;
}

app.post(
  "/api/resolve",
  asyncHandler(async (req, res) => {
    const plan = buildForRequest(req.body);
    let stdout;
    try {
      stdout = await sshEffectiveConfig(plan.args);
    } catch (err) {
      const e = new Error(`ssh -G failed: ${err.stderr || err.message}`);
      e.status = 400;
      throw e;
    }
    res.json({
      command: plan.friendly || plan.command,
      resolved: parseSshG(stdout),
      raw: stdout,
    });
  })
);

app.post(
  "/api/launch",
  asyncHandler(async (req, res) => {
    const plan = buildForRequest(req.body);
    try {
      const { terminal } = await launchTerminal(plan.args, { terminal: TERMINAL });
      res.json({ ok: true, command: plan.command, friendly: plan.friendly || plan.command, terminal });
    } catch (err) {
      const e = new Error(`Could not open a terminal: ${err.message}`);
      e.status = 500;
      throw e;
    }
  })
);

// ---- System hosts file (/etc/hosts) ---------------------------------------

app.get(
  "/api/hosts-file",
  asyncHandler(async (_req, res) => {
    res.json(await readHosts());
  })
);

app.put(
  "/api/hosts-file",
  asyncHandler(async (req, res) => {
    const result = await writeHosts(req.body?.text);
    res.json({ ...result, ...(await readHosts()) });
  })
);

app.get(
  "/api/hosts-file/backups",
  asyncHandler(async (_req, res) => {
    res.json({ backups: await listBackups() });
  })
);

app.post(
  "/api/hosts-file/restore",
  asyncHandler(async (req, res) => {
    const result = await restoreBackup(req.body?.name);
    res.json({ ...result, ...(await readHosts()) });
  })
);

// ---- Errors ----------------------------------------------------------------

app.use((err, _req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || "Internal error";
  if (err.code === "ENOENT") {
    status = 404;
    message = "File not found";
  }
  res.status(status).json({ error: message });
});

app.listen(PORT, BIND, () => {
  const url = `http://${BIND}:${PORT}`;
  console.log(`super-smart-hosts listening on ${url}`);
  console.log(`config dir: ${CONFIG_DIR}`);
  if (TERMINAL && TERMINAL !== "auto") console.log(`terminal: ${TERMINAL}`);
});
