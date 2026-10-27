import { constants, type BigIntStats } from "node:fs";
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, rmdir } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";

interface FileIdentity { dev: bigint; ino: bigint; birthtimeNs: bigint }
interface ReportIdentity extends FileIdentity { size: bigint; mtimeNs: bigint; ctimeNs: bigint }
export interface WrittenProject {
  readonly directory: string;
  readonly directories: ReadonlyMap<string, FileIdentity>;
  readonly reports: ReadonlyMap<string, ReportIdentity>;
}

function identity(stat: BigIntStats): FileIdentity {
  return { dev: stat.dev, ino: stat.ino, birthtimeNs: stat.birthtimeNs };
}

function sameIdentity(stat: BigIntStats, expected: FileIdentity): boolean {
  return stat.dev === expected.dev && stat.ino === expected.ino && stat.birthtimeNs === expected.birthtimeNs;
}

async function safeParents(path: string): Promise<Map<string, FileIdentity>> {
  const root = parse(path).root;
  let current = root;
  const directories = new Map<string, FileIdentity>([[root, identity(await lstat(root, { bigint: true }))]]);
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
    const stat = await lstat(current, { bigint: true });
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Output parent changed during creation.");
    directories.set(current, identity(stat));
  }
  return directories;
}

export async function writeProject(out: string, files: Map<string, string | Buffer>): Promise<WrittenProject> {
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
  const directories = await safeParents(dirname(destination));
  try { await lstat(destination); throw new Error(`Output already exists; choose a new directory: ${destination}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const staging = await mkdtemp(join(dirname(destination), ".cc2agent-"));
  directories.set(destination, identity(await lstat(staging, { bigint: true })));
  const reports = new Map<string, ReportIdentity>();
  let reserved = false;
  try {
    for (const [name, contents] of files) {
      const target = join(staging, name);
      await mkdir(dirname(target), { recursive: true });
      const handle = await open(target, "wx");
      try {
        await handle.writeFile(contents);
        if (name === "MIGRATION.zh-CN.md" || name === "MIGRATION.en.md") {
          const stat = await handle.stat({ bigint: true });
          reports.set(name, { ...identity(stat), size: stat.size, mtimeNs: stat.mtimeNs, ctimeNs: stat.ctimeNs });
        }
      } finally { await handle.close(); }
    }
    // Reserve the destination exclusively before publishing the completed tree.
    await mkdir(destination);
    reserved = true;
    await rename(staging, destination);
    reserved = false;
    return { directory: destination, directories, reports };
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (reserved) await rmdir(destination);
  }
}

/** Update only the report created by this conversion, never a replacement reached by a path. */
export async function updateProjectReport(project: WrittenProject, name: string, contents: string): Promise<void> {
  const expected = project.reports.get(name);
  if (!expected) throw new Error("Report was not created by this conversion.");
  const verifyDirectories = async (): Promise<void> => {
    for (const [path, expectedDirectory] of project.directories) {
      const stat = await lstat(path, { bigint: true });
      if (!stat.isDirectory() || stat.isSymbolicLink() || !sameIdentity(stat, expectedDirectory)) {
        throw new Error("Output directory changed before report update; refusing to write.");
      }
    }
  };
  await verifyDirectories();
  const target = join(project.directory, name);
  // Do not truncate while resolving the path. Even if an ancestor changes after
  // verification, fstat must identify our original regular file before any write.
  const handle = await open(target, constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await handle.stat({ bigint: true });
    const entry = await lstat(target, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || !sameIdentity(stat, expected)
      || stat.size !== expected.size || stat.mtimeNs !== expected.mtimeNs || stat.ctimeNs !== expected.ctimeNs
      || entry.isSymbolicLink() || !sameIdentity(entry, expected)) {
      throw new Error("Generated report changed before update; refusing to write.");
    }
    await verifyDirectories();
    // The verified descriptor stays attached to our file even if paths move now.
    await handle.writeFile(contents, "utf8");
    await handle.truncate(Buffer.byteLength(contents, "utf8"));
  } finally { await handle.close(); }
}
