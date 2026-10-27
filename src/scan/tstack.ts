import path from "node:path";
import { lstat } from "node:fs/promises";
import { readSafeText } from "./safety.js";

export const TSTACK_COMMIT = "7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd";
/** Verified against the README at the pinned commit, also stored in fixtures/tstack. */
export const TSTACK_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  "full-send": ["sol-loop", "file-pr", "babysit-pr"],
  "full-stop": ["full-send"],
  takeover: ["modernize", "file-pr", "babysit-pr", "leaving-pr-comments"],
  "file-pr": ["leaving-pr-comments"],
  "babysit-pr": ["leaving-pr-comments"],
  modernize: ["leaving-pr-comments"],
  council: [], "sol-loop": [], "leaving-pr-comments": [],
};

export function parseTstackDependencies(readme: string): Record<string, string[]> {
  const dependencies: Record<string, string[]> = Object.create(null);
  for (const line of readme.split(/\r?\n/)) {
    const match = /^-\s+(.+?)\s+uses?\s+(.+)$/.exec(line);
    if (!match) continue;
    const sources = [...match[1]!.matchAll(/`([a-z0-9_-]+)`/g)].map((value) => value[1]!);
    const targets = [...match[2]!.matchAll(/`([a-z0-9_-]+)`/g)].map((value) => value[1]!);
    for (const source of sources) dependencies[source] = targets;
  }
  return dependencies;
}

export async function dependencyInfo(directory: string, id: string): Promise<{ names: readonly string[]; basis: string; fallback: boolean }> {
  const readmePath = path.join(path.dirname(path.dirname(directory)), "README.md");
  try {
    await lstat(readmePath);
    const readme = await readSafeText(readmePath);
    if (/^#\s+tstack\s*$/m.test(readme) && readme.includes("t3dotgg/tstack")) {
      return { names: parseTstackDependencies(readme)[id] ?? [], basis: readmePath, fallback: false };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return { names: Object.hasOwn(TSTACK_DEPENDENCIES, id) ? TSTACK_DEPENDENCIES[id]! : [], basis: `t3dotgg/tstack@${TSTACK_COMMIT}`, fallback: true };
}
