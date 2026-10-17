// Catalog of common ssh_config options used by the UI to help write configs.
// `type` drives the input widget on the client. Structured forwarding types are
// rendered as dedicated field groups and stored as a single directive value.

export const GROUPS = [
  { id: "connection", label: "Connection", hint: "Where and how the connection is made." },
  { id: "auth", label: "Authentication", hint: "How ssh proves who you are." },
  { id: "forwarding", label: "Forwarding", hint: "Tunnels: local, remote and dynamic (SOCKS)." },
  { id: "proxy", label: "Proxy & jumps", hint: "Route the connection through another host." },
  { id: "multiplex", label: "Multiplexing", hint: "Reuse one connection for many sessions." },
  { id: "keepalive", label: "Keepalive", hint: "Keep idle sessions from being dropped." },
  { id: "security", label: "Security", hint: "Ciphers, algorithms and host key checks." },
  { id: "misc", label: "Misc", hint: "Everything else." },
];

export const OPTIONS = [
  // Connection
  { key: "HostName", group: "connection", type: "text", label: "Host name", help: "The real address (IP or domain) to connect to.", placeholder: "203.0.113.10 or host.example.com" },
  { key: "User", group: "connection", type: "text", label: "User", help: "Login name on the remote host.", placeholder: "root" },
  { key: "Port", group: "connection", type: "number", label: "Port", help: "Port to connect to on the remote host.", placeholder: "22", min: 1, max: 65535 },
  { key: "AddressFamily", group: "connection", type: "enum", label: "Address family", help: "Force IPv4, IPv6 or let ssh decide.", values: ["any", "inet", "inet6"], defaultValue: "any" },
  { key: "ConnectTimeout", group: "connection", type: "number", label: "Connect timeout", help: "Seconds to wait for the connection before giving up.", placeholder: "10", unit: "s" },
  { key: "ConnectionAttempts", group: "connection", type: "number", label: "Connection attempts", help: "How many times to retry before failing.", placeholder: "1" },
  { key: "BindAddress", group: "connection", type: "text", label: "Bind address", help: "Local address to use as the source of the connection.", placeholder: "0.0.0.0" },
  { key: "BindInterface", group: "connection", type: "text", label: "Bind interface", help: "Local network interface to bind to.", placeholder: "en0" },

  // Authentication
  { key: "IdentityFile", group: "auth", type: "path", label: "Identity file", help: "Private key to use for authentication. May be repeated.", placeholder: "~/.ssh/id_ed25519", suggest: "keyfiles" },
  { key: "IdentitiesOnly", group: "auth", type: "boolean", label: "Identities only", help: "Only use the listed identity files, ignore the agent.", defaultValue: "yes" },
  { key: "CertificateFile", group: "auth", type: "path", label: "Certificate file", help: "Certificate corresponding to a private key.", placeholder: "~/.ssh/id_ed25519-cert.pub", suggest: "files" },
  { key: "AddKeysToAgent", group: "auth", type: "enum", label: "Add keys to agent", help: "Add the key to the running ssh-agent.", values: ["yes", "no", "ask", "confirm"], defaultValue: "no" },
  { key: "ForwardAgent", group: "auth", type: "boolean", label: "Forward agent", help: "Forward the local ssh-agent to the remote host.", defaultValue: "no" },
  { key: "PasswordAuthentication", group: "auth", type: "boolean", label: "Password authentication", help: "Allow password login.", defaultValue: "no" },
  { key: "KbdInteractiveAuthentication", group: "auth", type: "boolean", label: "Keyboard-interactive", help: "Allow interactive keyboard authentication (OTP, etc.).", defaultValue: "yes" },
  { key: "PubkeyAuthentication", group: "auth", type: "boolean", label: "Public key authentication", help: "Allow public key login.", defaultValue: "yes" },
  { key: "PreferredAuthentications", group: "auth", type: "text", label: "Preferred authentications", help: "Comma-separated order of methods to try.", placeholder: "publickey,keyboard-interactive" },

  // Forwarding
  { key: "LocalForward", group: "forwarding", type: "localforward", label: "Local forward", help: "Forward a local port to a host reachable from the remote side (-L)." },
  { key: "RemoteForward", group: "forwarding", type: "remoteforward", label: "Remote forward", help: "Forward a port on the remote host back to the local side (-R)." },
  { key: "DynamicForward", group: "forwarding", type: "dynamicforward", label: "Dynamic forward", help: "Open a local SOCKS proxy (-D)." },
  { key: "GatewayPorts", group: "forwarding", type: "enum", label: "Gateway ports", help: "Allow remote forwards to bind to non-loopback addresses.", values: ["no", "yes", "clientspecified"], defaultValue: "no" },
  { key: "ExitOnForwardFailure", group: "forwarding", type: "boolean", label: "Exit on forward failure", help: "Terminate if a requested tunnel cannot be set up.", defaultValue: "no" },
  { key: "ClearAllForwardings", group: "forwarding", type: "boolean", label: "Clear all forwardings", help: "Ignore any forwarding directives (useful for scp/sftp).", defaultValue: "no" },

  // Proxy
  { key: "ProxyJump", group: "proxy", type: "proxyjump", label: "Proxy jump", help: "Connect through one or more jump hosts (bastions).", placeholder: "bastion" },
  { key: "ProxyCommand", group: "proxy", type: "text", label: "Proxy command", help: "Command that opens a connection to the server, on stdin/stdout.", placeholder: "ssh -W %h:%p bastion" },
  { key: "ProxyUseFdpass", group: "proxy", type: "boolean", label: "Proxy use fdpass", help: "ProxyCommand hands over a connected file descriptor.", defaultValue: "no" },

  // Multiplexing
  { key: "ControlMaster", group: "multiplex", type: "enum", label: "Control master", help: "Share a single network connection across sessions.", values: ["no", "yes", "ask", "auto", "autoask"], defaultValue: "auto" },
  { key: "ControlPath", group: "multiplex", type: "text", label: "Control path", help: "Socket used to share the connection.", placeholder: "~/.ssh/cm-%r@%h:%p" },
  { key: "ControlPersist", group: "multiplex", type: "text", label: "Control persist", help: "Keep the master connection open in background (time or yes/no).", placeholder: "10m" },

  // Keepalive
  { key: "ServerAliveInterval", group: "keepalive", type: "number", label: "Server alive interval", help: "Send a keepalive every N seconds.", placeholder: "60", unit: "s" },
  { key: "ServerAliveCountMax", group: "keepalive", type: "number", label: "Server alive count max", help: "Number of unanswered keepalives before disconnecting.", placeholder: "3" },
  { key: "TCPKeepAlive", group: "keepalive", type: "boolean", label: "TCP keepalive", help: "Send TCP keepalive messages.", defaultValue: "yes" },
  { key: "Compression", group: "keepalive", type: "boolean", label: "Compression", help: "Compress the connection (usually slower on fast links).", defaultValue: "no" },

  // Security
  { key: "StrictHostKeyChecking", group: "security", type: "enum", label: "Strict host key checking", help: "How to handle unknown host keys.", values: ["yes", "no", "accept-new", "ask"], defaultValue: "accept-new" },
  { key: "UserKnownHostsFile", group: "security", type: "path", label: "User known hosts file", help: "File holding trusted host keys.", placeholder: "~/.ssh/known_hosts" },
  { key: "HostKeyAlgorithms", group: "security", type: "text", label: "Host key algorithms", help: "Comma-separated host key types to accept.", placeholder: "ssh-ed25519,rsa-sha2-512" },
  { key: "Ciphers", group: "security", type: "text", label: "Ciphers", help: "Comma-separated list of ciphers to allow.", placeholder: "chacha20-poly1305@openssh.com,aes256-gcm@openssh.com" },
  { key: "MACs", group: "security", type: "text", label: "MACs", help: "Comma-separated list of message authentication codes.", placeholder: "hmac-sha2-512-etm@openssh.com" },
  { key: "KexAlgorithms", group: "security", type: "text", label: "Key exchange algorithms", help: "Comma-separated key exchange methods.", placeholder: "curve25519-sha256" },
  { key: "ForwardX11", group: "security", type: "boolean", label: "Forward X11", help: "Enable X11 forwarding.", defaultValue: "no" },
  { key: "ForwardX11Trusted", group: "security", type: "boolean", label: "Trusted X11", help: "Give remote clients full access to the local X server.", defaultValue: "no" },

  // Misc
  { key: "RemoteCommand", group: "misc", type: "text", label: "Remote command", help: "Command to run on the remote host instead of a shell.", placeholder: "tmux new -A -s main" },
  { key: "RequestTTY", group: "misc", type: "enum", label: "Request TTY", help: "How to request a pseudo-terminal.", values: ["auto", "no", "yes", "force"], defaultValue: "auto" },
  { key: "SetEnv", group: "misc", type: "text", label: "Set environment", help: "Send an environment variable to the server (Name=value).", placeholder: "LANG=en_US.UTF-8" },
  { key: "SendEnv", group: "misc", type: "text", label: "Send environment", help: "Environment variables to send to the server.", placeholder: "LANG LC_*" },
  { key: "LogLevel", group: "misc", type: "enum", label: "Log level", help: "Verbosity of ssh's own log messages.", values: ["QUIET", "FATAL", "ERROR", "INFO", "VERBOSE", "DEBUG", "DEBUG1", "DEBUG2", "DEBUG3"], defaultValue: "INFO" },
  { key: "Include", group: "misc", type: "path", label: "Include", help: "Include another configuration file.", placeholder: "~/.ssh/config.d/*", suggest: "files" },
];

export const OPTIONS_BY_KEY = new Map(OPTIONS.map((o) => [o.key.toLowerCase(), o]));

export function canonicalKey(key) {
  const found = OPTIONS_BY_KEY.get(String(key || "").toLowerCase());
  return found ? found.key : String(key || "");
}

export function optionMeta(key) {
  return OPTIONS_BY_KEY.get(String(key || "").toLowerCase()) || null;
}
