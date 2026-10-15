import { canonicalKey } from "./options.js";

// Model
// -----
// A file is an ordered list of blocks.
//   { type: 'global' | 'host' | 'match', header, patterns, items: Item[] }
// Items inside a block keep their original order so directives (where ssh uses
// the first value found) and comments round-trip faithfully.
//   Item = { kind: 'directive', key, value } | { kind: 'comment', text } | { kind: 'blank' }

const HEADER_RE = /^(host|match)\b\s*(.*)$/i;
const DIRECTIVE_RE = /^([A-Za-z][A-Za-z0-9-]*)\s*(?:=\s*)?(.*)$/;

let uid = 0;
function nextId() {
  uid += 1;
  return `b${uid}`;
}

export function parse(text) {
  const blocks = [];
  let current = { id: nextId(), type: "global", header: "", patterns: "", items: [] };
  blocks.push(current);

  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  // A trailing newline yields a final empty element; keep it as a blank line
  // only if the file is non-empty.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      current.items.push({ kind: "blank" });
      continue;
    }
    if (trimmed.startsWith("#")) {
      current.items.push({ kind: "comment", text: trimmed });
      continue;
    }

    const header = trimmed.match(HEADER_RE);
    if (header) {
      const type = header[1].toLowerCase();
      current = {
        id: nextId(),
        type,
        header: type === "host" ? "Host" : "Match",
        patterns: header[2].trim(),
        items: [],
      };
      blocks.push(current);
      continue;
    }

    const dir = trimmed.match(DIRECTIVE_RE);
    if (dir) {
      current.items.push({ kind: "directive", key: canonicalKey(dir[1]), value: dir[2].trim() });
    } else {
      // Unparseable line: keep it verbatim so we never lose user content.
      current.items.push({ kind: "comment", text: rawLine, raw: true });
    }
  }

  return { blocks };
}

const INDENT = "    ";

export function serialize(model) {
  const blocks = model?.blocks ?? [];
  const out = [];

  blocks.forEach((block, index) => {
    if (block.type !== "global") {
      if (index > 0 && out.length && out[out.length - 1] !== "") out.push("");
      out.push(block.patterns ? `${block.header} ${block.patterns}` : block.header);
    }
    for (const item of block.items) {
      if (item.kind === "blank") {
        out.push("");
      } else if (item.kind === "comment") {
        out.push(item.raw ? item.text : `${INDENT}${item.text}`);
      } else {
        // ssh rejects a keyword with no argument, so empty options are simply
        // left out until they get a value.
        if (String(item.value).trim() === "") continue;
        const indent = block.type === "global" ? "" : INDENT;
        out.push(`${indent}${item.key} ${item.value}`.trimEnd());
      }
    }
  });

  // Collapse runs of 3+ blank lines to at most 2 and ensure a single final newline.
  const collapsed = [];
  let blanks = 0;
  for (const line of out) {
    if (line === "") {
      blanks += 1;
      if (blanks > 2) continue;
    } else {
      blanks = 0;
    }
    collapsed.push(line);
  }
  while (collapsed.length && collapsed[0] === "") collapsed.shift();
  while (collapsed.length && collapsed[collapsed.length - 1] === "") collapsed.pop();

  return collapsed.join("\n") + "\n";
}

// Extract the alias list from every Host block (skip wildcard patterns).
export function hostAliases(model) {
  const aliases = [];
  for (const block of model?.blocks ?? []) {
    if (block.type !== "host") continue;
    for (const pattern of block.patterns.split(/\s+/)) {
      if (!pattern || pattern.includes("*") || pattern.includes("?") || pattern.includes("!")) continue;
      aliases.push(pattern);
    }
  }
  return aliases;
}

// Flatten a host block into a map-ish list of directives, keeping duplicates.
export function directivesOf(block) {
  return (block?.items ?? []).filter((i) => i.kind === "directive");
}

export function makeHostBlock(patterns = "new-host") {
  return {
    id: nextId(),
    type: "host",
    header: "Host",
    patterns,
    items: [
      { kind: "directive", key: "HostName", value: "" },
      { kind: "directive", key: "User", value: "" },
    ],
  };
}

export function newBlockId() {
  return nextId();
}
