import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeProject } from "../src/write.js";
import { supportedNode, validateProject } from "../src/validate.js";

test("Node requirement rejects 22.12 and accepts 22.13 or newer", () => {
  assert.equal(supportedNode("22.12.0"), false);
  assert.equal(supportedNode("22.13.0"), true);
  assert.equal(supportedNode("24.0.0"), true);
});

test("output refuses existing files, traversal and symlink ancestors", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc2agent-write-"));
  try {
    const out = join(root, "output");
    await writeProject(out, new Map([["bot/instructions.md", "original"]]));
    await assert.rejects(writeProject(out, new Map([["bot/instructions.md", "overwrite"]])), /already exists/);
    assert.equal(await readFile(join(out, "bot/instructions.md"), "utf8"), "original");
    await assert.rejects(writeProject(join(root, "bad"), new Map([["../escape", "x"]])), /Unsafe/);
    await symlink(out, join(root, "link"));
    await assert.rejects(writeProject(join(root, "link", "nested"), new Map([["ok", "x"]])), /symlinks/);
    assert.equal((await readdir(root)).some(s => s.startsWith(".cc2agent-")), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("validator summarizes structured diagnostics without echoing untrusted output", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc2agent-validation-"));
  try {
    const cli = join(root, "agent-sdk");
    await writeFile(cli, `#!/usr/bin/env node\nconsole.log(JSON.stringify({version:1,ok:true,agents:[{slug:"test",diagnostics:[{severity:"warning",message:"SYNTHETIC_PRIVATE_VALUE"}]}]}));\n`);
    await chmod(cli, 0o755);
    const result = await validateProject(root, cli);
    assert.equal(result.status, "passed");
    assert.match(result.message, /1 warnings/);
    assert.equal(JSON.stringify(result).includes("SYNTHETIC_PRIVATE_VALUE"), false);
    await writeFile(cli, `#!/usr/bin/env node\nconsole.log("raw untrusted log");\n`);
    assert.equal((await validateProject(root, cli)).status, "failed");
    await writeFile(cli, `#!/usr/bin/env node\nconsole.log(JSON.stringify({ok:true,agents:[]}));\n`);
    assert.equal((await validateProject(root, cli)).status, "failed");
    await writeFile(cli, `#!/usr/bin/env node\nconsole.log("false");\n`);
    assert.equal((await validateProject(root, cli)).status, "failed");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("parallel writers cannot replace an existing project", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc2agent-race-"));
  try {
    const out = join(root, "out");
    const results = await Promise.allSettled([
      writeProject(out, new Map([["owner", "one"]])),
      writeProject(out, new Map([["owner", "two"]])),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.ok(["one", "two"].includes(await readFile(join(out, "owner"), "utf8")));
    assert.deepEqual((await readdir(root)).sort(), ["out"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
