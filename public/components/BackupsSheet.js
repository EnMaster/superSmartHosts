import { html, useState, useEffect } from "preact";
import { api } from "../lib/api.js";
import { IconArchive, IconRestore, IconClose } from "./icons.js";

function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupsSheet({ onClose, onToast, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const d = await api.backups();
    setData(d);
  };

  useEffect(() => {
    load()
      .catch((err) => onToast({ kind: "err", title: "Could not load backups", msg: err.message }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  const backupAll = async () => {
    setBusy(true);
    try {
      const res = await api.backupAll();
      onToast({ kind: "ok", title: "Backed up all files", msg: `${res.files.length} file${res.files.length === 1 ? "" : "s"}` });
      await load();
    } catch (err) {
      onToast({ kind: "err", title: "Backup failed", msg: err.message });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (name) => {
    if (!confirm(`Restore backup ${name}?\n\nThis overwrites the matching files in your config folder.`)) return;
    setBusy(true);
    try {
      const res = await api.restoreBackup(name);
      onToast({ kind: "ok", title: "Backup restored", msg: `${res.restored.length} file${res.restored.length === 1 ? "" : "s"}` });
      onChanged?.();
      await load();
    } catch (err) {
      onToast({ kind: "err", title: "Restore failed", msg: err.message });
    } finally {
      setBusy(false);
    }
  };

  const backups = data?.backups || [];

  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet sheet--wide" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconArchive} size=${18} />
        <div style="flex:1;min-width:0">
          <div class="sheet__title">Config backups</div>
          <div class="sheet__sub mono">${data?.backupDir || "~/.super-smart-hosts/config-backups"}</div>
        </div>
        <button class="icon-btn" onClick=${onClose}><${IconClose} /></button>
      </div>

      <div class="sheet__body">
        ${loading
          ? html`<p class="muted">Loading…</p>`
          : backups.length === 0
            ? html`<p class="muted">No backups yet. Use “Back up all files” below, or back up a single file from its toolbar.</p>`
            : html`<div class="backups">
                ${backups.map(
                  (b) => html`<div class="backup-row" key=${b.name}>
                    <span class="backup-row__icon"><${IconArchive} size=${14} /></span>
                    <span class="backup-row__body">
                      <span class="backup-row__title">${b.files.join(", ")}</span>
                      <span class="backup-row__meta">
                        ${b.files.length} file${b.files.length === 1 ? "" : "s"} · ${bytes(b.size)} · ${timeAgo(b.mtime)}
                      </span>
                    </span>
                    <button class="btn" disabled=${busy} onClick=${() => restore(b.name)}>
                      <${IconRestore} size=${14} /> Restore
                    </button>
                  </div>`
                )}
              </div>`}
      </div>

      <div class="sheet__foot">
        <span class="muted" style="font-size:12px">${backups.length} backup${backups.length === 1 ? "" : "s"}</span>
        <div class="spacer"></div>
        <button class="btn btn--primary" disabled=${busy} onClick=${backupAll}>
          <${IconArchive} /> ${busy ? "Working…" : "Back up all files"}
        </button>
      </div>
    </div>
  </div>`;
}
