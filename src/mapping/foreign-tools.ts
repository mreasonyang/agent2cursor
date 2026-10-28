import type { Finding } from "../ir.js";

const REPLACEMENTS: Record<string, [string, string]> = {
  WebFetch: ["没有已核实的 SDK 抓取工具映射；请提供页面内容或人工实现受控抓取工具。此处仅报告名称引用，不改写正文。", "No verified SDK fetch-tool mapping; provide page content or implement a controlled fetch tool manually. This reports a name reference without rewriting the body."],
  WebSearch: ["没有已核实的 SDK 搜索工具映射；请提供检索资料或人工配置搜索工具，并复核访问权限。", "No verified SDK search-tool mapping; provide search material or configure a search tool manually and review access permissions."],
  AskUserQuestion: ["没有已验证的直接替代；在最终回复开头提问，等待人工确认。", "No verified direct equivalent; ask at the start of the final reply and await human confirmation."],
  request_user_input: ["没有已验证的直接替代；在最终回复开头提问，等待人工确认。", "No verified direct equivalent; ask at the start of the final reply and await human confirmation."],
  request_user_input_async: ["没有已验证的异步交互替代；改为明确提问并等待人工回复，不能按超时视作批准。", "No verified asynchronous input equivalent; ask explicitly and await the user's response. A timeout is not approval."],
  spawn_agent: ["改为 task 和实际声明的 SDK 子代理；Codex 的 fork、模型覆盖与并发语义需人工适配。", "Use task with declared SDK subagents; adapt Codex fork, model overrides, and concurrency semantics manually."],
  send_input: ["Codex 子代理续传消息没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for follow-up messages to Codex subagents; rewrite around the SDK task lifecycle."],
  close_agent: ["Codex 子代理关闭没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for closing Codex subagents; rewrite around the SDK task lifecycle."],
  resume_agent: ["Codex 子代理恢复没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for resuming Codex subagents; rewrite around the SDK task lifecycle."],
  wait_agent: ["改为 SDK task 结果收集；后台等待和超时语义需人工适配。", "Collect SDK task results; adapt background waiting and timeout semantics manually."],
  wait: ["Codex wait 调用需按 SDK task 的结果收集方式重写；等待和超时语义不能直接透传。", "Rewrite Codex wait calls around SDK task result collection; waiting and timeout semantics are not directly portable."],
  list_agents: ["请用生成项目中实际声明的子代理清单；没有已核实的 Codex 活跃代理列表接口映射。", "Use the subagents declared in the generated project; no verified mapping exists for the Codex live-agent inventory."],
  send_message: ["Codex 代理间消息没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for Codex inter-agent messages; rewrite around the SDK task lifecycle."],
  followup_task: ["Codex 子代理后续任务没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for Codex follow-up tasks; rewrite around the SDK task lifecycle."],
  interrupt_agent: ["Codex 子代理中断没有已核实的直接映射；按 SDK task 的生命周期重写。", "No verified direct mapping for interrupting Codex subagents; rewrite around the SDK task lifecycle."],
  exec_command: ["需按 SDK shell 工具重写；会话 ID、PTY、超时和审批参数不能原样迁移，shell 可以写入。", "Rewrite for the SDK shell tool; session IDs, PTYs, timeouts, and approval parameters are not portable. Shell can write."],
  write_stdin: ["Codex 终端会话续写没有已核实的直接映射；按目标 shell 会话接口重写。", "No verified direct mapping for Codex terminal session input; adapt to the target shell-session interface."],
  apply_patch: ["需按 SDK edit 工具重写；补丁格式、路径约束及审批语义需重新验证。", "Rewrite for the SDK edit tool; revalidate patch format, path constraints, and approval semantics."],
  update_plan: ["没有已核实的计划工具映射；可用普通进度文本表达，不能直接调用此工具名。", "No verified planning-tool equivalent; use ordinary progress text rather than calling this tool name."],
  delegate_task: ["改为 task 委派，并声明实际存在的子代理；委派并发等语义需人工复核。", "Use task delegation with declared subagents; review concurrency and delegation semantics manually."],
  orchestrator_capabilities: ["删除运行时能力探测依赖，明确声明可用子代理及能力。", "Replace runtime capability discovery with explicit available subagents and capabilities."],
  watch_pull_request: ["可改为经人工启用的 pr_wait 工具；轮询不是事件订阅的等价实现。", "Consider an operator-enabled pr_wait tool; polling is not equivalent to event subscription."],
  unwatch_pull_request: ["移除订阅取消逻辑；根据新轮询或 GitHub channel 的生命周期重写。", "Rewrite subscription cancellation for the polling or GitHub channel lifecycle."],
  Monitor: ["需要显式实现监控流程或 GitHub channel；不能直接调用该工具名。", "Implement monitoring or a GitHub channel explicitly; this tool name is not directly available."],
};

export function scanForeignTools(body: string, source: string): Finding[] {
  return Object.entries(REPLACEMENTS).flatMap(([tool, [message, messageEn]]) =>
    (tool === "wait"
      // "wait" is also ordinary prose; require an explicit tool-like reference.
      ? /(?:\bfunctions\.wait\b|(?<![A-Za-z0-9_])wait\s*\(|`wait`)/.test(body)
      : new RegExp(`(?<![A-Za-z0-9_])${tool}(?![A-Za-z0-9_])`).test(body))
      ? [{ source, field: `$prompt.${tool}`, status: "degraded" as const, message, messageEn }] : []);
}
