import test from "node:test";
import assert from "node:assert/strict";
import { searchFiles, highlight } from "../public/lib/search.js";

const files = [
  {
    name: "web.conf",
    env: "prod",
    hosts: [
      {
        id: "b1",
        alias: "web-prod",
        patterns: "web-prod",
        hostname: "10.0.0.5",
        user: "deploy",
        port: "22",
        env: "prod",
        directives: [
          { key: "HostName", value: "10.0.0.5" },
          { key: "User", value: "deploy" },
        ],
      },
      {
        id: "b2",
        alias: "web-stage",
        patterns: "web-stage",
        hostname: "10.0.0.9",
        user: "deploy",
        port: "2222",
        env: "staging",
        directives: [],
      },
    ],
  },
  {
    name: "db.conf",
    env: null,
    hosts: [
      { id: "b1", alias: "db", patterns: "db", hostname: "db.internal", user: "", port: "", env: null, directives: [] },
    ],
  },
];

test("empty query returns null", () => {
  assert.equal(searchFiles(files, "   "), null);
  assert.equal(searchFiles(files, ""), null);
});

test("matches an IP across every host", () => {
  const r = searchFiles(files, "10.0.0");
  assert.equal(r.length, 1);
  assert.equal(r[0].file.name, "web.conf");
  assert.equal(r[0].hosts.length, 2);
  assert.ok(r[0].hosts.every((h) => h.match.value.startsWith("10.0.0")));
});

test("matches a file name", () => {
  const r = searchFiles(files, "db.");
  assert.ok(r.some((x) => x.file.name === "db.conf"));
});

test("matches a directive value", () => {
  const r = searchFiles(files, "deploy");
  assert.equal(r[0].file.name, "web.conf");
  assert.equal(r[0].hosts.length, 2);
  assert.equal(r[0].hosts[0].match.key, "User");
});

test("matches a port", () => {
  const r = searchFiles(files, "2222");
  assert.equal(r.length, 1);
  assert.equal(r[0].hosts.length, 1);
  assert.equal(r[0].hosts[0].match.key, "Port");
});

test("returns empty list when nothing matches", () => {
  assert.equal(searchFiles(files, "zzz-nope").length, 0);
});

test("highlight marks every occurrence case-insensitively", () => {
  assert.deepEqual(highlight("10.0.0.5", "0.0"), ["1", { hit: true, text: "0.0" }, ".0.5"]);
  assert.deepEqual(highlight("ABCabc", "abc"), [{ hit: true, text: "ABC" }, { hit: true, text: "abc" }]);
  assert.deepEqual(highlight("abc", "zzz"), ["abc"]);
  assert.deepEqual(highlight("abc", ""), ["abc"]);
});
