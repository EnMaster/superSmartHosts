// Environment classification shared by the server (file index) and the client
// (live badge while editing). Keep this the single source of truth.
//
// A file or host is tagged "prod" or "staging" by looking for well-known
// environment words in its name, aliases and hostname. "prod" always wins over
// "staging"/"test" so a mixed name is treated as production.

const PROD = ["prod", "production", "prd", "live"];

const STAGING = [
  "staging",
  "stage",
  "stg",
  "test",
  "tests",
  "testing",
  "tst",
  "qa",
  "dev",
  "develop",
  "development",
  "sandbox",
  "sbx",
  "uat",
  "preprod",
  "preproduction",
  "preview",
  "demo",
  "nonprod",
  "nonproduction",
];

export const ENV_LABELS = { prod: "production", staging: "test / staging" };

// Selectable states in the environment menu. `auto` means "guess from names";
// the rest are explicit user choices stored in ~/.super-smart-hosts.
export const ENV_CHOICES = [
  { value: "auto", label: "Automatic" },
  { value: "prod", label: "Production" },
  { value: "staging", label: "Test / staging" },
  { value: "none", label: "None" },
];

const OVERRIDES = new Set(["prod", "staging", "none"]);

export function isOverride(value) {
  return OVERRIDES.has(value);
}

function tokens(str) {
  return String(str || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

// Exact keyword, or keyword followed only by digits ("prod1", "stg2").
function has(tok, list) {
  for (const k of list) {
    if (tok === k) return true;
    if (tok.length > k.length && tok.startsWith(k) && /^\d+$/.test(tok.slice(k.length))) return true;
  }
  return false;
}

export function classifyEnv(...parts) {
  let staging = false;
  for (const part of parts) {
    for (const tok of tokens(part)) {
      if (has(tok, PROD)) return "prod";
      if (has(tok, STAGING)) staging = true;
    }
  }
  return staging ? "staging" : null;
}

// A file inherits its own name's env; otherwise it takes the strongest env
// among its hosts (prod > staging > none).
export function fileEnv(name, hostEnvs = []) {
  const own = classifyEnv(name);
  if (own === "prod") return "prod";
  let staging = own === "staging";
  for (const env of hostEnvs) {
    if (env === "prod") return "prod";
    if (env === "staging") staging = true;
  }
  return staging ? "staging" : null;
}

// The user's explicit choice wins over any guess. `override` is one of
// "prod" | "staging" | "none" | "auto"/undefined (auto = use the guess).
export function effectiveFileEnv(name, override, hostEnvs = []) {
  if (override === "none") return null;
  if (override === "prod" || override === "staging") return override;
  return fileEnv(name, hostEnvs);
}

// Precedence for a single host: explicit host override, then an explicit file
// override, then the host's own guess. A "none" override forces neutral so it
// also stops a name-based guess from colouring the host.
export function effectiveHostEnv(hostOverride, fileOverride, heuristic) {
  if (hostOverride === "prod" || hostOverride === "staging") return hostOverride;
  if (hostOverride === "none") return null;
  if (fileOverride === "prod" || fileOverride === "staging") return fileOverride;
  if (fileOverride === "none") return null;
  return heuristic || null;
}
