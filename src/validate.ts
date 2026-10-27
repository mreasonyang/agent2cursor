import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import type { ValidationResult } from "./ir.js";

export function supportedNode(version = process.versions.node): boolean {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}

export async function findSdk(dir: string): Promise<string | undefined> {
  const filename = process.platform === "win32" ? "agent-sdk.cmd" : "agent-sdk";
  const candidates = [join(resolve(dir), "node_modules", ".bin", filename),
    ...((process.env.PATH ?? "").split(delimiter).filter(Boolean).map(p => join(p, filename)))];
  for (const candidate of candidates) {
    try { await access(candidate, constants.X_OK); return candidate; } catch { /* next installed CLI */ }
  }
}

// Never relay SDK stdout/stderr: source modules and runtime errors may contain credentials.
// Only diagnostic counts and a closed set of status fields cross the process boundary.
export async function validateProject(dir: string, sdk?: string): Promise<ValidationResult> {
  const command = `agent-sdk validate --dir ${JSON.stringify(resolve(dir))}`;
  const executable = sdk ?? await findSdk(dir);
  if (!executable) return { status: "unavailable", command,
    message: "Agent SDK CLI is not installed. Run npm install in the generated project, then cc-to-cursor-agent doctor --dir <project>." };
  return new Promise(resolveResult => {
    let stdout = "";
    let overflow = false;
    let timedOut = false;
    const child = spawn(executable, ["validate", "--dir", resolve(dir), "--json"], {
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, AGENT_SERVE_NO_UPDATE_CHECK: "1", NO_UPDATE_NOTIFIER: "1" },
      shell: false,
    });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 60_000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length + chunk.length > 2 * 1024 * 1024) { overflow = true; child.kill("SIGKILL"); }
      else stdout += chunk.toString("utf8");
    });
    child.on("error", () => { clearTimeout(timer); resolveResult({ status: "failed", command, message: "Could not start Agent SDK CLI." }); });
    child.on("close", code => {
      clearTimeout(timer);
      if (timedOut || overflow) return resolveResult({ status: "failed", command,
        message: timedOut ? "Validation exceeded 60 seconds." : "Validation output exceeded the safe limit." });
      let parsed: unknown;
      try { parsed = JSON.parse(stdout); } catch { /* no raw output fallback */ }
      let errors = 0, warnings = 0;
      const count = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) { value.forEach(count); return; }
        const record = value as Record<string, unknown>;
        if (record.severity === "error") errors++;
        if (record.severity === "warning") warnings++;
        Object.values(record).forEach(count);
      };
      count(parsed);
      const document = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : undefined;
      const sdkShape = document?.ok === true && Array.isArray(document.agents)
        && document.agents.length > 0 && document.agents.every(agent => agent && typeof agent === "object"
          && Array.isArray((agent as Record<string, unknown>).diagnostics));
      const status = code === 0 && sdkShape && errors === 0 ? "passed" : "failed";
      resolveResult({ status, command, message: status === "passed"
        ? `SDK validation passed: ${errors} errors, ${warnings} warnings. This does not prove live model or deployment behavior.`
        : `SDK validation failed (exit ${code ?? "signal"}; ${errors} errors, ${warnings} warnings). Raw diagnostics withheld. Check installed project dependencies and run the SDK locally for details.` });
    });
  });
}
