import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { updateProjectReport, writeProject } from "../src/write.js";
import { supportedNode, validateProject } from "../src/validate.js";

test("Node requirement rejects 22.12 and accepts 22.13 or newer", () => {
  assert.equal(supportedNode("22.12.0"), false);
  assert.equal(supportedNode("22.13.0"), true);
  assert.equal(supportedNode("24.0.0"), true);
});

test("output refuses existing files, traversal and symlink ancestors", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-write-"));
  try {
    const out = join(root, "output");
    await writeProject(out, new Map([["bot/instructions.md", "original"]]));
    await assert.rejects(writeProject(out, new Map([["bot/instructions.md", "overwrite"]])), /already exists/);
    assert.equal(await readFile(join(out, "bot/instructions.md"), "utf8"), "original");
    await assert.rejects(writeProject(join(root, "bad"), new Map([["../escape", "x"]])), /Unsafe/);
    await symlink(out, join(root, "link"));
    await assert.rejects(writeProject(join(root, "link", "nested"), new Map([["ok", "x"]])), /symlinks/);
    assert.equal((await readdir(root)).some(s => s.startsWith(".cc-to-cursor-agent-")), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("validator summarizes structured diagnostics without echoing untrusted output", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-validation-"));
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
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-race-"));
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

test("report updates change only the generated report and truncate older contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-report-"));
  try {
    const written = await writeProject(join(root, "out"), new Map([
      ["MIGRATION.zh-CN.md", "initial report with a longer trailing message"],
      ["bot/instructions.md", "unchanged"],
    ]));
    await updateProjectReport(written, "MIGRATION.zh-CN.md", "完成\n");
    assert.equal(await readFile(join(written.directory, "MIGRATION.zh-CN.md"), "utf8"), "完成\n");
    assert.equal(await readFile(join(written.directory, "bot/instructions.md"), "utf8"), "unchanged");
    await assert.rejects(updateProjectReport(written, "../outside", "no"), /not created/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("report replacement by a symlink cannot overwrite an external file", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-report-link-"));
  try {
    const written = await writeProject(join(root, "out"), new Map([["MIGRATION.en.md", "generated"]]));
    const external = join(root, "outside.md");
    await writeFile(external, "external data stays intact");
    await rm(join(written.directory, "MIGRATION.en.md"));
    await symlink(external, join(written.directory, "MIGRATION.en.md"));
    await assert.rejects(updateProjectReport(written, "MIGRATION.en.md", "overwrite"));
    assert.equal(await readFile(external, "utf8"), "external data stays intact");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("replacement of the output directory cannot redirect a report update", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-report-dir-"));
  try {
    const out = join(root, "out");
    const written = await writeProject(out, new Map([["MIGRATION.en.md", "generated"]]));
    const external = join(root, "external");
    await mkdir(external);
    await writeFile(join(external, "MIGRATION.en.md"), "external report");
    await rename(out, join(root, "original"));
    await symlink(external, out, "dir");
    await assert.rejects(updateProjectReport(written, "MIGRATION.en.md", "overwrite"), /directory changed/);
    assert.equal(await readFile(join(external, "MIGRATION.en.md"), "utf8"), "external report");
    assert.equal(await readFile(join(root, "original", "MIGRATION.en.md"), "utf8"), "generated");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("replacement of an output ancestor cannot redirect a report update", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-report-parent-"));
  try {
    const parent = join(root, "parent");
    const written = await writeProject(join(parent, "out"), new Map([["MIGRATION.en.md", "generated"]]));
    const external = join(root, "external");
    await mkdir(join(external, "out"), { recursive: true });
    await writeFile(join(external, "out", "MIGRATION.en.md"), "external report");
    await rename(parent, join(root, "original-parent"));
    await symlink(external, parent, "dir");
    await assert.rejects(updateProjectReport(written, "MIGRATION.en.md", "overwrite"), /directory changed/);
    assert.equal(await readFile(join(external, "out", "MIGRATION.en.md"), "utf8"), "external report");
    assert.equal(await readFile(join(root, "original-parent", "out", "MIGRATION.en.md"), "utf8"), "generated");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("same-path replacement files and directories are rejected even without symlinks", async () => {
  const root = await mkdtemp(join(tmpdir(), "cc-to-cursor-agent-report-replaced-"));
  try {
    const out = join(root, "out");
    const written = await writeProject(out, new Map([["MIGRATION.en.md", "generated"]]));
    const report = join(out, "MIGRATION.en.md");
    await rename(report, join(out, "original-report"));
    await writeFile(report, "replacement report");
    await assert.rejects(updateProjectReport(written, "MIGRATION.en.md", "overwrite"), /report changed/);
    assert.equal(await readFile(report, "utf8"), "replacement report");
    await rename(out, join(root, "original"));
    await mkdir(out);
    await writeFile(report, "replacement directory report");
    await assert.rejects(updateProjectReport(written, "MIGRATION.en.md", "overwrite"), /directory changed/);
    assert.equal(await readFile(report, "utf8"), "replacement directory report");
  } finally { await rm(root, { recursive: true, force: true }); }
});
