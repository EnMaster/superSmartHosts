# Super Smart Hosts

A small local web app to read, write and compile the SSH config files in
`~/.ssh/config.d/`, and to launch terminals with them — including quick,
unsaved edits before you connect.

It runs on your machine, binds to `127.0.0.1`, and never sends anything
anywhere.

## What it does

- **Browse and edit** every file in `~/.ssh/config.d` (any name or extension,
  just like `Include ~/.ssh/config.d/*`) — create, rename by file, delete. Files
  can hold as many `Host` blocks as you like.
- **Understands ssh**: comments and blank lines are preserved on round-trip, and
  the editor knows the common options with inline help.
- **Guided compilation**: pick options from a catalog grouped by purpose
  (connection, auth, forwarding, proxy, multiplexing, keepalive, security).
  Port forwarding is edited with structured fields instead of raw syntax:
  `LocalForward`, `RemoteForward` and `DynamicForward` become bind/destination
  fields, and `ProxyJump` suggests the aliases you already have.
- **Launch a terminal**: each host has a **Run** button that opens your default
  terminal with the connection.
- **On-the-go edits**: the Run sheet opens with the host's options, lets you
  change them, shows the exact command live, and connects — without saving
  anything to disk. Tunnels, jump hosts and every other option are fair game.
- **Templates**: start a new host from a ready-made recipe — dynamic SOCKS proxy,
  local or reverse tunnel, database tunnel, jump host, resilient session, cloud
  VM, agent forwarding and more. You can also apply a template to an existing
  host (existing values are kept).
- **Inspect effective config**: run `ssh -G` against a host to see what ssh
  actually resolves after includes and your edits, without connecting.
- **System hosts editor**: a raw editor for `/etc/hosts` (the machine's name
  resolution file). Writes are backed up automatically and, on macOS, performed
  through the standard admin-password prompt; you can restore any earlier backup.
- **Everyday conveniences**: per-host colour badge, copy `ssh`/`scp` commands,
  duplicate a host, a warning when a tunnel is malformed or `HostName` is missing,
  and <kbd>Cmd/Ctrl</kbd>+<kbd>S</kbd> to save.
- **Back up your config**: snapshot all files at once, or a single file from its
  toolbar. Backups are timestamped folders you can restore from the **Backups**
  panel.
- **Rename a file**: hover a file in the sidebar and click the pencil to rename it
  in place (<kbd>Enter</kbd> to confirm, <kbd>Esc</kbd> to cancel). Any environment
  tags and the open editor follow the new name.
- **Global search**: the sidebar box searches *everything* — file names, aliases,
  `HostName`/IPs, users, ports and any other directive value. Results are grouped
  by file with the matched text highlighted; click a hit to open the file and
  jump straight to that host.
- **Environment colours**: hosts and files whose names look like production or
  test are colour-coded from the current theme — **production uses the theme's
  primary colour, test/staging the secondary** — on the host badge and the file
  dot. Everything else stays neutral.
