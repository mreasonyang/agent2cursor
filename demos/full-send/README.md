# full-send demo

基于 tstack MIT 快照改编；见 LICENSE-tstack、TSTACK-PROVENANCE.json 和各 SKILL.md 的改动说明。当前只完成结构与 eval 发现验证，不是已部署服务。

```bash
npm install
npm run validate
npm run eval:list
agent-sdk login
agent-sdk dev --dir .
```

本地加载 skill、解释流程或使用离线输入时，可以保留 `bot/lib/settings.ts` 的 `OWNER/REPO`。这时使用 SDK 的 `disableChannel()` 完全禁用 GitHub channel，不为占位仓库请求凭据，也不响应 PR 事件；模型运行本身仍需要 Cursor 登录。`pr_wait` 会提示先配置仓库。

需要 GitHub 事件或远程读取时，再将 `OWNER/REPO` 改成自己的测试仓库，并在 Cursor 中连接和授权该仓库。配置后仅为此仓库启用账户授权，仍使用 SDK 默认 channel 鉴权和 `defaultGitHubAuth(ctx)`。非 draft PR 的 opened/reopened/ready_for_review 事件会启动会话；结果保留在会话里，未实现自动发评论。

根代理允许本地 edit，排除 shell。子代理保留 SDK harness task 工具自己的工具集，不能仅凭根配置声称它们只读。保留 `local.sandbox: true`，用隔离测试仓库与最小 GitHub 权限验证真实行为。本地 sandbox 可能阻止 MCP server tools；不要为了演示自动关闭它。

`pr_wait` 是只读单次 GitHub GET 快照，注明 diff/检查截断与未读取讨论。它不是持续 watcher。原版 Python watcher 保留，但 `pr_wait_script` 是禁用的适配存根，所以 validate 会有一条“缺少 shell”警告。

GitHub channel 显式关闭自动回复评论和 reaction；评论 mention 不启动回合。配置仓库后的账户权限显式为 `pr-write`，用于保留受控写工具的授权路径；这不代表已授权任何具体写入，也不保证该权限足以合并。`merge_pr` 的操作员开关、逐次人工批准与 SHA 检查仍然适用。

## 真实验收

在已有账户授权和预算下手动运行：

```bash
agent-sdk eval skills/full-send --dir .
agent-sdk run --dir . --message "full send：只加载 skill 并解释默认权限边界，不操作远程仓库。"
```

真实 eval 会调用模型；`--list` 只发现用例，不证明通过。之后才在专用测试 PR 上回放 GitHub 事件，检查权限隔离和无意外写入。默认流程没有自动测试、push、创建 PR、发评论功能；提供 PR 草稿和人工步骤。

## 部署路径

1. 复制为独立项目，配置测试仓库，运行 validate 与真实 eval，完成权限验收。
2. 人工创建远程仓库，将项目提交并推送。
3. 在项目中运行 `agent-sdk deploy`。SDK 部署已推送的 Git ref，不包含未提交修改。
4. 记录返回 URL，核对有效 egress 与服务状态，再用测试 PR 验证。

项目只声明 `api.github.com` egress；平台基础域名与团队策略要在真实部署后核对。未完成这些步骤不得声称已部署。不要把凭证写进配置、Git、日志或报告。

## 合并开关

作者编写的 merge_pr 工具默认拒绝合并。同时要求操作员将 `CC_TO_CURSOR_AGENT_ALLOW_MERGE` 设置为 `1`、人工批准本次调用、配置仓库对应的 GitHub PR 会话、精确当前 head SHA、非 draft 且 clean 的打开 PR。eval 直接拒绝，dry-run 返回 merged:false；不使用 admin、force-push 或保护绕过。这些检查不能证明整个 SDK 子代理运行环境不存在其他写入路径。

决定开启前确认 squash 合并符合仓库策略。托管环境通过 SDK 的隐藏输入配置该开关；不从 PR 正文读取。开关打开不代表某个 PR 已获批准。完整审批 UI 与真实托管工具调用仍待实测。
