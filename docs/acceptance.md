# cc2agent 验收记录

日期：2026-10-27。目标 SDK：`@grok/agent-sdk@0.3.0`。工作名尚未定为公开品牌。

用户决定：使用 `mreasonyang/cc2agent` **私有仓库**验收；暂不公开发布。根 package.json 保持 `private: true`。

## 已验证

| 项目 | 结果 | 证据边界 |
| --- | --- | --- |
| TypeScript 构建 | PASS | 本机 Node 26.11.0；私有 GitHub CI Node 22.13 / 24 通过；生成项目严格类型检查也通过 |
| 自动测试 | PASS，52 项 | 包括 CLI、字段完整性、模型映射、依赖、许可证、拒绝覆盖、并发报告替换、合并门禁、GitHub channel 开关和有界 PR 快照 |
| 四类 Claude 示例 | PASS，4 个子代理 | 独立编写的官方示例模式 fixture；不是官方示例逐字副本 |
| 官方原始示例 | PASS，4 个子代理，零诊断 | 从官方 Markdown 下载并提取 code-reviewer/debugger/data-scientist/db-reader，在忽略目录转换；不把官方原文作为 fixture 再分发，哈希见 official-examples.provenance.json |
| tstack 全量转换 | PASS | 9 个 skill，1 个 pr_wait agent tool；SDK info 核对数量和 execution 字段 |
| 依赖闭包 | PASS | 单独 full-send 输入生成 5 个 skill，含 4 个依赖 |
| SDK 结构验证 | PASS | 4 类生成项目均零 error；full-send demo 有 1 条预期禁用脚本 warning |
| Eval 发现 | PASS | Claude 4 条、tstack 9 条、full-send 6 条、pr-review 3 条；只表示发现，不表示模型执行通过 |
| 干净 tarball 安装 | PASS | npm pack 后在独立 consumer 安装；真实 bin 的 convert、demo、doctor 均通过 SDK 自检 |
| 许可 | PASS | 固定 tstack 提交、逐文件哈希、完整 MIT；普通 tstack 转换也保留 LICENSE-tstack |

可重现命令：

```sh
npm ci --ignore-scripts
npm run check
npm install --prefix .validation --ignore-scripts --no-audit --no-fund @grok/agent-sdk@0.3.0
npm run test:sdk
```

本机最终结构和类型检查证据在忽略目录 `.validation/acceptance-3ORhd4/evidence.json`；不包含凭证或真实模型轨迹，不提交到仓库。官方原始示例生成在 `.validation/official-converted/`。首轮 [GitHub CI](https://github.com/mreasonyang/cc2agent/actions/runs/40473284090) 已通过；最终提交状态以 [check 工作流](https://github.com/mreasonyang/cc2agent/actions/workflows/check.yml) 为准。

## 线上验收

已通过官方远程浏览器登录流程完成 Cursor SDK 认证；用户不需要在运行电脑旁操作。认证信息仅由 SDK 管理，未写入代码或证据。

- 真实模型 loadedSkill eval：PASS，转换生成的 migration-smoke，1 case / 2 assertions。
- full-send 安全触发回合：PASS，配置私有仓库和默认未配置仓库各一次真实 `run`，均成功加载 full-send；每次 1 tool call、0 写入/执行调用、未调用 merge_pr。该场景仅检查 skill 加载与用途说明，不代表完整自动送 PR 流程。
- 三视角 Council eval：PASS，1 case / 9 assertions（成功、三次完成委派、Council review 标题、降级声明、三行评分表）；默认同模型，不能声称三厂商或完整隔离已验证。
- 测试 PR 事件：PASS，[私有验收 PR #1](https://github.com/mreasonyang/cc2agent/pull/1) 经 HMAC 签名回放进入本地会话并完成。服务端读取只读快照，模型在 sandbox 内完成三次委派及中文评分表：8 次工具调用、0 工具错误、0 写入/执行调用。GitHub 评论、reaction、review 均为零。测试 PR 已关闭且未合并。回放不是 GitHub 实际 webhook 投递或托管验收。
- 托管部署与 URL：BLOCKED；SDK `deploy --dry-run` 明确返回账号没有默认团队。需要用户提供已开通 hosting 的团队 ID；未执行实际部署，没有 URL。
- GitHub CI：已通过 Node 22.13 / 24 单测和 npm pack，以及 SDK 兼容性任务。
- npm / 公开 GitHub / 社交发布：按用户要求暂不执行。

## 不能混同的边界

脚本存根明确禁用，不能以 validate 成功声称原脚本可执行。工具名扫描不自动改写任意输入 prompt。SDK 子代理权限与根白名单不等价；多代理隔离须独立验证。full-send 默认准备本地修改和 PR 草稿，自动测试、push、建 PR 尚未实现；合并 server tool 默认关闭并有审批和 head SHA 门禁。本地 sandbox 可能阻止 MCP server tool；pr-review 使用经过 SHA 校验的服务端快照解决本场景，不关闭 sandbox，也不声称 pr_wait 在 sandbox 模型回合中已经通过。

两个 demo 显式关闭 SDK 的自动回帖、reaction 和 mention 触发。未配置仓库时禁用 GitHub channel。上述运行证据只覆盖具体用例，不能推广为所有输入下均无写入副作用。脱敏结果及源文件哈希见 [线上验收证据](evidence/online-2026-10-27.json)。
