import { lstat, mkdir, mkdtemp, realpath, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

async function safeParents(path: string): Promise<void> {
  const root = parse(path).root;
  let current = root;
  for (const segment of relative(root, path).split(/[\\/]/).filter(Boolean)) {
    current = join(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Output ancestors must be real directories, not symlinks.");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try { await mkdir(current); }
      catch (creationError) {
        if ((creationError as NodeJS.ErrnoException).code !== "EEXIST") throw creationError;
        const stat = await lstat(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Output parent changed during creation.");
      }
    }
  }
}

export async function writeProject(out: string, files: Map<string, string | Buffer>): Promise<void> {
  let destination = resolve(out);
  // macOS system aliases are platform-owned; arbitrary user symlinks still fail.
  if (process.platform === "darwin") {
    for (const alias of ["/var", "/tmp"]) {
      if (destination === alias || destination.startsWith(`${alias}/`)) {
        destination = join(await realpath(alias), relative(alias, destination));
        break;
      }
    }
  }
  for (const name of files.keys()) {
    if (!name || isAbsolute(name) || name.includes("\\") || name.split("/").some(p => p === ".." || p === "." || !p)) {
      throw new Error("Unsafe generated output path.");
    }
  }
  await safeParents(dirname(destination));
  try { await lstat(destination); throw new Error(`Output already exists; choose a new directory: ${destination}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const staging = await mkdtemp(join(dirname(destination), ".cc2agent-"));
  let reserved = false;
  try {
    for (const [name, contents] of files) {
      const target = join(staging, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents, { flag: "wx" });
    }
    // Reserve the destination exclusively before publishing the completed tree.
    await mkdir(destination);
    reserved = true;
    await rename(staging, destination);
    reserved = false;
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (reserved) await rmdir(destination);
  }
}
