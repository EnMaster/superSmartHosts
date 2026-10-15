async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  config: () => req("GET", "/api/config"),
  options: () => req("GET", "/api/options"),
  listFiles: () => req("GET", "/api/files"),
  readFile: (name) => req("GET", `/api/files/${encodeURIComponent(name)}`),
  createFile: (name, sample = true) => req("POST", "/api/files", { name, sample }),
  saveFile: (name, payload) => req("PUT", `/api/files/${encodeURIComponent(name)}`, payload),
  deleteFile: (name) => req("DELETE", `/api/files/${encodeURIComponent(name)}`),
  hosts: () => req("GET", "/api/hosts"),
  parse: (text) => req("POST", "/api/parse", { text }),
  serialize: (model) => req("POST", "/api/serialize", { model }),
  preview: (host, directives) => req("POST", "/api/preview", { host, directives }),
  resolve: (host, directives) => req("POST", "/api/resolve", { host, directives }),
  launch: (host, directives) => req("POST", "/api/launch", { host, directives }),
  hostsFile: () => req("GET", "/api/hosts-file"),
  saveHostsFile: (text) => req("PUT", "/api/hosts-file", { text }),
  hostsBackups: () => req("GET", "/api/hosts-file/backups"),
  restoreHostsBackup: (name) => req("POST", "/api/hosts-file/restore", { name }),
};
