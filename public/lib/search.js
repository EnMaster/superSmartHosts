// Global search over the file index produced by GET /api/files.
// Matches the file name and any host field (alias/pattern, HostName, User,
// Port, or any other directive value) — so searching an IP finds every host
// that uses it.

function matchHost(host, q) {
  const fields = [
    { key: "Host", value: host.patterns },
    { key: "HostName", value: host.hostname },
    { key: "User", value: host.user },
    { key: "Port", value: host.port },
    ...(host.directives || []).map((d) => ({ key: d.key, value: d.value })),
  ];
  for (const f of fields) {
    if (f.value && String(f.value).toLowerCase().includes(q)) return f;
  }
  return null;
}

export function searchFiles(files, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  const results = [];
  for (const file of files) {
    const nameMatch = file.name.toLowerCase().includes(q);
    const hosts = [];
    for (const host of file.hosts || []) {
      const match = matchHost(host, q);
      if (match) hosts.push({ ...host, match });
    }
    if (nameMatch || hosts.length) results.push({ file, nameMatch, hosts });
  }
  return results;
}

// Split `text` into parts, marking each case-insensitive occurrence of `query`.
// Returns an array of strings and `{ hit, text }` objects.
export function highlight(text, query) {
  const str = String(text ?? "");
  const q = String(query || "").trim();
  if (!q) return [str];
  const lower = str.toLowerCase();
  const lq = q.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < str.length) {
    const at = lower.indexOf(lq, i);
    if (at === -1) {
      parts.push(str.slice(i));
      break;
    }
    if (at > i) parts.push(str.slice(i, at));
    parts.push({ hit: true, text: str.slice(at, at + q.length) });
    i = at + q.length;
  }
  return parts;
}
