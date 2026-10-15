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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const CONFIG_DIR = process.env.SMH_DIR
  ? path.resolve(process.env.SMH_DIR)
  : path.join(os.homedir(), ".ssh", "config.d");
const MAIN_CONFIG = process.env.SMH_MAIN || path.join(os.homedir(), ".ssh", "config");
const PORT = Number(process.env.PORT || 4317);
const BIND = process.env.HOST || "127.0.0.1";
const TERMINAL = process.env.SMH_TERMINAL || "auto";
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.conf$/;

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
    const err = new Error("Invalid file name. Use letters, digits, dot, dash or underscore and end with .conf");
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

async function mainConfigIncludesConfigDir() {
  try {
    const text = await fs.readFile(MAIN_CONFIG, "utf8");
    const lines = text.split(/\r?\n/);
    return lines.some((line) => {
      const m = line.match(/^\s*Include\s+(.+)$/i);
      if (!m) return false;
      const target = m[1];
      return target.includes("config.d") || path.resolve(target.replace(/^~/, os.homedir())).startsWith(CONFIG_DIR);
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
    await ensureConfigDir();
    const names = (await fs.readdir(CONFIG_DIR)).filter((n) => FILE_RE.test(n)).sort();
    const files = [];
    for (const name of names) {
      const full = path.join(CONFIG_DIR, name);
      const stat = await fs.stat(full);
      let aliases = [];
      let error = null;
      try {
        aliases = hostAliases(parse(await fs.readFile(full, "utf8")));
      } catch (err) {
        error = err.message;
      }
      files.push({ name, size: stat.size, mtime: stat.mtimeMs, aliases, hostCount: aliases.length, error });
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

app.get(
  "/api/hosts",
  asyncHandler(async (_req, res) => {
    await ensureConfigDir();
    const names = (await fs.readdir(CONFIG_DIR)).filter((n) => FILE_RE.test(n)).sort();
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
