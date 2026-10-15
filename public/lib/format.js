export function hostTokens(patterns) {
  return String(patterns || "")
    .split(/\s+/)
    .filter(Boolean);
}

function splitLast(spec, sep = ":") {
  const idx = spec.lastIndexOf(sep);
  if (idx === -1) return ["", spec];
  return [spec.slice(0, idx), spec.slice(idx + 1)];
}

// "[bind_address:]port"
export function parseListen(spec) {
  const s = String(spec || "").trim();
  if (!s) return { bind: "", port: "" };
  if (s.includes(":")) {
    const [bind, port] = splitLast(s);
    return { bind, port };
  }
  return { bind: "", port: s };
}

export function formatListen({ bind, port }) {
  const b = String(bind || "").trim();
  const p = String(port || "").trim();
  return b ? `${b}:${p}` : p;
}

// "host:hostport" (hostport optional)
export function parseTarget(spec) {
  const s = String(spec || "").trim();
  if (!s) return { host: "", port: "" };
  if (s.includes(":")) {
    const [host, port] = splitLast(s);
    return { host, port };
  }
  return { host: s, port: "" };
}

export function formatTarget({ host, port }) {
  const h = String(host || "").trim();
  const p = String(port || "").trim();
  return p ? `${h}:${p}` : h;
}

// value ("[listen] host:hostport" or "[listen]") <-> structured fields
export function parseForward(value) {
  const tokens = String(value || "").trim().split(/\s+/).filter(Boolean);
  const listen = parseListen(tokens[0] || "");
  const target = parseTarget(tokens[1] || "");
  return { listen, target };
}

export function formatForward({ listen, target }) {
  const parts = [formatListen(listen)];
  const t = formatTarget(target);
  if (t) parts.push(t);
  return parts.filter((p) => p !== "").join(" ");
}

// Resolve the display target for a host block.
export function targetInfo(directives) {
  const get = (key) => {
    const found = directives.find((d) => d.key.toLowerCase() === key.toLowerCase());
    return found ? found.value : "";
  };
  const host = get("HostName") || "(same as alias)";
  const user = get("User");
  const port = get("Port");
  const proxy = directives.filter((d) => d.key.toLowerCase() === "proxyjump").map((d) => d.value);
  return { host, user, port, proxy };
}

export function isForwardKey(key) {
  const k = key.toLowerCase();
  return k === "localforward" || k === "remoteforward" || k === "dynamicforward";
}

export function forwardKind(key) {
  const k = key.toLowerCase();
  if (k === "localforward") return "local";
  if (k === "remoteforward") return "remote";
  return "dynamic";
}

export function keyTone(key) {
  const k = key.toLowerCase();
  if (k.includes("forward")) return "fwd";
  if (k === "proxyjump" || k === "proxycommand") return "proxy";
  if (["identityfile", "certificatefile", "user", "hostname"].includes(k)) return "auth";
  return "misc";
}

// Return whether the option may legitimately appear multiple times.
const MULTI = new Set([
  "localforward",
  "remoteforward",
  "dynamicforward",
  "identityfile",
  "certificatefile",
  "sendenv",
  "setenv",
  "include",
  "hostkeyalgorithms",
  "ciphers",
  "macs",
  "kexalgorithms",
  "canonicaldomains",
]);

export function isMulti(key) {
  return MULTI.has(String(key || "").toLowerCase());
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Deterministic hue per string, used to give each host a stable colour identity.
export function hueFor(str) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function initials(str) {
  const s = String(str || "?").replace(/^.*[*?]/, "");
  return (s[0] || "?").toUpperCase();
}

// Light validation of a host's directives. Returns a list of human messages.
export function lintHost(directives) {
  const issues = [];
  const forwards = directives.filter((d) => isForwardKey(d.key));
  for (const f of forwards) {
    const { listen, target } = parseForward(f.value);
    const kind = forwardKind(f.key);
    if (!listen.port || !/^\d+$/.test(listen.port)) {
      issues.push(`${f.key}: "listen" port is missing or not a number`);
    }
    if (kind !== "dynamic" && (!target.host || !target.port || !/^\d+$/.test(target.port))) {
      issues.push(`${f.key}: destination should be host:port`);
    }
  }
  const hasHostName = directives.some((d) => d.key.toLowerCase() === "hostname");
  const hasProxy = directives.some((d) => d.key.toLowerCase() === "proxyjump" || d.key.toLowerCase() === "proxycommand");
  if (!hasHostName && !hasProxy) {
    issues.push("No HostName set — ssh will try to resolve the alias itself");
  }
  return issues;
}
