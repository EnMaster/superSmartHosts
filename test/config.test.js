import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { parse, serialize, hostAliases } from "../server/sshConfig.js";
import { buildLaunch, validateHost, normalizeDirectives } from "../server/sshCommand.js";

const SAMPLE = `# top
Include ~/.ssh/config.d/*.conf

Host web bastion-*
    HostName web.example.com
    User deploy
    # note
    LocalForward 8080 localhost:80
    ProxyJump bastion

Host bastion
    HostName 203.0.113.9
`;

test("parse keeps global and host blocks", () => {
  const model = parse(SAMPLE);
  assert.equal(model.blocks[0].type, "global");
  const hosts = model.blocks.filter((b) => b.type === "host");
  assert.equal(hosts.length, 2);
  assert.equal(hosts[0].patterns, "web bastion-*");
});

test("serialize round-trips comments and directives", () => {
  const text = serialize(parse(SAMPLE));
  assert.match(text, /# top/);
  assert.match(text, /Include ~\/\.ssh\/config\.d\/\*\.conf/);
  assert.match(text, /# note/);
  assert.match(text, /    LocalForward 8080 localhost:80/);
  assert.match(text, /Host web bastion-\*/);
  // parsing the serialized output is stable
  assert.equal(serialize(parse(text)), text);
});

test("hostAliases skips wildcard patterns", () => {
  const aliases = hostAliases(parse(SAMPLE));
  assert.deepEqual(aliases, ["web", "bastion"]);
});

test("serialize omits options with no value", () => {
  const text = serialize(parse("Host a\n    HostName\n    User bob\n"));
  assert.doesNotMatch(text, /HostName/);
  assert.match(text, /User bob/);
});

test("normalizeDirectives drops empty values", () => {
  assert.deepEqual(
    normalizeDirectives([
      { key: "HostName", value: "" },
      { key: "User", value: "bob" },
    ]),
    [{ key: "User", value: "bob" }]
  );
});

test("buildLaunch treats empty-only overrides as a plain ssh call", () => {
  const plan = buildLaunch({ host: "web", directives: [{ key: "HostName", value: "" }] });
  assert.deepEqual(plan.args, ["ssh", "web"]);
  assert.equal(plan.usedOverrides, false);
});

test("validateHost rejects unsafe aliases", () => {
  assert.equal(validateHost("web"), "web");
  assert.throws(() => validateHost("web; rm -rf /"));
  assert.throws(() => validateHost("-oProxyCommand"));
  assert.throws(() => validateHost(""));
});

test("normalizeDirectives rejects malformed option names", () => {
  assert.deepEqual(normalizeDirectives([{ key: "User", value: "root" }]), [{ key: "User", value: "root" }]);
  assert.throws(() => normalizeDirectives([{ key: "User; rm", value: "x" }]));
});

test("buildLaunch without overrides is a plain ssh call", () => {
  const plan = buildLaunch({ host: "web" });
  assert.deepEqual(plan.args, ["ssh", "web"]);
  assert.equal(plan.usedOverrides, false);
  assert.equal(plan.tempFile, null);
});

test("buildLaunch with overrides writes a temp config and includes the user config", () => {
  const plan = buildLaunch({
    host: "web",
    directives: [
      { key: "HostName", value: "10.0.0.5" },
      { key: "LocalForward", value: "8080 localhost:80" },
    ],
    mainConfigPath: "/etc/hosts",
  });
  assert.equal(plan.usedOverrides, true);
  assert.match(plan.args[0], /^ssh$/);
  assert.equal(plan.args[1], "-F");
  const generated = readFileSync(plan.tempFile, "utf8");
  const hostIdx = generated.indexOf("Host super-smart-");
  const includeIdx = generated.indexOf("Include /etc/hosts");
  assert.ok(hostIdx === 0, "host block must come first so its values win");
  assert.ok(includeIdx > hostIdx && includeIdx !== -1);
  assert.match(generated, /HostName 10\.0\.0\.5/);
  assert.match(generated, /LocalForward 8080 localhost:80/);
});
