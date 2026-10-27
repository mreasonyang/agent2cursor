import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const MAX_TEXT_BYTES = 1024 * 1024;
export const MAX_ASSET_BYTES = 16 * 1024 * 1024;
export const MAX_FILES = 5000;
export const SKIP_DIRECTORIES = new Set([".git", "node_modules", ".validation", "dist", "build", ".cache", "__pycache__"]);

export function isSensitiveName(name: string): boolean {
  return /^(?:\.env(?:\..*)?|\.envrc|\.npmrc|\.netrc|\.pypirc|\.git-credentials|\.ssh|\.aws|\.kube|\.?credentials?(?:\..*)?|\.?secrets?(?:\..*)?|\.?tokens?(?:\..*)?|\.?auth(?:entication)?\.(?:json|ya?ml|toml)|cookies?(?:\..*)?|id_(?:rsa|dsa|ed25519|ecdsa)(?:\..*)?)$/i.test(name)
    || /\.(?:pem|p12|pfx|key|keystore)$/i.test(name);
}

/** Never resolve a symlink before deciding whether it is safe to read. */
export async function assertSafePath(file: string): Promise<string> {
  let absolute = path.resolve(file);
  // Match the writer's treatment of platform-owned macOS aliases. User-created
  // symlinks anywhere after these aliases are still rejected component by component.
  if (process.platform === "darwin") {
    for (const alias of ["/var", "/tmp"]) {
      if (absolute === alias || absolute.startsWith(`${alias}/`)) {
        absolute = path.join(await realpath(alias), path.relative(alias, absolute));
        break;
      }
    }
  }
  const parts = absolute.slice(path.parse(absolute).root.length).split(path.sep).filter(Boolean);
  if (parts.some(isSensitiveName)) throw new Error(`Sensitive input path is not permitted: ${absolute}`);
  if (parts.some((part) => /clash/i.test(part)) && /\.ya?ml$/i.test(absolute)) {
    throw new Error("Reading local Clash YAML is not permitted.");
  }
  let current = path.parse(absolute).root;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not permitted: ${current}`);
  }
  return absolute;
}

export async function readSafeFile(file: string, maxBytes = MAX_ASSET_BYTES): Promise<Buffer> {
  const absolute = await assertSafePath(file);
  const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error(`Expected a regular file: ${absolute}`);
    if (stat.size > maxBytes) throw new Error(`Input exceeds ${maxBytes} bytes: ${absolute}`);
    // Bounded reads also handle files growing after stat(), without loading the excess.
    const buffer = Buffer.alloc(Math.min(stat.size + 1, maxBytes + 1));
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > stat.size || length > maxBytes) throw new Error(`Input changed or exceeded its size limit: ${absolute}`);
    return buffer.subarray(0, length);
  } finally {
    await handle.close();
  }
}

export async function readSafeText(file: string, maxBytes = MAX_TEXT_BYTES): Promise<string> {
  const bytes = await readSafeFile(file, maxBytes);
  if (bytes.includes(0)) throw new Error(`Expected UTF-8 text: ${path.resolve(file)}`);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** Absolute, sorted regular files. Sensitive files fail closed instead of being copied. */
export async function listSafeFiles(directory: string, onSkip?: (file: string, reason: string) => void): Promise<string[]> {
  const root = await assertSafePath(directory);
  if (!(await lstat(root)).isDirectory()) throw new Error(`Expected a directory: ${root}`);
  const files: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 32) throw new Error(`Input nesting exceeds 32 directories: ${root}`);
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not permitted: ${file}`);
      if (isSensitiveName(entry.name)) throw new Error(`Sensitive input path is not permitted: ${file}`);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await walk(file, depth + 1);
        else onSkip?.(file, "Generated, dependency, cache, or version-control directory omitted.");
      } else if (entry.isFile()) {
        if (files.length >= MAX_FILES) throw new Error(`Input exceeds ${MAX_FILES} files: ${root}`);
        files.push(file);
      } else {
        throw new Error(`Special files are not permitted: ${file}`);
      }
    }
  }
  await walk(root, 0);
  return files;
}
