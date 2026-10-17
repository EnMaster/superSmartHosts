import { html, useEffect, useRef } from "preact";
import { IconRoute, IconSearch, IconPlus, IconTrash, IconGlobe, IconArchive, IconPencil } from "./icons.js";
import { THEMES } from "../lib/themes.js";
import { searchFiles, highlight } from "../lib/search.js";
import { ENV_LABELS } from "../lib/env.js";
import { initials } from "../lib/format.js";

const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function RenameInput({ value, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);
  const stop = (e) => e.stopPropagation();
  return html`<input
    ref=${ref}
    class="file-item__rename-input"
    defaultValue=${value}
    spellcheck=${false}
    onClick=${stop}
    onMouseDown=${stop}
    onKeyDown=${(e) => {
      e.stopPropagation();
      if (e.key === "Enter") onCommit(e.currentTarget.value);
      else if (e.key === "Escape") onCancel();
    }}
    onBlur=${onCancel}
  />`;
}

const dotClass = (env) => "file-item__dot" + (env ? ` file-item__dot--${env}` : "");
const resultDotClass = (env) => "search-group__dot" + (env ? ` is-${env}` : "");
const badgeClass = (env) => "search-host__badge" + (env ? ` is-${env}` : "");
const envTitle = (env) => (env ? `${ENV_LABELS[env]} host` : "");

// Render `text` with each occurrence of the query wrapped in <mark>.
const hl = (text, q) =>
  highlight(text, q).map((p) => (typeof p === "string" ? p : html`<mark>${p.text}</mark>`));

