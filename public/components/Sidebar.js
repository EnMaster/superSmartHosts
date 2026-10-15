import { html } from "preact";
import { IconRoute, IconSearch, IconPlus, IconTrash, IconGlobe } from "./icons.js";
import { THEMES } from "../lib/themes.js";

export function Sidebar({ config, files, selectedName, dirtyName, search, onSearch, onSelect, onCreate, onDelete, onOpenHosts, theme, onTheme }) {
  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalHosts = files.reduce((n, f) => n + (f.hostCount || 0), 0);

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
      <input placeholder="Filter files…" value=${search} onInput=${(e) => onSearch(e.currentTarget.value)} />
    </div>

    <div class="sidebar__section">
      <span>${files.length} file${files.length === 1 ? "" : "s"} · ${totalHosts} host${totalHosts === 1 ? "" : "s"}</span>
      <button class="icon-btn" title="New config file" onClick=${onCreate}><${IconPlus} /></button>
    </div>

    <div class="sidebar__scroll">
      ${filtered.map(
        (f) => html`<button key=${f.name} class=${f.name === selectedName ? "file-item is-active" : "file-item"} onClick=${() => onSelect(f.name)} title=${f.name}>
          <span class="file-item__dot"></span>
          <span class="file-item__body">
            <span class="file-item__name">${f.name}${f.name === dirtyName ? " •" : ""}</span>
            <span class="file-item__meta">${f.hostCount} host${f.hostCount === 1 ? "" : "s"}</span>
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
        </button>`
      )}
      ${filtered.length === 0 && html`<div style="padding:14px 12px" class="muted">No files match “${search}”.</div>`}
    </div>

    <button class="sidebar__nav" onClick=${onOpenHosts} title=${config?.hostsFile || "/etc/hosts"}>
      <${IconGlobe} size=${15} />
      <span class="sidebar__nav-body">
        <span class="sidebar__nav-title">System hosts</span>
        <span class="sidebar__nav-sub">${config?.hostsFile || "/etc/hosts"}</span>
      </span>
    </button>

    <div class="sidebar__footer">
      ${config && !config.includesConfigDir
        ? html`<div class="warn">
            <span>
              Your <code>~/.ssh/config</code> does not include <code>config.d</code>.<br />
              Add <code>Include ~/.ssh/config.d/*.conf</code> so ssh reads these files.
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
