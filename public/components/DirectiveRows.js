import { html, useState, useMemo } from "preact";
import { IconPlus, IconTrash, IconHelp, IconArrow } from "./icons.js";
import { parseForward, formatForward, forwardKind, keyTone } from "../lib/format.js";

export function defaultValueFor(meta) {
  if (!meta) return "";
  if (meta.type === "boolean") return "yes";
  if (meta.type === "enum") return meta.defaultValue || meta.values?.[0] || "";
  if (meta.type === "localforward") return "8080 localhost:80";
  if (meta.type === "remoteforward") return "9090 localhost:3000";
  if (meta.type === "dynamicforward") return "1080";
  return "";
}

function keyClass(key) {
  const tone = keyTone(key);
  return tone === "auth" ? "drow__key drow__key--auth" : tone === "proxy" ? "drow__key drow__key--proxy" : tone === "misc" ? "drow__key drow__key--misc" : "drow__key";
}

function ForwardRow({ meta, value, onChange }) {
  const kind = forwardKind(meta.key);
  const { listen, target } = parseForward(value);
  const set = (next) => onChange(formatForward(next));

  const tag = kind === "local" ? "LOCAL" : kind === "remote" ? "REMOTE" : "SOCKS";

  return html`<div class="fwd">
    <span class="fwd__tag">${tag}</span>
    <input
      class="input"
      style="width:110px"
      placeholder="bind"
      title="Address to bind locally (optional)"
      value=${listen.bind}
      onInput=${(e) => set({ listen: { ...listen, bind: e.currentTarget.value }, target })}
    />
    <span class="fwd__sep">:</span>
    <input
      class="input"
      style="width:80px"
      placeholder="port"
      title="Port to listen on"
      value=${listen.port}
      onInput=${(e) => set({ listen: { ...listen, port: e.currentTarget.value }, target })}
    />
    ${kind !== "dynamic" &&
    html`<${IconArrow} />
      <input
        class="input fwd__host"
        placeholder="host"
        title="Host reachable from the remote side"
        value=${target.host}
        onInput=${(e) => set({ listen, target: { ...target, host: e.currentTarget.value } })}
      />
      <span class="fwd__sep">:</span>
      <input
        class="input"
        style="width:80px"
        placeholder="port"
        title="Destination port"
        value=${target.port}
        onInput=${(e) => set({ listen, target: { ...target, port: e.currentTarget.value } })}
      />`}
  </div>`;
}

function ValueEditor({ meta, value, onChange, hostAliases }) {
  if (!meta) {
    return html`<input class="input" value=${value} onInput=${(e) => onChange(e.currentTarget.value)} />`;
  }
  if (meta.type === "localforward" || meta.type === "remoteforward" || meta.type === "dynamicforward") {
    return html`<${ForwardRow} meta=${meta} value=${value} onChange=${onChange} />`;
  }
  if (meta.type === "boolean" || meta.type === "enum") {
    const values = meta.type === "boolean" ? ["yes", "no"] : meta.values;
    const set = new Set(values);
    if (value && !set.has(value)) set.add(value);
    return html`<select class="select" value=${value} onChange=${(e) => onChange(e.currentTarget.value)}>
      ${value === "" && html`<option value=""></option>`}
      ${[...set].map((v) => html`<option value=${v}>${v}</option>`)}
    </select>`;
  }
  if (meta.type === "number") {
    return html`<input
      class="input"
      type="number"
      min=${meta.min}
      max=${meta.max}
      placeholder=${meta.placeholder || ""}
      value=${value}
      onInput=${(e) => onChange(e.currentTarget.value)}
    />`;
  }
  const listAttr = meta.key === "ProxyJump" || meta.key === "ProxyCommand" ? "host-aliases" : undefined;
  return html`<input
    class="input"
    list=${listAttr}
    placeholder=${meta.placeholder || ""}
    value=${value}
    onInput=${(e) => onChange(e.currentTarget.value)}
  />`;
}

function OptionPicker({ groups, optionsList, onPick, onClose }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      optionsList.filter(
        (o) => !query || o.key.toLowerCase().includes(query) || o.label.toLowerCase().includes(query)
      ),
    [query, optionsList]
  );
  const byGroup = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(g.id, []);
    for (const o of filtered) {
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group).push(o);
    }
    return map;
  }, [filtered, groups]);

  return html`<div class="picker" onClick=${(e) => e.stopPropagation()}>
    <input
      class="input picker__search"
      placeholder="Search options…"
      value=${q}
      autoFocus
      onInput=${(e) => setQ(e.currentTarget.value)}
      onKeyDown=${(e) => {
        if (e.key === "Escape") onClose();
      }}
    />
    ${groups.map((g) => {
      const list = byGroup.get(g.id) || [];
      if (!list.length) return null;
      return html`<div key=${g.id}>
        <div class="picker__group">${g.label}</div>
        ${list.map((o) => html`<button key=${o.key} class="picker__opt" onClick=${() => onPick(o)}>
          <code>${o.key}</code><span>${o.help}</span>
        </button>`)}
      </div>`;
    })}
    ${filtered.length === 0 && html`<div class="picker__group">No match</div>`}
  </div>`;
}

export function DirectiveEditor({ groups, byKey, optionsList, hostAliases, list, onValue, onRemove, onAdd }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const buckets = useMemo(() => {
    const map = new Map();
    for (const g of groups) map.set(g.id, []);
    const custom = [];
    for (const item of list) {
      const meta = byKey[String(item.key).toLowerCase()];
      if (meta) {
        if (!map.has(meta.group)) map.set(meta.group, []);
        map.get(meta.group).push(item);
      } else {
        custom.push(item);
      }
    }
    return { map, custom };
  }, [list, groups, byKey]);

  const renderRow = (item) => {
    const meta = byKey[String(item.key).toLowerCase()];
    return html`<div class="drow" key=${item.id}>
      <div class=${keyClass(item.key)}>
        <span>${item.key}</span>
        ${meta?.help && html`<span class="drow__help" title=${meta.help}><${IconHelp} /></span>`}
      </div>
      <div>
        <${ValueEditor} meta=${meta} value=${item.value} hostAliases=${hostAliases} onChange=${(v) => onValue(item.id, v)} />
      </div>
      <button class="icon-btn icon-btn--danger drow__remove" title="Remove option" onClick=${() => onRemove(item.id)}>
        <${IconTrash} />
      </button>
    </div>`;
  };

  return html`<div class="directives">
    ${groups.map((g) => {
      const items = buckets.map.get(g.id) || [];
      if (!items.length) return null;
      return html`<div class="dgroup" key=${g.id}>
        <div class="dgroup__title">${g.label}<span class="dgroup__hint">${g.hint}</span></div>
        ${items.map(renderRow)}
      </div>`;
    })}
    ${buckets.custom.length > 0 &&
    html`<div class="dgroup">
      <div class="dgroup__title">Custom<span class="dgroup__hint">options not in the catalog</span></div>
      ${buckets.custom.map(renderRow)}
    </div>`}

    <div class="add-row">
      <button class="add-btn" onClick=${() => setPickerOpen((v) => !v)}>
        <${IconPlus} size=${14} /> Add option
      </button>
      ${pickerOpen &&
      html`<${OptionPicker}
        groups=${groups}
        optionsList=${optionsList}
        onClose=${() => setPickerOpen(false)}
        onPick=${(o) => {
          onAdd(o.key, defaultValueFor(o));
          setPickerOpen(false);
        }}
      />`}
    </div>
  </div>`;
}
