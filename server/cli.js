#!/usr/bin/env node
import { spawn } from "node:child_process";
import "./index.js";

const PORT = Number(process.env.PORT || 4317);
const url = `http://127.0.0.1:${PORT}`;

if (!process.env.SMH_NO_OPEN) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(opener, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}
