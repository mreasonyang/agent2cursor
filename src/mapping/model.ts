import type { ConvertOptions, Finding } from "../ir.js";

export function mapModel(value: unknown, source: string, options: ConvertOptions): { model?: string; finding: Finding } {
  const base = { source, field: "model" };
  if (value === "inherit") return { finding: { ...base, status: "mapped", message: "已省略 model，继承父代理模型。", messageEn: "Omitted model to inherit the parent model." } };
  if (typeof value === "string" && Object.hasOwn(options.modelMap, value) && options.modelMap[value]) return { model: options.modelMap[value], finding: {
    ...base, status: "mapped", target: "agent.ts:model", message: "已按 --model-map 显式映射；可用性需用实际账号验证。", messageEn: "Explicitly mapped with --model-map; verify availability with your account.",
  } };
  if (typeof value === "string" && value.trim() && options.keepModel) return { model: value, finding: {
    ...base, status: "degraded", target: "agent.ts:model", message: "按 --keep-model 保留原 ID；validate 不能证明该模型可调用。", messageEn: "Kept the original ID with --keep-model; validate does not prove model availability.",
  } };
  return { finding: { ...base, status: "degraded", message: "已省略 model，继承父代理模型；使用 --model-map 显式指定目标模型。", messageEn: "Omitted model to inherit the parent model; use --model-map to select a target model explicitly." } };
}
