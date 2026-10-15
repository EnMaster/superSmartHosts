# Super Smart Hosts

A small local web app to read, write and compile the SSH config files in
`~/.ssh/config.d/`, and to launch terminals with them — including quick,
unsaved edits before you connect.

It runs on your machine, binds to `127.0.0.1`, and never sends anything
anywhere.

## What it does

- **Browse and edit** every `*.conf` file in `~/.ssh/config.d` (create, rename by
  file, delete). Files can hold as many `Host` blocks as you like.
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
- **Phosphor look**: the whole thing is dressed as a green P1-phosphor CRT
  terminal — scanlines, vignette, a bitmap display face and a warmed-up tube.

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

Super Smart Hosts writes to `~/.ssh/config.d/*.conf`, but ssh only reads them if your
main config includes them. If the sidebar shows a warning, add this line to
`~/.ssh/config`:

```sshconfig
Include ~/.ssh/config.d/*.conf
```

Super Smart Hosts checks this for you and warns when it is missing.

## Configuration

All optional, via environment variables (see [`.env.example`](.env.example)):

| Variable                  | Default              | Meaning                                  |
| ------------------------- | -------------------- | ---------------------------------------- |
| `PORT`                    | `4317`               | HTTP port                                |
| `HOST`                    | `127.0.0.1`          | Bind address (keep it on loopback)       |
| `SMH_DIR`                 | `~/.ssh/config.d`    | Directory of `.conf` files               |
| `SMH_MAIN`                | `~/.ssh/config`      | Main config used for the include check   |
| `SMH_TERMINAL`            | `auto`               | `auto`, `iterm`, `terminal`, `system`    |
| `SMH_NO_OPEN`             | unset                | Do not open a browser on start (CLI)     |
| `SMH_HOSTS`               | `/etc/hosts`         | Path of the system hosts file to edit    |
| `SMH_HOSTS_PRIVILEGED`    | auto                 | Force privileged host writes: `1`/`0`    |
| `SMH_BACKUP_DIR`          | `~/.super-smart-hosts/backups` | Where hosts-file backups are stored |

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
  cli.js         bin entry
public/
  index.html     import map + fonts
  app.js         application shell and state
  styles.css     design system
  lib/           api client, formatting helpers
  components/    sidebar, host cards, option editor, run sheet
test/            parser and launcher tests
```
