import type { Finding } from "../ir.js";

const REPLACEMENTS: Record<string, [string, string]> = {
  AskUserQuestion: ["没有已验证的直接替代；在最终回复开头提问，等待人工确认。", "No verified direct equivalent; ask at the start of the final reply and await human confirmation."],
  request_user_input: ["没有已验证的直接替代；在最终回复开头提问，等待人工确认。", "No verified direct equivalent; ask at the start of the final reply and await human confirmation."],
  delegate_task: ["改为 task 委派，并声明实际存在的子代理；委派并发等语义需人工复核。", "Use task delegation with declared subagents; review concurrency and delegation semantics manually."],
  orchestrator_capabilities: ["删除运行时能力探测依赖，明确声明可用子代理及能力。", "Replace runtime capability discovery with explicit available subagents and capabilities."],
  watch_pull_request: ["可改为经人工启用的 pr_wait 工具；轮询不是事件订阅的等价实现。", "Consider an operator-enabled pr_wait tool; polling is not equivalent to event subscription."],
  unwatch_pull_request: ["移除订阅取消逻辑；根据新轮询或 GitHub channel 的生命周期重写。", "Rewrite subscription cancellation for the polling or GitHub channel lifecycle."],
  Monitor: ["需要显式实现监控流程或 GitHub channel；不能直接调用该工具名。", "Implement monitoring or a GitHub channel explicitly; this tool name is not directly available."],
};

export function scanForeignTools(body: string, source: string): Finding[] {
  return Object.entries(REPLACEMENTS).flatMap(([tool, [message, messageEn]]) =>
    new RegExp(`(?<![A-Za-z0-9_])${tool}(?![A-Za-z0-9_])`).test(body)
      ? [{ source, field: `$prompt.${tool}`, status: "degraded" as const, message, messageEn }] : []);
}
