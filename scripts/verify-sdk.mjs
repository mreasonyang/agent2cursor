import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve, join, dirname, delimiter } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";

// Uses only published CLIs. Never reads SDK internals or relays runtime output.
const root = resolve(import.meta.dirname, "..");
const sdk = join(root, ".validation/node_modules/.bin/agent-sdk");
await mkdir(join(root, ".validation"), { recursive: true });
const evidenceDir = await mkdtemp(join(root, ".validation/acceptance-"));
// Output must not inherit the SDK's node_modules, which used to mask missing zod.
const projectRoot = await mkdtemp(join(await realpath(tmpdir()), "agent2cursor-sdk-"));
const cli = join(root, "dist/cli.js");
const env = { ...process.env, PATH: `${dirname(sdk)}${delimiter}${process.env.PATH ?? ""}`,
  AGENT_SERVE_NO_UPDATE_CHECK: "1", NO_UPDATE_NOTIFIER: "1" };
const evidence = { generatedAt: new Date().toISOString(), sdkVersion: "0.3.0", projectRoot, checks: [] };
function command(executable, args, expectedExit = 0) {
  const run = spawnSync(executable, args, { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024, env });
  let result;
  try { result = JSON.parse(run.stdout); } catch { /* no raw logs */ }
  assert.equal(run.status, expectedExit, `Unexpected CLI exit: ${args[0]} (raw output withheld)`);
  assert.ok(result, `Expected structured output: ${args[0]}`);
  return result;
}
async function installAndCheck(directory, initial) {
  assert.equal(initial.validation.status, "dependencies-missing", "Fresh output must not resolve ambient SDK dependencies");
  assert.deepEqual(initial.validation.missingDependencies, ["@grok/agent-sdk", "zod"]);
  const before = command(process.execPath, [cli, "doctor", "--dir", directory, "--json"], 1);
  assert.equal(before.sdkInstalled, true, "This case must find the separately installed SDK on PATH");
  assert.equal(before.validation.status, "dependencies-missing");
  const install = spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--prefer-offline", "--fetch-timeout=30000", "--fetch-retries=1"],
    { cwd: directory, env, stdio: "ignore", timeout: 180_000 });
  assert.equal(install.status, 0, `Project dependency installation failed (${install.error?.code ?? install.signal ?? "nonzero exit"}); raw output withheld`);
  const after = command(process.execPath, [cli, "doctor", "--dir", directory, "--json"]);
  assert.equal(after.validation.status, "passed");
  console.log(JSON.stringify({ project: directory, beforeInstall: initial.validation.status, afterInstall: after.validation.status }));
  return { conversionExitCode: 0, beforeInstall: initial.validation, doctorBeforeInstallExitCode: 1, afterInstall: after.validation };
}
async function typecheck(directory) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.name.endsWith(".ts")) files.push(file);
    }
  }
  await visit(join(directory, "bot"));
  await visit(join(directory, "evals"));
  const result = spawnSync(join(root, "node_modules/.bin/tsc"), ["--noEmit", "--strict", "--skipLibCheck", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", ...files], { cwd: root, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, `Generated TypeScript failed type checking (${directory}); diagnostics withheld.`);
}
for (const [name, source] of [["claude", "fixtures/claude"], ["codex", "fixtures/codex/project"], ["tstack", "fixtures/tstack/skills"]]) {
  const out = join(projectRoot, name);
  const converted = command(process.execPath, [cli, "convert", source, "--with-deps", "--out", out, "--json"]);
  const dependencyLifecycle = await installAndCheck(out, converted);
  const validation = command(sdk, ["validate", "--dir", out, "--json"]);
  const info = command(sdk, ["info", "--dir", out, "--json"]);
  const evals = command(sdk, ["eval", "--dir", out, "--list", "--json"]);
  await typecheck(out);
  assert.equal(validation.ok, true);
  assert.equal(info.agents.length, 1);
  assert.equal(info.agents[0].skills.length, converted.counts.skills);
  assert.equal(info.agents[0].subagents.length, converted.counts.agents);
  assert.equal(evals.length, converted.counts.skills + converted.counts.agents);
  if (name === "tstack") {
    assert.equal(info.agents[0].skills.length, 9);
    assert.ok(info.agents[0].tools.some(tool => tool.name === "pr_wait" && tool.execution === "agent"));
  } else if (name === "codex") {
    assert.equal(info.agents[0].subagents.length, 2);
    assert.equal(info.agents[0].skills.length, 1);
    assert.equal(evals.length, 3);
    assert.match(converted.permissionWarning, /Codex/);
    assert.ok(converted.findings.some(f => f.field === "features.shell_tool" && f.status === "degraded"));
    assert.ok(converted.findings.some(f => f.field === "policy.allow_implicit_invocation" && f.status === "degraded"));
  } else assert.equal(info.agents[0].subagents.length, 4);
  // The only saved data comes from generated fixtures, not user credentials or runtime traces.
  evidence.checks.push({ name, dependencyLifecycle, counts: converted.counts, skills: converted.skills, agents: converted.agents,
    tools: converted.tools, validation, info, evals });
  if (name === "claude") {
    const file = join(out, "bot/agent.ts");
    const original = await readFile(file, "utf8");
    try {
      await writeFile(file, "export default ( ;\n");
      const broken = command(process.execPath, [cli, "doctor", "--dir", out, "--json"], 1);
      assert.equal(broken.validation.status, "failed", "Installed dependencies must not hide a real syntax error");
      evidence.invalidConfigurationRejected = true;
    } finally { await writeFile(file, original); }
  }
}
for (const name of ["full-send", "pr-review"]) {
  const out = join(projectRoot, name);
  const extracted = command(process.execPath, [cli, "demo", name, "--out", out, "--json"]);
  const dependencyLifecycle = await installAndCheck(out, extracted);
  const validation = command(sdk, ["validate", "--dir", out, "--json"]);
  const evals = command(sdk, ["eval", "--dir", out, "--list", "--json"]);
  const localInfo = command(sdk, ["info", "--dir", out, "--json"]);
  await typecheck(out);
  assert.equal(validation.ok, true);
  assert.equal(evals.length, name === "full-send" ? 6 : 3);
  assert.equal(localInfo.agents[0].channels.some(channel => channel.id === "github"), false, "Unconfigured demo must not register a GitHub channel");
  // Discovery only: this fixture value never authorizes or contacts GitHub.
  await writeFile(join(out, "bot/lib/settings.ts"), 'export const DEMO_REPOSITORY: string = "example/repository";\n');
  const configuredValidation = command(sdk, ["validate", "--dir", out, "--json"]);
  const configuredInfo = command(sdk, ["info", "--dir", out, "--json"]);
  assert.equal(configuredValidation.ok, true);
  assert.equal(configuredInfo.agents[0].channels.filter(channel => channel.id === "github").length, 1, "Configured demo must register its GitHub channel");
  evidence.checks.push({ name, dependencyLifecycle, validation, evals, channelsDisabledByDefault: true, configuredChannelFound: true, configuredValidation });
}
await writeFile(join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ status: "passed", evidenceDir, checks: evidence.checks.map(c => ({ name: c.name, counts: c.counts, validated: true, evalsListed: true })),
  liveModelRun: "not-run", deployment: "not-run", npmPublication: "not-run" }, null, 2));