- **Many looks**: switch themes from the sidebar footer — from green-, amber- and
  blue-phosphor CRTs to light **Material**, **2000s** (Windows XP) and pastel
  **Kawaii**. See [Themes](#themes) for the full list.

## Finding things

The sidebar search matches across every file, not just the names:

- Type an IP (`10.0.0.`), a user, a port, an alias or part of any directive value
  and every matching host appears, grouped by file, with the match highlighted.
- Clicking a result opens the file and briefly flashes the host block, so you
  land exactly where the value lives.

## Environment colour coding

Hosts and files are colour-tagged from the active theme — **production** uses the
theme's **primary** colour, **test / staging** the **secondary** — shown on the
host badge and the file dot in the sidebar.

**You decide the environment, not the file name.** Click a host badge or a file
dot to open a small menu:

- **Automatic** (default) — guess from well-known words (`prod`, `production`,
  `prd`, `live` → production; `staging`, `stage`, `test`, `qa`, `dev`, `sandbox`,
  `uat`, `preprod`, `preview`, `demo`, … → test). `prod` wins over `test`.
- **Production** / **Test / staging** — force that colour.
- **None** — force neutral, so an auto-guessed name no longer counts.

A host override wins over a file override, which wins over the automatic guess.
The choices are saved in `~/.super-smart-hosts/environments.json` (override the
location with `SMH_ENV_DIR`) — your `.conf` files are never modified.

## Themes

Pick a theme from the **sidebar footer**. The choice is remembered in
`localStorage` and applies instantly — no reload. There are 16 presets across
two families: phosphor **CRTs** (scanlines, vignette, glow, a bitmap display
face, a blinking cursor and a tube warm-up) and flat **modern** themes (no CRT
effects, sans-serif, rounded).

**CRT phosphor**

| Theme | Look |
| --- | --- |
| **Phosphor** (default) | P1 green monochrome terminal — the classic look. |
| **Amber** | Warm amber monochrome monitor. |
| **Blue** | Cool blue phosphor. |
| **Sunburn** | Hot orange / red. |
| **Lilac** | Soft lavender (Catppuccin-ish). |
| **Violet** | Deep violet (Dracula-ish). |
| **Neon** | High-contrast yellow / cyan / pink arcade glow. |
| **Frost** | Pale icy blue. |
| **Graphite** | Neutral grayscale terminal. |
| **Grimdark** | Parchment gold on near-black. |

**Modern**

| Theme | Look |
| --- | --- |
| **Mist** | Light and clean, blue primary. |
| **Slate** | Dark navy with an indigo primary. |
| **Material** | Light, purple primary, soft elevation shadows. |
| **2000s** | Windows XP "Luna" — grey faces, blue chrome, green buttons, Tahoma. |
| **Kawaii** | Pastel pink & lavender, pill-shaped buttons, a `♡` by the logo. |
| **Plain** | Flat black & white, square, every effect off — the cheapest render. |

Because every theme only re-points the design tokens, colours, the environment
coding, search highlights and every component follow the active palette
automatically.

## Requirements

- Node.js 18+ (tested on 24)
- `ssh` on your `PATH`
- For launching: Terminal.app or iTerm2 on macOS, or a common terminal emulator
  on Linux (`gnome-terminal`, `konsole`, `kitty`, `alacritty`, `xterm`, …)

## Run it

```sh
npm install
npm start
```

Then open <http://127.0.0.1:4317>. To open the browser automatically use the
bin entry:

```sh
npx super-smart-hosts        # installed via `npm link`
# or
node server/cli.js
```

## Make ssh read these files

Super Smart Hosts manages every file in `~/.ssh/config.d` (any name or extension),
but ssh only reads them if your main config includes them. If the sidebar shows a
warning, add this line to `~/.ssh/config`:

```sshconfig
Include ~/.ssh/config.d/*
```

The `*` matches `.conf`, `.config` and files with no extension alike. Super Smart
Hosts checks this for you and warns when it is missing.

## Configuration

All optional, via environment variables (see [`.env.example`](.env.example)):

| Variable                  | Default              | Meaning                                  |
| ------------------------- | -------------------- | ---------------------------------------- |
| `PORT`                    | `4317`               | HTTP port                                |
| `HOST`                    | `127.0.0.1`          | Bind address (keep it on loopback)       |
| `SMH_DIR`                 | `~/.ssh/config.d`    | Directory of config files                |
| `SMH_MAIN`                | `~/.ssh/config`      | Main config used for the include check   |
| `SMH_TERMINAL`            | `auto`               | `auto`, `iterm`, `terminal`, `system`    |
| `SMH_NO_OPEN`             | unset                | Do not open a browser on start (CLI)     |
| `SMH_HOSTS`               | `/etc/hosts`         | Path of the system hosts file to edit    |
| `SMH_HOSTS_PRIVILEGED`    | auto                 | Force privileged host writes: `1`/`0`    |
| `SMH_BACKUP_DIR`          | `~/.super-smart-hosts/backups` | Where hosts-file backups are stored |
| `SMH_CONFIG_BACKUP_DIR`   | `~/.super-smart-hosts/config-backups` | Where config-file backups are stored |
| `SMH_ENV_DIR`             | `~/.super-smart-hosts` | Where manual environment tags are stored |

Load them from a file with `node --env-file=.env server/index.js` (Node ≥ 20.6).

## Editing the system hosts file

The sidebar's **System hosts** button opens a raw editor for `/etc/hosts`.

- Saving first copies the current file into the backup directory, then writes the
  new content atomically. Whitespace-only content is rejected.
- On macOS the write is done as root through `osascript … with administrator
  privileges`, so you get the normal password dialog. On Linux the server uses
  `sudo -n` (configure passwordless `sudo` for the server user).
- The side panel lists recent backups; click one to restore it (the current file
  is backed up again first).
- Set `SMH_HOSTS` to point at another file (useful for testing) — writes to a
  non-`/etc/hosts` path are done directly, without a password.

## Backing up your config

Every config file can be snapshotted to the config backup directory, each
snapshot its own timestamped folder.

- **All files**: the archive button in the sidebar's file header, or **Back up
  all files** in the **Backups** panel.
- **One file**: the **Back up** button in the toolbar of the open file.
- The **Backups** panel (sidebar) lists snapshots with their files, size and age;
  **Restore** copies them back over the live files.

## How launching works

- Nothing changed in the Run sheet → `ssh <alias>`, resolved through your own
  config exactly as you would type it.
- You changed options → Super Smart Hosts writes a **throw-away** config to the OS temp
  directory that pins the connection to a synthetic alias, then re-includes your
  real config for global settings and jump hosts. It is launched with
  `ssh -F <tempfile> <synthetic>` and never saved to `config.d`. Temp files are
  pruned after a day.

## Security notes

- The server binds to `127.0.0.1` by default and executes `ssh` locally. Do not
  expose it to a network.
- File names are validated and confined to the config directory.
- State-changing requests from another origin are rejected, so a random web page
  cannot drive the local API.
- Option names are validated and every value is shell-quoted before a terminal
  is asked to run it.

## Tests

```sh
npm test
```

## Project layout

```
server/
  index.js       Express app and JSON API
  sshConfig.js   parser / serializer for ssh config files
  options.js     catalog of ssh options that powers the UI
  sshCommand.js  builds the ssh invocation (incl. temp override config)
  launcher.js    opens the native terminal
  hostsFile.js   reads/writes the system hosts file (+ backups)
  configBackup.js snapshots config files to a backup folder
  environments.js stores manual production/test tags per file and host
  cli.js         bin entry
public/
  index.html     import map + fonts
  app.js         application shell and state
  styles.css     design system
  lib/           api client, formatting, search and environment helpers
  components/    sidebar, host cards, option editor, run sheet
test/            parser, launcher, search and environment tests
```
