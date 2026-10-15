import { html, useState, useEffect } from "preact";
import { api } from "../lib/api.js";
import { IconClose, IconSearch, IconRoute } from "./icons.js";

const FIELDS = [
  { key: "hostname", label: "Host name" },
  { key: "user", label: "User" },
  { key: "port", label: "Port" },
  { key: "proxyjump", label: "Proxy jump", list: true },
  { key: "proxycommand", label: "Proxy command" },
  { key: "localforward", label: "Local forward", list: true },
  { key: "remoteforward", label: "Remote forward", list: true },
  { key: "dynamicforward", label: "Dynamic forward", list: true },
  { key: "identityfile", label: "Identity file", list: true },
  { key: "identitiesonly", label: "Identities only" },
  { key: "addkeystoagent", label: "Add keys to agent" },
  { key: "forwardagent", label: "Forward agent" },
  { key: "forwardx11", label: "Forward X11" },
  { key: "serveraliveinterval", label: "Server alive interval" },
  { key: "serveralivecountmax", label: "Server alive count max" },
  { key: "controlmaster", label: "Control master" },
  { key: "controlpath", label: "Control path" },
  { key: "controlpersist", label: "Control persist" },
  { key: "stricthostkeychecking", label: "Strict host key checking" },
  { key: "connecttimeout", label: "Connect timeout" },
  { key: "ciphers", label: "Ciphers" },
  { key: "compression", label: "Compression" },
];

export function InspectSheet({ alias, directives, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .resolve(alias, directives)
      .then((res) => alive && setData(res))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [alias, directives]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resolved = data?.resolved || {};
  const configured = new Set((directives || []).map((d) => d.key.toLowerCase()));
  const always = new Set(["hostname", "user", "port"]);
  const fieldsToShow = FIELDS.filter((f) => always.has(f.key) || configured.has(f.key));
  const configuredFields = fieldsToShow.filter((f) => configured.has(f.key));
  const hasExtra = FIELDS.some((f) => !always.has(f.key) && !configured.has(f.key));

  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet sheet--wide" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconRoute} />
        <div style="flex:1">
          <div class="sheet__title">Effective config for ${alias}</div>
          <div class="sheet__sub">What ssh actually resolves after includes and your edits — from <code>ssh -G</code>.</div>
        </div>
        <button class="icon-btn" onClick=${onClose}><${IconClose} /></button>
      </div>

      <div class="sheet__body">
        <div class="cmd__bar">
          <span class="cmd__label">resolved from</span>
          <button class="btn btn--ghost btn--sm" onClick=${() => setShowRaw((v) => !v)}>
            ${showRaw ? "Show fields" : "Show raw output"}
          </button>
        </div>
        <div class="cmd" style="margin-bottom:16px"><span class="cmd__prompt">$ </span>${data?.command || "…"}</div>

        ${error && html`<div class="note" style="border-color:rgba(240,122,122,.4);background:rgba(240,122,122,.08);color:#f3b3b3">${error}</div>`}

        ${!data && !error && html`<p class="muted">Resolving…</p>`}

        ${data &&
        (showRaw
          ? html`<pre class="cmd" style="max-height:52vh;overflow:auto">${data.raw.trim()}</pre>`
          : html`<div class="resolve">
              ${fieldsToShow.map((f) => {
                const vals = resolved[f.key];
                if (!vals || vals.length === 0) return null;
                return html`<div class="resolve__row" key=${f.key}>
                  <div class="resolve__key">${f.label}</div>
                  <div class="resolve__val">
                    ${vals.map((v) => html`<code>${v}</code>`)}
                  </div>
                </div>`;
              })}
              ${configuredFields.length === 0 &&
              html`<p class="muted" style="padding:8px">This host sets no options. It connects using ssh defaults and anything inherited from an <code>Include</code>.</p>`}
              <p class="muted" style="font-size:12px;padding:10px 10px 0">
                Showing the options this host configures. ${hasExtra ? "Use “Show raw output” to see every resolved value." : ""}
              </p>
            </div>`)}
      </div>
    </div>
  </div>`;
}
