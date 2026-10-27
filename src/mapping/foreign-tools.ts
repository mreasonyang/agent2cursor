import type { Finding } from "../ir.js";

const REPLACEMENTS: Record<string, [string, string]> = {
  WebFetch: ["没有已核实的 SDK 抓取工具映射；请提供页面内容或人工实现受控抓取工具。此处仅报告名称引用，不改写正文。", "No verified SDK fetch-tool mapping; provide page content or implement a controlled fetch tool manually. This reports a name reference without rewriting the body."],
  WebSearch: ["没有已核实的 SDK 搜索工具映射；请提供检索资料或人工配置搜索工具，并复核访问权限。", "No verified SDK search-tool mapping; provide search material or configure a search tool manually and review access permissions."],
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
