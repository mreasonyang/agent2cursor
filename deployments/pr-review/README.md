# pr-review demo

基于 tstack council + leaving-pr-comments 改编；见 LICENSE-tstack、TSTACK-PROVENANCE.json 和各 SKILL.md 的改动说明。当前只完成结构与 eval 发现验证，不是已部署服务。

```bash
npm install
npm run validate
npm run eval:list
agent-sdk login
agent-sdk dev --dir .
```

先把 `bot/lib/settings.ts` 里的 `OWNER/REPO` 改成自己的测试仓库，并在 Cursor 中连接 GitHub。占位仓库不会触发回合。非 draft PR 的 opened/reopened/ready_for_review 事件会启动会话；评分表保留在会话里，未实现自动发评论或改 PR 描述。

reviewer-a/b/c 分别关注正确性、安全、测试与维护；都省略 model 并继承父模型。最终中文回复必须包含 `Council review` 表格和同模型降级声明。未评分填 no score，不猜分数、模型名或厂商。

根代理排除 shell/edit/delete；子代理保留 SDK harness task 工具自己的工具集，不能仅凭根配置声称它们只读。保留 `local.sandbox: true`，用隔离测试仓库与最小 GitHub 权限验证真实行为。本地 sandbox 可能阻止 MCP server tools；不要为了演示自动关闭它。

`pr_wait` 是只读单次 GitHub GET 快照，会注明 diff/检查截断与未读取讨论。它不是持续 watcher。

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
