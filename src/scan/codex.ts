import { parse } from "smol-toml";
import { assertNoSensitiveKeys } from "./frontmatter.js";

export function parseCodexAgent(text: string, file: string): Record<string, unknown> {
  let config: Record<string, unknown>;
  try {
    config = parse(text.replace(/^\uFEFF/, ""), { maxDepth: 30 });
  } catch {
    // TOML parser diagnostics contain source excerpts. Never echo them.
    throw new Error(`Invalid Codex agent TOML (or nesting exceeds 30 levels): ${file}`);
  }
  assertNoSensitiveKeys(config, file);
  for (const field of ["name", "description", "developer_instructions"]) {
    if (typeof config[field] !== "string" || !config[field].trim()) {
      throw new Error(`Codex standalone agents require a non-empty string '${field}': ${file}`);
    }
  }
  return config;
}
