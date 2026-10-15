import { html, useState, useEffect } from "preact";
import { api } from "../lib/api.js";
import { IconGlobe, IconSave, IconClose, IconRestore, IconCode, IconWarn } from "./icons.js";

function lintHosts(text) {
  const issues = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;
    const parts = t.split(/\s+/);
    if (parts.length < 2) {
      issues.push({ line: i + 1, msg: "needs an address and at least one name" });
      return;
    }
    const ip = parts[0];
    const isV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    const isV6 = ip.includes(":") && /^[0-9a-fA-F:]+$/.test(ip);
    if (!isV4 && !isV6) issues.push({ line: i + 1, msg: `“${ip}” does not look like an IP address` });
  });
  return issues;
}

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

export function HostsFileSheet({ onClose, onToast }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const d = await api.hostsFile();
    setData(d);
    setText(d.text);
    setOriginal(d.text);
    const b = await api.hostsBackups();
    setBackups(b.backups);
  };

  useEffect(() => {
    load()
      .catch((err) => onToast({ kind: "err", title: "Could not read hosts file", msg: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const dirty = text !== original;
  const issues = lintHosts(text);

  const doSave = async () => {
    const warn =
      data?.privileged
        ? `Write to ${data.path}?\n\nYou will be asked for your admin password, and a backup is saved first.`
        : `Write to ${data.path}? A backup is saved first.`;
    if (!confirm(warn)) return;
    setSaving(true);
    try {
      const res = await api.saveHostsFile(text);
      setOriginal(res.text);
      setText(res.text);
      onToast({
        kind: "ok",
        title: "Hosts file saved",
        msg: res.backup ? `backup: ${res.backup}` : data.path,
      });
      await load();
    } catch (err) {
      onToast({ kind: "err", title: "Save failed", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const restore = async (name) => {
    if (!confirm(`Restore ${name}? The current file is backed up first.`)) return;
    try {
      await api.restoreHostsBackup(name);
      onToast({ kind: "ok", title: "Backup restored", msg: name });
      await load();
    } catch (err) {
      onToast({ kind: "err", title: "Restore failed", msg: err.message });
    }
  };

  const revert = () => setText(original);

  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet sheet--wide" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconGlobe} size=${18} />
        <div style="flex:1;min-width:0">
          <div class="sheet__title">System hosts file</div>
          <div class="sheet__sub mono">${data?.path || "/etc/hosts"}</div>
        </div>
        ${data?.privileged
          ? html`<span class="pill" title="Writing requires your admin password"><${IconWarn} size=${12} /> admin required</span>`
          : null}
        <button class="icon-btn" onClick=${onClose}><${IconClose} /></button>
      </div>

      <div class="sheet__body">
        ${loading
          ? html`<p class="muted">Loading…</p>`
          : html`<div class="hosts">
              <div class="hosts__main">
                <textarea
                  class="raw raw--hosts"
                  spellcheck=${false}
                  value=${text}
                  onInput=${(e) => setText(e.currentTarget.value)}
                ></textarea>
                ${issues.length
                  ? html`<div class="hosts__lint">
                      <${IconWarn} size=${13} />
                      <span>
                        ${issues.length} line${issues.length === 1 ? "" : "s"} may be malformed:
                        ${issues
                          .slice(0, 6)
                          .map((i) => `line ${i.line} ${i.msg}`)
                          .join("; ")}${issues.length > 6 ? "…" : ""}
                      </span>
                    </div>`
                  : null}
              </div>

              <aside class="hosts__side">
                <div class="hosts__side-title">
                  <${IconCode} size=${13} /> file
                </div>
                <p class="muted hosts__count">
                  ${text.split(/\r?\n/).length} lines · ${new Blob([text]).size} bytes
                </p>
                <div class="hosts__side-title" style="margin-top:16px">
                  <${IconRestore} size=${13} /> Backups
                </div>
                ${backups.length === 0
                  ? html`<p class="muted hosts__count">No backups yet.</p>`
                  : html`<div class="hosts__backups">
                      ${backups.slice(0, 12).map(
                        (b) => html`<button key=${b.name} class="hosts__backup" title=${b.name} onClick=${() => restore(b.name)}>
                          <${IconRestore} size=${12} />
                          <span class="hosts__backup-time">${timeAgo(b.mtime)}</span>
                          <span class="hosts__backup-size">${b.size}b</span>
                        </button>`
                      )}
                    </div>`}
              </aside>
            </div>`}
      </div>

      <div class="sheet__foot">
        <span class="muted" style="font-size:12px">
          ${dirty ? "Unsaved changes" : "Up to date"}${issues.length ? ` · ${issues.length} warning${issues.length === 1 ? "" : "s"}` : ""}
        </span>
        <div class="spacer"></div>
        <button class="btn" disabled=${!dirty || saving} onClick=${revert}>Revert</button>
        <button class="btn btn--primary" disabled=${!dirty || saving} onClick=${doSave}>
          <${IconSave} /> ${saving ? "Saving…" : "Save hosts file"}
        </button>
      </div>
    </div>
  </div>`;
}
