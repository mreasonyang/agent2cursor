# pr-review demo

基于 tstack council + leaving-pr-comments 改编；见 LICENSE-tstack、TSTACK-PROVENANCE.json 和各 SKILL.md 的改动说明。结构校验、真实模型三视角评审及本地 PR 签名回放已通过，完整范围见[验收记录](https://github.com/mreasonyang/cc-to-cursor-agent/blob/main/docs/acceptance.md)。托管部署尚未完成。

```bash
npm install
npm run validate
npm run eval:list
npx agent-sdk login
npx agent-sdk dev --dir .
```

本地加载 council 或评审手动提供的离线 diff 时，可以保留 `bot/lib/settings.ts` 的 `OWNER/REPO`。这时使用 SDK 的 `disableChannel()` 完全禁用 GitHub channel，不为占位仓库请求凭据，也不响应 PR 事件；模型运行本身仍需要 Cursor 登录。`pr_wait` 会提示先配置仓库。

需要 GitHub 事件或远程读取时，再将 `OWNER/REPO` 改成自己的测试仓库，并在 Cursor 中连接和授权该仓库。配置后仅为此仓库启用账户授权，仍使用 SDK 默认 channel 鉴权和 `defaultGitHubAuth(ctx)`。非 draft PR 的 opened/reopened/ready_for_review 事件会启动会话；评分表保留在会话里，未实现自动发评论或改 PR 描述。

reviewer-a/b/c 分别关注正确性、安全、测试与维护；都省略 model 并继承父模型。最终中文回复必须包含 `Council review` 表格和同模型降级声明。未评分填 no score，不猜分数、模型名或厂商。

根代理排除 shell/edit/delete；子代理保留 SDK harness task 工具自己的工具集，不能仅凭根配置声称它们只读。保留 `local.sandbox: true`，用隔离测试仓库与最小 GitHub 权限验证真实行为。本地 sandbox 可能阻止 MCP server tools；不要为了演示自动关闭它。

GitHub channel 显式关闭自动回复评论和 reaction，并将 Cursor 仓库权限限制为 `read`。评论 mention 不启动回合。PR 事件通过鉴权后，channel 使用延迟 `workspaceFiles` 在服务端读取 PR，写入固定的 `.cc-to-cursor-agent/pr-review.json`；webhook 先确认，读取总时限 20 秒。模型只读该快照并委派三位 reviewer，无须通过 sandbox 中的 MCP 访问 GitHub。

快照仅调用 GET：读取 PR、取首批最多 100 个文件、再读 PR。前后 head 必须匹配事件，base 必须保持一致；每个 patch 最多 12,000 字符，整个序列化 JSON 最多 120,000 字符。失败或版本漂移返回 `blocked`，缺失 patch 或截断返回 `partial`，最终回复必须声明范围。限制针对交给模型的文本；GitHub 单页 JSON 在裁剪前由 Octokit 解析。快照不包含 CI、完整讨论或测试执行证据。

`pr_wait` 仍是供手动调用的只读单次 GitHub GET 工具，不是持续 watcher。PR 事件评审明确使用已注入的快照，不调用该 MCP 工具。

## 真实验收

在已有账户授权和预算下手动运行：

```bash
agent-sdk eval pr-review --dir .
```

用例提供离线 diff，检查三名 reviewer 均被调用、回复有 Council review 和降级声明。它会调用真实模型；`--list` 只发现用例，不证明通过。之后才在专用测试 PR 上回放 GitHub 事件，检查真实证据、权限隔离与无意外写入。

## 部署路径

1. 复制为独立项目，配置测试仓库，运行 validate 与真实 eval，完成权限验收。
2. 人工创建远程仓库，将项目提交并推送。
3. 在项目中运行 `agent-sdk deploy`。SDK 部署已推送的 Git ref，不包含未提交修改。
4. 记录返回 URL，核对有效 egress 与服务状态，再用测试 PR 验证。

项目只声明 `api.github.com` egress；平台基础域名与团队策略要在真实部署后核对。未完成这些步骤不得声称已部署。不要把凭证写进配置、Git、日志或报告。
