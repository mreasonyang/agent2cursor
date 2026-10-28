# agent2cursor 验收记录

更新日期：2026-10-28。版本：`0.1.0`。目标 SDK：`@grok/agent-sdk@0.3.0`。用户已确定项目名为 `agent2cursor`。

当前用户决定（2026-10-28）：GitHub 仓库 `mreasonyang/agent2cursor` 公开，并授权将 `@kyun.si/agent2cursor@0.1.0` 发布到 npm。根 package.json 保持 `private: true`，单独构建公开消费者归档；安装后的命令仍为 `agent2cursor`。npm 发布结果单独验证。

## agent2cursor 更名（2026-10-28）

项目由 `cc-to-cursor-agent` 更名为 `agent2cursor`，覆盖包名与锁文件、CLI、生成源码及报告、两个 demo 与生成模板、测试、双语文档、GitHub 仓库链接，以及 README 动图、海报和可编辑源文件。版本保持 `0.1.0`。

新命令为 `agent2cursor`；示例快照路径为 `.agent2cursor/pr-review.json`，禁用存根错误码为 `AGENT2CURSOR_STUB_DISABLED`，可选合并开关为 `AGENT2CURSOR_ALLOW_MERGE`。旧命令不安装别名，旧开关不作为回退读取；合并仍默认关闭。

更名前的独立评测原文、`docs/evidence/` 中既有 JSON 和固定 tstack 上游快照保留原始名称、路径与哈希；本次检查另行记录，不把历史真实模型结果算作更名后重跑。

本次 `npm run check` 通过 74 项测试（含工作区原有的 Codex 引用 skill 不加载测试）。`npm run test:sdk` 的 Claude、Codex、tstack、full-send、pr-review 五类工程通过独立安装前后检查、SDK 结构校验、严格 TypeScript 和 eval 发现，证据位于 `.validation/acceptance-XieMEy/evidence.json`。本轮未执行真实模型或部署。

`npm pack` 产物为 `agent2cursor-0.1.0.tgz`，在仓库外的干净 consumer 安装后验证了真实 `agent2cursor` bin 的帮助、版本、混合 Claude/Codex/skill 转换、两个 demo 和缺依赖时的 doctor 状态；运行源码与输出不再含旧项目标识。README 动图重新渲染为 960×540、10 fps、14 秒（140 帧），并核对海报画面和 [SOURCE.json](demo-video/SOURCE.json) 的新哈希。GitHub 仓库与 origin、本地目录均已更名，更名当时仍为私有；该轮没有发布到 npm。

## 已验证

| 项目 | 结果 | 证据边界 |
| --- | --- | --- |
| TypeScript 构建 | PASS | 本次本机 Node 26.11.0 与生成项目严格类型检查通过；历史私有 CI Node 22.13 / 24 已通过，当前提交 CI 见工作流 |
| 自动测试 | PASS，73 项 | 2026-10-28 重跑 npm run check；新增 Codex TOML、混合输入、逐字段元数据、权限提示、敏感字段拒绝、解析错误不回显及打包前 CLI 回归 |
| Codex 转换 | PASS，2 个子代理、1 个 skill | 合成 TOML 与 openai.yaml 样例；配置发现、类型检查与 SDK 结构校验通过，未跑真实模型 |
| 四类 Claude 示例 | PASS，4 个子代理 | 独立编写的官方示例模式 fixture；不是官方示例逐字副本 |
| 官方原始示例 | PASS，4 个子代理，零诊断 | 从官方 Markdown 下载并提取 code-reviewer/debugger/data-scientist/db-reader，在忽略目录转换；不把官方原文作为 fixture 再分发，哈希见 official-examples.provenance.json |
| tstack 全量转换 | PASS | 9 个 skill，1 个 pr_wait agent tool；SDK info 核对数量和 execution 字段 |
| 依赖闭包 | PASS | 单独 full-send 输入生成 5 个 skill，含 4 个依赖 |
| SDK 结构验证 | PASS | 5 类生成项目均零 error；full-send demo 有 1 条预期禁用脚本 warning |
| Eval 发现 | PASS | Claude 4 条、Codex 3 条、tstack 9 条、full-send 6 条、pr-review 3 条；只表示发现，不表示模型执行通过 |
| 干净 tarball 安装（既有验收） | PASS | npm pack 后在独立 consumer 安装；真实 bin 的 convert、demo、doctor 均通过 SDK 自检 |
| 许可 | PASS | 固定 tstack 提交、逐文件哈希、完整 MIT；普通 tstack 转换也保留 LICENSE-tstack |

可重现命令：

```sh
npm ci --ignore-scripts
npm run check
npm install --prefix .validation --ignore-scripts --no-audit --no-fund @grok/agent-sdk@0.3.0
npm run test:sdk
```

