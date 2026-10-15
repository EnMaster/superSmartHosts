import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Quote a single argument so a shell passes it through untouched.
export function shellQuote(arg) {
  const s = String(arg);
  if (s === "") return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function shellJoin(args) {
  return args.map(shellQuote).join(" ");
}

// Human-readable rendering for the UI preview (quote only when needed).
export function displayCommand(args) {
  return args
    .map((arg) => (/^[A-Za-z0-9_@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replace(/"/g, '\\"')}"`))
    .join(" ");
}

function escapeAppleScript(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function detectTerminal(preference) {
  if (preference && preference !== "auto") return preference;
  if (process.platform !== "darwin") return "system";
  if (existsSync("/Applications/iTerm.app") || existsSync(`${process.env.HOME}/Applications/iTerm.app`)) {
    return "iterm";
  }
  return "terminal";
}

async function launchMac(command, terminal) {
  if (terminal === "iterm") {
    const script = [
      'tell application "iTerm"',
      "  activate",
      "  set newWindow to (create window with default profile)",
      `  tell current session of newWindow to write text "${escapeAppleScript(command)}"`,
      "end tell",
    ].join("\n");
    await execFileAsync("osascript", ["-e", script]);
    return;
  }
  const script = [
    'tell application "Terminal"',
    "  activate",
    `  do script "${escapeAppleScript(command)}"`,
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script]);
}

const LINUX_TERMINALS = [
  { bin: "x-terminal-emulator", args: ["-e", "sh", "-c"] },
  { bin: "gnome-terminal", args: ["--", "sh", "-c"] },
  { bin: "konsole", args: ["-e", "sh", "-c"] },
  { bin: "kitty", args: ["sh", "-c"] },
  { bin: "alacritty", args: ["-e", "sh", "-c"] },
  { bin: "xterm", args: ["-e", "sh", "-c"] },
];

async function launchLinux(command) {
  for (const term of LINUX_TERMINALS) {
    try {
      const child = execFile(term.bin, [...term.args, command], { detached: true });
      child.unref();
      return term.bin;
    } catch {
      // try the next candidate
    }
  }
  throw new Error("No supported terminal emulator found. Set SMH_TERMINAL.");
}

export async function launchTerminal(args, options = {}) {
  const command = shellJoin(args);
  const terminal = detectTerminal(options.terminal);
  if (process.platform === "darwin") {
    await launchMac(command, terminal);
  } else if (process.platform === "linux") {
    await launchLinux(command);
  } else {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  return { command, terminal };
}

// Run `ssh -G` to dump the effective configuration for a host without connecting.
export async function sshEffectiveConfig(args) {
  const gArgs = [args[0], "-G", ...args.slice(1)];
  const { stdout } = await execFileAsync(gArgs[0], gArgs.slice(1), { timeout: 8000, maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}
