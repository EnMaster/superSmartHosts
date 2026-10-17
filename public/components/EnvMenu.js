import { html, useEffect } from "preact";
import { ENV_CHOICES, ENV_LABELS } from "../lib/env.js";

// Small fixed-position popover used to tag a file or a host as
// production / test / none, or leave it on automatic detection. Rendered at the
// app root (not inside the scrollable sidebar) so it is never clipped.
export function EnvMenu({ x, y, current, autoEnv, scope, onPick, onClose }) {
  useEffect(() => {
    const onDoc = (e) => {
      if (!e.target.closest(".env-menu")) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return html`<div class="env-menu" style=${`left:${x}px;top:${y}px`} role="menu">
    <div class="menu__label">${scope === "file" ? "File environment" : "Host environment"}</div>
    ${ENV_CHOICES.map(
      (c) => html`<button
        key=${c.value}
        role="menuitemradio"
        aria-checked=${current === c.value}
        class=${current === c.value ? "menu__item is-selected" : "menu__item"}
        onClick=${() => onPick(c.value)}
      >
        <span class="env-menu__check">${current === c.value ? "✓" : ""}</span>
        <span class="env-menu__label">
          ${c.label}${c.value === "auto" && autoEnv ? html`<span class="env-menu__hint">· ${ENV_LABELS[autoEnv]}</span>` : null}
        </span>
      </button>`
    )}
  </div>`;
}
