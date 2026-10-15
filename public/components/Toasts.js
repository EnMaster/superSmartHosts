import { html } from "preact";

export function Toasts({ toasts, onDismiss }) {
  return html`<div class="toasts">
    ${toasts.map(
      (t) => html`<div key=${t.id} class=${t.kind === "err" ? "toast toast--err" : "toast toast--ok"} onClick=${() => onDismiss(t.id)}>
        <div class="toast__title">${t.title}</div>
        ${t.msg && html`<div class="toast__msg">${t.msg}</div>`}
      </div>`
    )}
  </div>`;
}
