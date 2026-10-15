import { html, useState } from "preact";
import { TEMPLATES } from "../lib/templates.js";
import { IconClose, IconTemplate } from "./icons.js";

export function TemplateSheet({ mode, targetAlias, onClose, onPick }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const list = TEMPLATES.filter(
    (t) => !query || t.name.toLowerCase().includes(query) || t.desc.toLowerCase().includes(query) || t.tags.some((tag) => tag.includes(query))
  );

  const title = mode === "new" ? "New host from a template" : `Apply a template to ${targetAlias}`;

  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet sheet--wide" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconTemplate} size=${18} />
        <div style="flex:1">
          <div class="sheet__title">${title}</div>
          <div class="sheet__sub">
            ${mode === "new"
              ? "Pick a starting point — you can edit every option afterwards."
              : "The template's options are added to this host. Existing options are kept."}
          </div>
        </div>
        <button class="icon-btn" onClick=${onClose}><${IconClose} /></button>
      </div>

      <div class="sheet__body">
        <input
          class="input"
          style="margin-bottom:14px"
          placeholder="Search templates…"
          value=${q}
          autoFocus
          onInput=${(e) => setQ(e.currentTarget.value)}
        />

        <div class="tpl-grid">
          ${list.map(
            (t) => html`<button key=${t.id} class="tpl" onClick=${() => onPick(t)}>
              <span class="tpl__name">${t.name}</span>
              <span class="tpl__desc">${t.desc}</span>
              <span class="tpl__keys">
                ${[...new Set(t.directives.map((d) => d.key))].slice(0, 5).map((k) => html`<span class="tpl__key">${k}</span>`)}
              </span>
            </button>`
          )}
          ${list.length === 0 && html`<div class="muted" style="padding:8px">No template matches “${q}”.</div>`}
        </div>
      </div>
    </div>
  </div>`;
}
