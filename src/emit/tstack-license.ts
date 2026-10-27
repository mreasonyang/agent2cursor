import { createHash } from "node:crypto";
import { lstat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { SkillAsset } from "../ir.js";
import { readSafeFile, readSafeText } from "../scan/safety.js";

// Public MIT license at t3dotgg/tstack commit 7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd.
// No SDK implementation or documentation is vendored by this check.
const TSTACK_LICENSE_SHA256 = "8095f9a9f97d074131f6a2ce09b952d12c18b36f09f4e5df0517c4e64e82c851";

export interface TstackLicense {
  root: string;
  source: string;
  bytes: Buffer;
  sha256: string;
}

export async function associatedTstackLicense(skill: SkillAsset): Promise<TstackLicense | undefined> {
  const skillsDirectory = dirname(skill.directory);
  if (basename(skillsDirectory) !== "skills") return undefined;
  const root = dirname(skillsDirectory);
  const readmePath = join(root, "README.md");
  try { await lstat(readmePath); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const readme = await readSafeText(readmePath);
  if (!/^#\s+tstack\s*$/mu.test(readme) || !readme.includes("t3dotgg/tstack")) return undefined;
  const source = join(root, "LICENSE");
  let bytes: Buffer;
  try { bytes = await readSafeFile(source, 16 * 1024); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Recognized tstack source is missing its MIT LICENSE: ${root}`);
    throw error;
  }
  const normalizedHash = createHash("sha256").update(bytes.toString("utf8").replaceAll("\r\n", "\n")).digest("hex");
  if (normalizedHash !== TSTACK_LICENSE_SHA256) throw new Error(`Recognized tstack LICENSE differs from the verified MIT notice. Review its license before conversion: ${source}`);
  return { root, source, bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
}
