import { html, useState, useEffect, useMemo, useRef } from "preact";
import { api } from "../lib/api.js";
import { uuid } from "../lib/format.js";
import { DirectiveEditor } from "./DirectiveRows.js";
import { IconClose, IconPlay, IconCopy, IconTerminal } from "./icons.js";

export function LaunchSheet({ alias, initialDirectives, groups, byKey, optionsList, hostAliases, onClose, onToast }) {
  const [items, setItems] = useState(() =>
    initialDirectives.map((d) => ({ id: uuid(), key: d.key, value: d.value }))
  );
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const directives = useMemo(() => items.map(({ key, value }) => ({ key, value })), [items]);
  const initialJSON = useMemo(
    () => JSON.stringify(initialDirectives.map(({ key, value }) => ({ key, value }))),
    [initialDirectives]
  );
  const changed = useMemo(() => JSON.stringify(directives) !== initialJSON, [directives, initialJSON]);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await api.preview(alias, changed ? directives : []);
        setCommand(res.friendly || res.command);
      } catch (err) {
        setCommand(`# ${err.message}`);
      }
    }, 180);
    return () => clearTimeout(timer.current);
  }, [alias, directives, changed]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await api.launch(alias, changed ? directives : []);
      onToast({ kind: "ok", title: `Opening ${alias}`, msg: `${res.terminal} · ${res.friendly}` });
      onClose();
    } catch (err) {
      onToast({ kind: "err", title: "Could not launch", msg: err.message });
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      onToast({ kind: "ok", title: "Command copied", msg: command });
    } catch {
      onToast({ kind: "err", title: "Copy failed", msg: "Your browser blocked clipboard access." });
    }
  };

  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconTerminal} size=${18} />
        <div style="flex:1">
          <div class="sheet__title">Run ${alias}</div>
          <div class="sheet__sub">Tweak the connection, then open a terminal. Changes here are not saved.</div>
        </div>
        <button class="icon-btn" onClick=${onClose} title="Close"><${IconClose} /></button>
      </div>

      <div class="sheet__body">
        <div class="note">
          <span>These edits apply to this session only. Nothing is written to your config files.</span>
        </div>

        <div class="cmd__bar">
          <span class="cmd__label">command</span>
          <button class="btn btn--ghost btn--sm" onClick=${copy}><${IconCopy} /> Copy</button>
        </div>
        <div class="cmd"><span class="cmd__prompt">$ </span>${command || "…"}</div>

        <div style="margin-top:18px">
          <${DirectiveEditor}
            groups=${groups}
            byKey=${byKey}
            optionsList=${optionsList}
            hostAliases=${hostAliases}
            list=${items}
            onValue=${(id, value) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, value } : it)))}
            onRemove=${(id) => setItems((prev) => prev.filter((it) => it.id !== id))}
            onAdd=${(key, value) => setItems((prev) => [...prev, { id: uuid(), key, value }])}
          />
        </div>
      </div>

      <div class="sheet__foot">
        <span class="muted" style="font-size:12px">Launched in your default terminal</span>
        <div class="spacer"></div>
        <button class="btn" onClick=${onClose}>Cancel</button>
        <button class="btn btn--primary" disabled=${busy} onClick=${run}>
          <${IconPlay} /> ${busy ? "Opening…" : "Open terminal"}
        </button>
      </div>
    </div>
  </div>`;
}