本机最终结构和类型检查证据在忽略目录 `.validation/acceptance-JjGsx6/evidence.json`；生成工程位于仓库外的系统临时目录，分别安装自身依赖，不再借用 `.validation` 的依赖。不包含凭证或真实模型轨迹。官方原始示例的历史产物保留在旧验收目录下的 `.validation/official-converted/`。首轮 [GitHub CI](https://github.com/mreasonyang/agent2cursor/actions/runs/40473284090) 已通过；最终提交状态以 [check 工作流](https://github.com/mreasonyang/agent2cursor/actions/workflows/check.yml) 为准。

## Codex 适配验收（2026-10-28）

支持独立 `.codex/agents/*.toml`、显式选择的 TOML 文件、Codex 通用 skill 及 `agents/openai.yaml`；输出仍是 Cursor Agent SDK。旧式角色注册和父会话配置不在本次转换范围。映射边界见 [上游核实](upstream-verification.md#codex-input-adapter-2026-10-28)，本次测试结果及源码哈希见 [Codex 证据](evidence/codex-adapter.json)。

73 项本地测试和 5 类 SDK 工程集成检查通过；Codex 的 3 条路由 eval 仅完成发现，没有执行真实模型。此前 Claude/tstack 的在线运行记录不能作为 Codex 运行行为等价的证据。

## 独立评测问题修复

复测基于 `evaluation/20261027-1822/给作者.md` 指出的用例，修复前基线为 `e63b662`。脱敏结果和源码哈希见 [回归证据](evidence/evaluation-fixes.json)。

- `N-SK-05` / `B-12`：默认转换退出 0，状态为 `dependencies-missing`，列出 SDK / zod 缺失，未声称通过校验。安装各自依赖后 SDK validate 均为零诊断。doctor 在依赖缺失时仍退出 1，真实语法错误仍被拒绝。
- `N-MX-02` / `B-07`：保留原文及已有提示；追加提示时，正文结论明确降级。inspect 与 convert 使用相同的最终映射结论，不保留矛盾的“原样迁移”记录。
- `N-AG-05` / `B-12`：报告分别列出 WebFetch 等工具名引用，源正文逐字保留。新增 WebSearch 覆盖与标识符边界测试，说明扫描采用固定名单。
- `N-AG-04`：权限损失显示在终端摘要第一行和报告开头，JSON 摘要也包含 permissionWarning；未向子代理配置伪造 tools / disallowedTools / permissionMode。
- `B-11` 继续拒绝敏感文件；输入脚本执行哨兵仍未出现。58 项单测通过；四类生成工程在独立目录中通过依赖安装前后、SDK 结构、严格类型和 eval 发现检查。

此次修复不改变历史真实模型和线上验收的证据范围。

## 线上验收

修复后的独立评测见 [最终报告](../evaluation/20261027-2216/复测结论.md) 和 [汇总证据](evidence/independent-evaluation.json)：正常转换与安装后校验均为 24/24；3 个真实任务各重复 3 次，与直接复制/插件对照结果一致。生成的路由 eval 初次为 35/41，修改提示词与超时后为 41/41。汇总记录修复源码的哈希，不把旧提交的结果与新提示词混为一轮。

以下是较早的 demo 验收。重复的 `deployments/pr-review` 本地验收副本已移除，维护入口统一为 `demos/pr-review`；原始证据里的历史路径和哈希仍可在下述历史提交中查验。

以下结果来自更名前的 `cc2agent`。原始 [JSON 证据](evidence/online-2026-10-27.json) 中的仓库名和源码哈希保留不变；对应源码可在更名前提交 `f9fc7fe682252b82bce904f6df0d3da0f3d62de5` 中查验。本次更名重跑本地构建、测试、SDK 结构校验和打包验证，不把历史线上结果算作更名后重新运行。

已通过官方远程浏览器登录流程完成 Cursor SDK 认证；用户不需要在运行电脑旁操作。认证信息仅由 SDK 管理，未写入代码或证据。

- 真实模型 loadedSkill eval：PASS，转换生成的 migration-smoke，1 case / 2 assertions。
- full-send 安全触发回合：PASS，配置私有仓库和默认未配置仓库各一次真实 `run`，均成功加载 full-send；每次 1 tool call、0 写入/执行调用、未调用 merge_pr。该场景仅检查 skill 加载与用途说明，不代表完整自动送 PR 流程。
- 三视角 Council eval：PASS，1 case / 9 assertions（成功、三次完成委派、Council review 标题、降级声明、三行评分表）；默认同模型，不能声称三厂商或完整隔离已验证。
- 测试 PR 事件：PASS，[私有验收 PR #1](https://github.com/mreasonyang/agent2cursor/pull/1) 经 HMAC 签名回放进入本地会话并完成。服务端读取只读快照，模型在 sandbox 内完成三次委派及中文评分表：8 次工具调用、0 工具错误、0 写入/执行调用。GitHub 评论、reaction、review 均为零。测试 PR 已关闭且未合并。回放不是 GitHub 实际 webhook 投递或托管验收。
- 托管部署与 URL：BLOCKED；SDK `deploy --dry-run` 明确返回账号没有默认团队。需要用户提供已开通 hosting 的团队 ID；未执行实际部署，没有 URL。
- GitHub CI：已通过 Node 22.13 / 24 单测和 npm pack，以及 SDK 兼容性任务。
- 该轮历史验收未执行 npm / 公开 GitHub / 社交发布；本次新增的 GitHub 公开与 npm 发布授权单独执行和验收。

## 不能混同的边界

脚本存根明确禁用，不能以 validate 成功声称原脚本可执行。工具名扫描不自动改写任意输入 prompt。SDK 子代理权限与根白名单不等价；多代理隔离须独立验证。full-send 默认准备本地修改和 PR 草稿，自动测试、push、建 PR 尚未实现；合并 server tool 默认关闭并有审批和 head SHA 门禁。本地 sandbox 可能阻止 MCP server tool；pr-review 使用经过 SHA 校验的服务端快照解决本场景，不关闭 sandbox，也不声称 pr_wait 在 sandbox 模型回合中已经通过。

两个 demo 显式关闭 SDK 的自动回帖、reaction 和 mention 触发。未配置仓库时禁用 GitHub channel。上述运行证据只覆盖具体用例，不能推广为所有输入下均无写入副作用。脱敏结果及源文件哈希见 [线上验收证据](evidence/online-2026-10-27.json)。
