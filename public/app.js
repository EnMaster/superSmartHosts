import { html, render, useState, useEffect, useCallback, useMemo } from "preact";
import { api } from "./lib/api.js";
import { uuid, isMulti } from "./lib/format.js";
import { THEMES, DEFAULT_THEME } from "./lib/themes.js";
import { Sidebar } from "./components/Sidebar.js";
import { HostCard } from "./components/HostCard.js";
import { DirectiveEditor } from "./components/DirectiveRows.js";
import { LaunchSheet } from "./components/LaunchSheet.js";
import { TemplateSheet } from "./components/TemplateSheet.js";
import { InspectSheet } from "./components/InspectSheet.js";
import { HostsFileSheet } from "./components/HostsFileSheet.js";
import { BackupsSheet } from "./components/BackupsSheet.js";
import { EnvMenu } from "./components/EnvMenu.js";
import { Toasts } from "./components/Toasts.js";
import { IconPlus, IconSave, IconCode, IconRoute, IconClose, IconTemplate, IconArchive } from "./components/icons.js";

function directiveItems(directives) {
  return directives.map((d) => ({ kind: "directive", key: d.key, value: d.value }));
}

function insertDirective(items, key, value) {
  const next = [...items];
  let insertAt = next.length;
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].kind === "directive") {
      insertAt = i + 1;
      break;
    }
  }
  next.splice(insertAt, 0, { kind: "directive", key, value });
  return next;
}

function newHostBlock(patterns = "new-host") {
  return {
    id: uuid(),
    type: "host",
    header: "Host",
    patterns,
    items: [
      { kind: "directive", key: "HostName", value: "" },
      { kind: "directive", key: "User", value: "" },
    ],
  };
}

function NewFileDialog({ configDir, onClose, onCreate }) {
  const [name, setName] = useState("");
  const valid = /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name.trim());
  const submit = (e) => {
    e.preventDefault();
    if (valid) onCreate(name.trim());
  };
  return html`<div class="overlay" onClick=${onClose}>
    <div class="sheet" style="width:min(460px,100%)" onClick=${(e) => e.stopPropagation()}>
      <div class="sheet__head">
        <${IconRoute} />
        <div style="flex:1">
          <div class="sheet__title">New config file</div>
          <div class="sheet__sub">${configDir}/</div>
        </div>
        <button class="icon-btn" onClick=${onClose}><${IconClose} /></button>
      </div>
      <form onSubmit=${submit}>
        <div class="sheet__body">
          <label class="mono" style="font-size:12px;color:var(--dim)">File name</label>
          <input
            class="input"
            style="margin-top:6px"
            placeholder="work.conf"
            value=${name}
            autoFocus
            onInput=${(e) => setName(e.currentTarget.value)}
          />
          <p class="muted" style="font-size:12px;margin:8px 0 0">
            Letters, digits, dot, dash and underscore. Any extension or none — ssh reads every name matching
            <code>config.d/*</code>.
          </p>
        </div>
        <div class="sheet__foot">
          <div class="spacer"></div>
          <button type="button" class="btn" onClick=${onClose}>Cancel</button>
          <button type="submit" class="btn btn--primary" disabled=${!valid}>
            <${IconPlus} /> Create
          </button>
        </div>
      </form>
    </div>
  </div>`;
}

