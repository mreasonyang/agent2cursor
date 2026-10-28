export const SDK_VERSION = "0.3.0";
export type Language = "zh" | "en";
export type Status = "mapped" | "degraded" | "dropped";
export interface Finding {
  source: string;
  field: string;
  status: Status;
  message: string;
  messageEn: string;
  target?: string;
}
export interface AgentAsset {
  id: string;
  source: string;
  sourceFormat?: "claude" | "codex";
  body: string;
  frontmatter: Record<string, unknown>;
  description: string;
  model?: string;
  findings: Finding[];
}
export interface SkillAsset {
  id: string;
  source: string;
  directory: string;
  body: string;
  frontmatter: Record<string, unknown>;
  description: string;
  trigger?: string;
  dependency: boolean;
  findings: Finding[];
}
export interface ScriptAsset {
  id: string;
  source: string;
  skillId: string;
  relativePath: string;
}
export interface MigrationIR {
  agents: AgentAsset[];
  skills: SkillAsset[];
  scripts: ScriptAsset[];
  findings: Finding[];
}
export interface ConvertOptions {
  name: string;
  lang: Language;
  withDeps: boolean;
  keepModel: boolean;
  modelMap: Record<string, string>;
  rootTools?: string[];
}
export interface ValidationResult {
  status: "passed" | "failed" | "dependencies-missing" | "unavailable" | "skipped";
  command: string;
  message: string;
  missingDependencies?: string[];
  diagnostics?: { severity: string; message: string }[];
}
export interface ProjectPlan {
  files: Map<string, string | Buffer>;
  ir: MigrationIR;
}
