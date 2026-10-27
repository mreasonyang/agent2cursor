import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

// Uses only published CLIs. Never reads SDK internals or relays runtime output.
const root = resolve(import.meta.dirname, "..");
const sdk = join(root, ".validation/node_modules/.bin/agent-sdk");
await mkdir(join(root, ".validation"), { recursive: true });
const evidenceDir = await mkdtemp(join(root, ".validation/acceptance-"));
const evidence = { generatedAt: new Date().toISOString(), sdkVersion: "0.3.0", checks: [] };
function command(executable, args) {
  const run = spawnSync(executable, args, { cwd: root, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, AGENT_SERVE_NO_UPDATE_CHECK: "1", NO_UPDATE_NOTIFIER: "1" } });
  let result;
  try { result = JSON.parse(run.stdout); } catch { /* no raw logs */ }
  assert.equal(run.status, 0, `CLI failed: ${args[0]} (raw output withheld)`);
  assert.ok(result, `Expected structured output: ${args[0]}`);
  return result;
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
for (const [name, source] of [["claude", "fixtures/claude"], ["tstack", "fixtures/tstack/skills"]]) {
  const out = join(evidenceDir, name);
  const converted = command(process.execPath, ["dist/cli.js", "convert", source, "--with-deps", "--out", out, "--no-validate", "--json"]);
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
  } else assert.equal(info.agents[0].subagents.length, 4);
  // The only saved data comes from generated fixtures, not user credentials or runtime traces.
  evidence.checks.push({ name, counts: converted.counts, skills: converted.skills, agents: converted.agents,
    tools: converted.tools, validation, info, evals });
}
for (const name of ["full-send", "pr-review"]) {
  const out = join(evidenceDir, name);
  command(process.execPath, ["dist/cli.js", "demo", name, "--out", out, "--no-validate", "--json"]);
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
  evidence.checks.push({ name, validation, evals, channelsDisabledByDefault: true, configuredChannelFound: true, configuredValidation });
}
await writeFile(join(evidenceDir, "evidence.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ status: "passed", evidenceDir, checks: evidence.checks.map(c => ({ name: c.name, counts: c.counts, validated: true, evalsListed: true })),
  liveModelRun: "not-run", deployment: "not-run", npmPublication: "not-run" }, null, 2));
