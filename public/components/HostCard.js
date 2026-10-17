import { html, useState, useEffect, useRef } from "preact";
import { DirectiveEditor } from "./DirectiveRows.js";
import { targetInfo, isForwardKey, hostTokens, hueFor, lintHost } from "../lib/format.js";
import { classifyEnv, effectiveHostEnv } from "../lib/env.js";
import {
  IconChevron,
  IconPlay,
  IconTrash,
  IconArrow,
  IconBranch,
  IconCopy,
  IconTerminal,
  IconMore,
  IconTemplate,
  IconDuplicate,
  IconWarn,
  IconSearch,
} from "./icons.js";

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onClose]);
}

export function HostCard({
  block,
  groups,
  byKey,
  optionsList,
  hostAliases,
  onPattern,
  onValue,
  onRemove,
  onAdd,
  onDelete,
  onRun,
  onDuplicate,
  onApplyTemplate,
  onInspect,
  onToast,
  fileName,
  envOverride = "auto",
  fileEnvOverride = "auto",
  onOpenEnvMenu,
  focus = false,
  onFocusHandled,
}) {
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState(false);
  const [flash, setFlash] = useState(false);
  const menuRef = useRef(null);
  const cardRef = useRef(null);
  useOutsideClose(menuRef, () => setMenu(false));

  useEffect(() => {
    if (!focus) return;
    setFlash(true);
    const el = cardRef.current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => {
      setFlash(false);
      onFocusHandled?.();
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [focus]);

  const directives = block.items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it.kind === "directive")
    .map(({ it, index }) => ({ id: `${block.id}:${index}`, index, key: it.key, value: it.value }));

  const rawDirectives = directives.map(({ key, value }) => ({ key, value }));
  const target = targetInfo(rawDirectives);
  const forwards = rawDirectives.filter((d) => isForwardKey(d.key));
  const aliases = hostTokens(block.patterns);
  const primaryAlias = aliases[0] || block.patterns || "new-host";
  const issues = lintHost(rawDirectives);
  const hue = hueFor(primaryAlias);
  const hostname = (rawDirectives.find((d) => d.key.toLowerCase() === "hostname") || {}).value || "";
  const autoEnv = classifyEnv(primaryAlias, hostname, block.patterns);
  const env = effectiveHostEnv(envOverride, fileEnvOverride, autoEnv);
  const badgeClass = "host__badge" + (env ? ` host__badge--${env}` : " host__badge--neutral");
  const hostKey = (block.patterns || "").trim() || block.id;
  const envTitle = env ? `${env === "prod" ? "production" : "test / staging"} — click to change` : "click to set environment";

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast({ kind: "ok", title: `${label} copied`, msg: text });
    } catch {
      onToast({ kind: "err", title: "Copy failed", msg: text });
    }
    setMenu(false);
  };

  return html`<section class=${flash ? "host host--focus" : "host"} ref=${cardRef}>
    <div class="host__header">
      <button class="icon-btn" onClick=${() => setOpen((v) => !v)} title=${open ? "Collapse" : "Expand"}>
        <span class=${open ? "chev is-open" : "chev"}><${IconChevron} /></span>
      </button>
      <button
        class=${badgeClass + " host__badge--btn"}
        style=${`--hue:${hue}`}
        title=${envTitle}
        onClick=${(e) => onOpenEnvMenu({ scope: "host", name: fileName, hostKey, current: envOverride || "auto", autoEnv, el: e.currentTarget })}
      >${(primaryAlias.replace(/^[^A-Za-z0-9]+/, "")[0] || "?").toUpperCase()}</button>
      <div class="host__id">
        <input
          class="host__alias"
          value=${block.patterns}
          spellcheck=${false}
          placeholder="alias host2 *.domain"
          onInput=${(e) => onPattern(e.currentTarget.value)}
        />
        <div class="host__target">
          <span>${target.user ? `${target.user}@` : ""}${target.host}${target.port ? `:${target.port}` : ""}</span>
          ${target.proxy.length > 0 && html`<span class="pill pill--proxy"><${IconBranch} /> via ${target.proxy.join(", ")}</span>`}
          ${forwards.length > 0 &&
          html`<span class="pill pill--fwd"><${IconArrow} /> ${forwards.length} tunnel${forwards.length > 1 ? "s" : ""}</span>`}
          ${issues.length > 0 &&
          html`<span class="host__warn" title=${issues.join("\n")}><${IconWarn} /></span>`}
        </div>
      </div>
      <div class="host__actions">
        <button class="btn btn--primary btn--sm" onClick=${() => onRun(primaryAlias, rawDirectives)}>
          <${IconPlay} /> Run
        </button>
        <div class="menu-wrap" ref=${menuRef}>
          <button class="icon-btn" title="More" onClick=${() => setMenu((v) => !v)}>
            <${IconMore} />
          </button>
          ${menu &&
          html`<div class="menu">
            <div class="menu__label">${primaryAlias}</div>
            <button class="menu__item" onClick=${() => copy(`ssh ${primaryAlias}`, "ssh command")}>
              <${IconTerminal} /> Copy ssh command
            </button>
            <button class="menu__item" onClick=${() => copy(`scp -r ${primaryAlias}:remote/path ./`, "scp command")}>
              <${IconCopy} /> Copy scp command
            </button>
            <div class="menu__sep"></div>
            <button class="menu__item" onClick=${() => { setMenu(false); onInspect(); }}>
              <${IconSearch} /> Inspect effective config
            </button>
            <button class="menu__item" onClick=${() => { setMenu(false); onApplyTemplate(); }}>
              <${IconTemplate} /> Apply a template…
            </button>
            <button class="menu__item" onClick=${() => { setMenu(false); onDuplicate(); }}>
              <${IconDuplicate} /> Duplicate host
            </button>
            <div class="menu__sep"></div>
            <button class="menu__item" style="color:var(--red)" onClick=${() => { setMenu(false); onDelete(); }}>
              <${IconTrash} /> Delete host block
            </button>
          </div>`}
        </div>
      </div>
    </div>

    ${open &&
    html`<div class="host__body">
      <${DirectiveEditor}
        groups=${groups}
        byKey=${byKey}
        optionsList=${optionsList}
        hostAliases=${hostAliases}
        list=${directives}
        onValue=${(id, value) => onValue(Number(id.split(":")[1]), value)}
        onRemove=${(id) => onRemove(Number(id.split(":")[1]))}
        onAdd=${(key, value) => onAdd(key, value)}
      />
    </div>`}
  </section>`;
}