export function Sidebar({ config, files, selectedName, dirtyName, renamingName, search, onSearch, onSelect, onCreate, onDelete, onStartRename, onRename, onCancelRename, onOpenHosts, onOpenBackups, onBackupAll, onOpenEnvMenu, theme, onTheme }) {
  const query = search.trim();
  const searching = query.length > 0;
  const totalHosts = files.reduce((n, f) => n + (f.hostCount || 0), 0);
  const results = searchFiles(files, query) || [];
  const matchCount = results.reduce((n, r) => n + (r.hosts.length || 0), 0);

  const fileList = html`
    ${files.map((f) => {
      const active = f.name === selectedName;
      const renaming = renamingName === f.name;
      return html`<div
        key=${f.name}
        class=${active ? "file-item is-active" : "file-item"}
        role="button"
        tabindex="0"
        title=${f.name}
        onClick=${() => {
          if (!renaming) onSelect(f.name);
        }}
        onKeyDown=${(e) => {
          if (renaming) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(f.name);
          }
        }}
      >
        <button
          class="file-item__env"
          title=${(f.env ? `${ENV_LABELS[f.env]} — ` : "") + "click to set environment"}
          onClick=${(e) => {
            e.stopPropagation();
            onOpenEnvMenu({ scope: "file", name: f.name, current: f.envOverride || "auto", autoEnv: f.env, el: e.currentTarget });
          }}
        >
          <span class=${dotClass(f.env)}></span>
        </button>
        <span class="file-item__body">
          ${renaming
            ? html`<${RenameInput} value=${f.name} onCommit=${(v) => onRename(f.name, v)} onCancel=${onCancelRename} />`
            : html`<span class="file-item__name">${f.name}${f.name === dirtyName ? " •" : ""}</span>`}
          <span class="file-item__meta">${f.hostCount} host${f.hostCount === 1 ? "" : "s"}</span>
        </span>
        <span
          class="file-item__rename"
          title="Rename file"
          onClick=${(e) => {
            e.stopPropagation();
            onStartRename(f.name);
          }}
        >
          <${IconPencil} size=${14} />
        </span>
        <span
          class="file-item__del"
          title="Delete file"
          onClick=${(e) => {
            e.stopPropagation();
            onDelete(f.name);
          }}
        >
          <${IconTrash} size=${14} />
        </span>
      </div>`;
    })}
    ${files.length === 0 && html`<div style="padding:14px 12px" class="muted">No config files yet.</div>`}
  `;

  const searchList = html`
    <div class="search-summary">
      ${results.length === 0
        ? html`<span class="muted">No matches for “${query}”</span>`
        : matchCount > 0
          ? html`<span><b>${matchCount}</b> host${matchCount === 1 ? "" : "s"} in <b>${results.length}</b> file${results.length === 1 ? "" : "s"}</span>`
          : html`<span><b>${results.length}</b> file${results.length === 1 ? "" : "s"} matched by name</span>`}
    </div>
    ${results.map((r) => {      const isActive = r.file.name === selectedName;
      return html`<div class="search-group" key=${r.file.name}>
        <button class=${isActive ? "search-group__head is-active" : "search-group__head"} onClick=${() => onSelect(r.file.name)} title=${r.file.name}>
          <span class=${resultDotClass(r.file.env)} title=${envTitle(r.file.env)}></span>
          <span class="search-group__name">${hl(r.file.name, query)}</span>
          <span class="search-group__meta">
            ${r.hosts.length ? `${r.hosts.length} match${r.hosts.length === 1 ? "" : "es"}` : "file name"}
          </span>
        </button>
        ${r.hosts.map(
          (h) => html`<button key=${h.id} class="search-host" onClick=${() => onSelect(r.file.name, h.id)} title=${`${h.alias || h.patterns} — open in ${r.file.name}`}>
            <span class=${badgeClass(h.env)} title=${envTitle(h.env)}>${initials(h.alias || h.patterns)}</span>
            <span class="search-host__body">
              <span class="search-host__alias">${h.alias || h.patterns || "(unnamed host)"}</span>
              <span class="search-host__match">
                <span class="search-host__key">${h.match.key}</span>
                <span class="search-host__value">${hl(h.match.value, query)}</span>
              </span>
            </span>
          </button>`
        )}
      </div>`;
    })}
  `;

  return html`<aside class="sidebar">
    <div class="brand">
      <div class="brand__mark"><${IconRoute} /></div>
      <div class="brand__text">
        <h1 class="brand__name">Super Smart Hosts</h1>
        <p class="brand__sub">${config?.configDir || "~/.ssh/config.d"}</p>
      </div>
    </div>

    <div class="sidebar__search">
      <${IconSearch} />
      <input
        placeholder="Search hosts, IPs, options…"
        value=${search}
        onInput=${(e) => onSearch(e.currentTarget.value)}
      />
    </div>

    <div class="sidebar__section">
      ${query
        ? html`<span>search results</span>`
        : html`<span>${files.length} file${files.length === 1 ? "" : "s"} · ${totalHosts} host${totalHosts === 1 ? "" : "s"}</span>`}
      <span class="sidebar__section-actions">
        <button class="icon-btn" title="Back up all config files" disabled=${files.length === 0} onClick=${onBackupAll}><${IconArchive} /></button>
        <button class="icon-btn" title="New config file" onClick=${onCreate}><${IconPlus} /></button>
      </span>
    </div>

    <div class="sidebar__scroll">${searching ? searchList : fileList}</div>

    <button class="sidebar__nav" onClick=${onOpenHosts} title=${config?.hostsFile || "/etc/hosts"}>
      <${IconGlobe} size=${15} />
      <span class="sidebar__nav-body">
        <span class="sidebar__nav-title">System hosts</span>
        <span class="sidebar__nav-sub">${config?.hostsFile || "/etc/hosts"}</span>
      </span>
    </button>

    <button class="sidebar__nav" onClick=${onOpenBackups} title="Config backups">
      <${IconArchive} size=${15} />
      <span class="sidebar__nav-body">
        <span class="sidebar__nav-title">Backups</span>
        <span class="sidebar__nav-sub">snapshots of your config</span>
      </span>
    </button>

    <div class="sidebar__footer">
      ${config && !config.includesConfigDir
        ? html`<div class="warn">
            <span>
              Your <code>~/.ssh/config</code> does not include <code>config.d</code>.<br />
              Add <code>Include ~/.ssh/config.d/*</code> so ssh reads these files.
            </span>
          </div>`
        : null}
      <label class="theme-pick">
        <span class="theme-pick__label">Theme</span>
        <span class="theme-pick__field">
          <select class="theme-pick__select" value=${theme} onChange=${(e) => onTheme(e.currentTarget.value)}>
            ${THEMES.map((t) => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}
          </select>
          <span class="theme-pick__arrow" aria-hidden="true">▼</span>
        </span>
      </label>
    </div>
  </aside>`;
}