function App() {
  const [config, setConfig] = useState(null);
  const [groups, setGroups] = useState([]);
  const [optionsList, setOptionsList] = useState([]);
  const [byKey, setByKey] = useState({});
  const [hostAliases, setHostAliases] = useState([]);

  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState(null);
  const [model, setModel] = useState(null);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [launch, setLaunch] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [hostsOpen, setHostsOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [focusHost, setFocusHost] = useState(null);
  const [envMenu, setEnvMenu] = useState(null);
  const [renamingName, setRenamingName] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("smh.theme");
      return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("smh.theme", theme);
    } catch {}
  }, [theme]);

  const toast = useCallback((t) => {
    const id = uuid();
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshFiles = useCallback(async () => {
    const res = await api.listFiles();
    setFiles(res.files);
    return res.files;
  }, []);

  const refreshHosts = useCallback(async () => {
    const res = await api.hosts();
    setHostAliases(res.hosts.map((h) => h.alias));
  }, []);

  const selectFile = useCallback(
    async (name, hostId = null) => {
      try {
        const res = await api.readFile(name);
        setSelectedName(name);
        setModel(res.model);
        setText(res.text);
        setDirty(false);
        setRawMode(false);
        setLaunch(null);
        setFocusHost(hostId);
      } catch (err) {
        toast({ kind: "err", title: "Could not open file", msg: err.message });
      }
    },
    [toast]
  );

  useEffect(() => {
    (async () => {
      try {
        const [cfg, opts] = await Promise.all([api.config(), api.options()]);
        setConfig(cfg);
        setGroups(opts.groups);
        setOptionsList(opts.options);
        setByKey(Object.fromEntries(opts.options.map((o) => [o.key.toLowerCase(), o])));
        const list = await refreshFiles();
        await refreshHosts();
        if (list.length) await selectFile(list[0].name);
      } catch (err) {
        setLoadError(err.message);
      }
    })();
  }, [refreshFiles, refreshHosts, selectFile]);

  // ---- model mutations ----
  const mutate = (fn) => {
    setModel((m) => fn(m));
    setDirty(true);
  };
  const updateBlock = (id, fn) => mutate((m) => ({ ...m, blocks: m.blocks.map((b) => (b.id === id ? fn(b) : b)) }));

  const handlers = {
    pattern: (id, value) => updateBlock(id, (b) => ({ ...b, patterns: value })),
    value: (id, index, value) =>
      updateBlock(id, (b) => ({ ...b, items: b.items.map((it, i) => (i === index && it.kind === "directive" ? { ...it, value } : it)) })),
    remove: (id, index) => updateBlock(id, (b) => ({ ...b, items: b.items.filter((_, i) => i !== index) })),
    add: (id, key, value) => updateBlock(id, (b) => ({ ...b, items: insertDirective(b.items, key, value) })),
    deleteBlock: (id) => mutate((m) => ({ ...m, blocks: m.blocks.filter((b) => b.id !== id) })),
    addHost: () => mutate((m) => ({ ...m, blocks: [...m.blocks, newHostBlock()] })),
    duplicateBlock: (id) =>
      mutate((m) => {
        const idx = m.blocks.findIndex((b) => b.id === id);
        if (idx === -1) return m;
        const src = m.blocks[idx];
        const firstAlias = src.patterns.split(/\s+/)[0] || "host";
        const clone = {
          id: uuid(),
          type: src.type,
          header: src.header,
          patterns: `${firstAlias}-copy`,
          items: src.items.map((it) => ({ ...it })),
        };
        const blocks = [...m.blocks];
        blocks.splice(idx + 1, 0, clone);
        return { ...m, blocks };
      }),
    applyTemplate: (id, tpl) =>
      mutate((m) => ({
        ...m,
        blocks: m.blocks.map((b) => {
          if (b.id !== id) return b;
          let items = [...b.items];
          for (const d of tpl.directives) {
            if (String(d.value).trim() === "") continue;
            const at = items.findIndex((it) => it.kind === "directive" && it.key.toLowerCase() === d.key.toLowerCase());
            if (at === -1) items = insertDirective(items, d.key, d.value);
            else if (!isMulti(d.key)) items = items.map((it, i) => (i === at ? { ...it, value: d.value } : it));
            else items = insertDirective(items, d.key, d.value);
          }
          return { ...b, items };
        }),
      })),
    addFromTemplate: (tpl) =>
      mutate((m) => ({
        ...m,
        blocks: [
          ...m.blocks,
          { id: uuid(), type: "host", header: "Host", patterns: tpl.patterns, items: directiveItems(tpl.directives) },
        ],
      })),
  };

  // ---- file ops ----
  const save = async () => {
    if (!selectedName) return;
    setSaving(true);
    try {
      const res = await api.saveFile(selectedName, rawMode ? { text } : { model });
      setModel(res.model);
      setText(res.text);
      setDirty(false);
      await Promise.all([refreshFiles(), refreshHosts()]);
      toast({ kind: "ok", title: "Saved", msg: selectedName });
    } catch (err) {
      toast({ kind: "err", title: "Save failed", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const createFile = async (name) => {
    try {
      await api.createFile(name);
      setNewFileOpen(false);
      await refreshFiles();
      await selectFile(name);
      toast({ kind: "ok", title: "File created", msg: name });
    } catch (err) {
      toast({ kind: "err", title: "Could not create file", msg: err.message });
    }
  };

  const backupAll = async () => {
    try {
      const res = await api.backupAll();
      toast({ kind: "ok", title: "Backed up all files", msg: `${res.files.length} file${res.files.length === 1 ? "" : "s"}` });
    } catch (err) {
      toast({ kind: "err", title: "Backup failed", msg: err.message });
    }
  };

  const backupCurrent = async () => {
    if (!selectedName) return;
    try {
      const res = await api.backupFile(selectedName);
      toast({ kind: "ok", title: "File backed up", msg: res.files[0] });
    } catch (err) {
      toast({ kind: "err", title: "Backup failed", msg: err.message });
    }
  };

  const openEnvMenu = useCallback((spec) => {
    const r = spec.el.getBoundingClientRect();
    const width = 216;
    const height = 210;
    const x = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const y = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - height - 8));
    setEnvMenu({ scope: spec.scope, name: spec.name, hostKey: spec.hostKey, current: spec.current, autoEnv: spec.autoEnv, x, y });
  }, []);

  const pickEnv = async (value) => {
    const spec = envMenu;
    setEnvMenu(null);
    if (!spec) return;
    try {
      if (spec.scope === "file") await api.setFileEnvironment(spec.name, value);
      else await api.setHostEnvironment(spec.name, spec.hostKey, value);
      await refreshFiles();
      const label = value === "auto" ? "automatic" : value === "prod" ? "production" : value === "staging" ? "test / staging" : "none";
      toast({ kind: "ok", title: `${spec.scope === "file" ? "File" : "Host"} environment: ${label}`, msg: spec.scope === "host" ? spec.hostKey : spec.name });
    } catch (err) {
      toast({ kind: "err", title: "Could not set environment", msg: err.message });
    }
  };

  const renameFileTo = async (from, to) => {
    setRenamingName(null);
    const clean = String(to || "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(clean) || clean === from) return;
    try {
      await api.renameFile(from, clean);
      await refreshFiles();
      await refreshHosts();
      if (selectedName === from) setSelectedName(clean);
      toast({ kind: "ok", title: "Renamed", msg: `${from} → ${clean}` });
    } catch (err) {
      toast({ kind: "err", title: "Could not rename", msg: err.message });
    }
  };

  const deleteFile = async (name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const wasSelected = name === selectedName;
    const remaining = files.filter((f) => f.name !== name);
    try {
      await api.deleteFile(name);
      setFiles(remaining);
      await refreshHosts();
      if (wasSelected) {
        if (remaining.length) await selectFile(remaining[0].name);
        else {
          setSelectedName(null);
          setModel(null);
          setText("");
          setDirty(false);
        }
      }
      toast({ kind: "ok", title: "Deleted", msg: name });
    } catch (err) {
      toast({ kind: "err", title: "Could not delete", msg: err.message });
    }
  };

  const toggleRaw = async () => {
    try {
      if (!rawMode) {
        const { text: out } = await api.serialize(model);
        setText(out);
        setRawMode(true);
      } else {
        const { model: parsed } = await api.parse(text);
        setModel(parsed);
        setRawMode(false);
      }
    } catch (err) {
      toast({ kind: "err", title: "Could not switch view", msg: err.message });
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && selectedName) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, selectedName, model, text, rawMode]);

  const globalBlock = useMemo(() => model?.blocks.find((b) => b.type === "global"), [model]);
  const hostBlocks = useMemo(() => (model?.blocks || []).filter((b) => b.type !== "global"), [model]);
  const fileIndex = useMemo(() => files.find((f) => f.name === selectedName) || null, [files, selectedName]);
  const fileEnvOverride = fileIndex?.envOverride || "auto";

  if (loadError) {
    return html`<div class="empty">
      <div class="empty__inner">
        <div class="empty__mark"><${IconRoute} size=${28} /></div>
        <h2>Cannot reach the server</h2>
        <p>${loadError}</p>
      </div>
    </div>`;
  }

  return html`<div class="app">
    <${Sidebar}
      config=${config}
      files=${files}
      selectedName=${selectedName}
      dirtyName=${dirty ? selectedName : null}
      renamingName=${renamingName}
      search=${search}
      onSearch=${setSearch}
      onSelect=${(name, hostId) => {
        if (name !== selectedName && dirty && !confirm("Discard unsaved changes?")) return;
        selectFile(name, hostId ?? null);
      }}
      onCreate=${() => setNewFileOpen(true)}
      onDelete=${deleteFile}
      onStartRename=${(name) => setRenamingName(name)}
      onRename=${renameFileTo}
      onCancelRename=${() => setRenamingName(null)}
      onOpenHosts=${() => setHostsOpen(true)}
      onOpenBackups=${() => setBackupsOpen(true)}
      onBackupAll=${backupAll}
      onOpenEnvMenu=${openEnvMenu}
      theme=${theme}
      onTheme=${setTheme}
    />

    <main class="main">
      ${selectedName
        ? html`<div class="topbar">
            <div class="topbar__title">
              <span class="topbar__path">${config?.configDir}/</span>
              <span class="topbar__name">
                ${selectedName}${dirty ? html`<span class="dirty-dot" title="Unsaved changes"></span>` : null}
              </span>
            </div>
            <div class="topbar__spacer"></div>
            <button class="btn btn--ghost" onClick=${toggleRaw} title="Edit the raw text">
              <${IconCode} /> ${rawMode ? "Form view" : "Raw"}
            </button>
            <button class="btn btn--ghost" onClick=${backupCurrent} title="Back up this file">
              <${IconArchive} /> Back up
            </button>
            <button class="btn btn--primary" disabled=${saving || !dirty} onClick=${save}>
              <${IconSave} /> ${saving ? "Saving…" : "Save"}
            </button>
          </div>`
        : null}

      <div class="content">
        ${!selectedName
          ? html`<div class="empty">
              <div class="empty__inner">
                <div class="empty__mark"><${IconRoute} size=${30} /></div>
                <h2>${files.length ? "Pick a file to start" : "No config files yet"}</h2>
                <p>
                  ${files.length
                    ? "Select a file from the sidebar, or create a new one."
                    : "Create your first config file in " + (config?.configDir || "~/.ssh/config.d") + "."}
                </p>
                <button class="btn btn--primary" onClick=${() => setNewFileOpen(true)}><${IconPlus} /> New config file</button>
              </div>
            </div>`
          : html`<div class="content--narrow">
              ${rawMode
                ? html`<textarea
                    class="raw"
                    spellcheck=${false}
                    value=${text}
                    onInput=${(e) => {
                      setText(e.currentTarget.value);
                      setDirty(true);
                    }}
                  ></textarea>`
                : html`<div>
                    ${globalBlock && globalBlock.items.some((it) => it.kind === "directive")
                      ? html`<section class="filelevel">
                          <div class="filelevel__title">file defaults · applied to every host in this file</div>
                          <${DirectiveEditor}
                            groups=${groups}
                            byKey=${byKey}
                            optionsList=${optionsList}
                            hostAliases=${hostAliases}
                            list=${globalBlock.items
                              .map((it, index) => ({ it, index }))
                              .filter(({ it }) => it.kind === "directive")
                              .map(({ it, index }) => ({ id: `${globalBlock.id}:${index}`, index, key: it.key, value: it.value }))}
                            onValue=${(id, value) => handlers.value(globalBlock.id, Number(id.split(":")[1]), value)}
                            onRemove=${(id) => handlers.remove(globalBlock.id, Number(id.split(":")[1]))}
                            onAdd=${(key, value) => handlers.add(globalBlock.id, key, value)}
                          />
                        </section>`
                      : null}

                    ${hostBlocks.map((block) => {
                      const idxHost = fileIndex?.hosts?.find((h) => h.id === block.id);
                      return html`<${HostCard}
                        key=${block.id}
                        block=${block}
                        groups=${groups}
                        byKey=${byKey}
                        optionsList=${optionsList}
                        hostAliases=${hostAliases}
                        onPattern=${(v) => handlers.pattern(block.id, v)}
                        onValue=${(index, v) => handlers.value(block.id, index, v)}
                        onRemove=${(index) => handlers.remove(block.id, index)}
                        onAdd=${(key, v) => handlers.add(block.id, key, v)}
                        onDelete=${() => handlers.deleteBlock(block.id)}
                        onRun=${(alias, directives) => setLaunch({ alias, directives })}
                        onDuplicate=${() => handlers.duplicateBlock(block.id)}
                        onApplyTemplate=${() => setTpl({ mode: "apply", blockId: block.id, alias: block.patterns.split(/\s+/)[0] || "host" })}
                        onInspect=${() => setInspect({ alias: block.patterns.split(/\s+/)[0] || "host", directives: block.items.filter((it) => it.kind === "directive").map((it) => ({ key: it.key, value: it.value })) })}
                        onToast=${toast}
                        fileName=${selectedName}
                        envOverride=${idxHost?.envOverride || "auto"}
                        fileEnvOverride=${fileEnvOverride}
                        onOpenEnvMenu=${openEnvMenu}
                        focus=${focusHost === block.id}
                        onFocusHandled=${() => setFocusHost(null)}
                      />`;
                    })}

                    <div class="content-actions">
                      <button class="add-btn" onClick=${handlers.addHost}>
                        <${IconPlus} size=${14} /> Add host
                      </button>
                      <button class="add-btn" onClick=${() => setTpl({ mode: "new" })}>
                        <${IconTemplate} size=${14} /> From template
                      </button>
                    </div>
                  </div>`}
            </div>`}
      </div>
    </main>

    <datalist id="host-aliases">
      ${hostAliases.map((a) => html`<option value=${a}></option>`)}
    </datalist>

    ${launch &&
    html`<${LaunchSheet}
      alias=${launch.alias}
      initialDirectives=${launch.directives}
      groups=${groups}
      byKey=${byKey}
      optionsList=${optionsList}
      hostAliases=${hostAliases}
      onClose=${() => setLaunch(null)}
      onToast=${toast}
    />`}

    ${newFileOpen &&
    html`<${NewFileDialog} configDir=${config?.configDir || "~/.ssh/config.d"} onClose=${() => setNewFileOpen(false)} onCreate=${createFile} />`}

    ${tpl &&
    html`<${TemplateSheet}
      mode=${tpl.mode}
      targetAlias=${tpl.alias}
      onClose=${() => setTpl(null)}
      onPick=${(t) => {
        if (tpl.mode === "new") {
          handlers.addFromTemplate(t);
          toast({ kind: "ok", title: `Added ${t.patterns}`, msg: `from “${t.name}”` });
        } else {
          handlers.applyTemplate(tpl.blockId, t);
          toast({ kind: "ok", title: `Template applied`, msg: `${t.name} → ${tpl.alias}` });
        }
        setTpl(null);
      }}
    />`}

    ${inspect &&
    html`<${InspectSheet} alias=${inspect.alias} directives=${inspect.directives} onClose=${() => setInspect(null)} />`}

    ${hostsOpen && html`<${HostsFileSheet} onClose=${() => setHostsOpen(false)} onToast=${toast} />`}

    ${backupsOpen &&
    html`<${BackupsSheet} onClose=${() => setBackupsOpen(false)} onToast=${toast} onChanged=${async () => { await refreshFiles(); await refreshHosts(); }} />`}

    <${Toasts} toasts=${toasts} onDismiss=${(id) => setToasts((p) => p.filter((x) => x.id !== id))} />

    ${envMenu &&
    html`<${EnvMenu}
      x=${envMenu.x}
      y=${envMenu.y}
      current=${envMenu.current}
      autoEnv=${envMenu.autoEnv}
      scope=${envMenu.scope}
      onPick=${pickEnv}
      onClose=${() => setEnvMenu(null)}
    />`}
  </div>`;
}

render(html`<${App} />`, document.getElementById("root"));
