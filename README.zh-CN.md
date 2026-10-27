# cc2agent

当前在私有仓库验收，暂不公开发布。根 package.json 保持 `private: true`。见 [验收记录](docs/acceptance.md)。已知 tstack 源必须保留可核实的 MIT 许可证；单次生成内容上限为 128 MiB。

把散装 Claude Code 子代理和 Agent Skills 转成可编辑的 Cursor Agent SDK 源码、eval 骨架和逐字段中文迁移报告。

[English](README.md) · MIT · Node **22.13+** · 适配 **@grok/agent-sdk 0.3.0**

```bash
# 当前从源码使用；本项目尚未发布到 npm。
npm install
npm run build
node dist/cli.js convert .claude/agents ~/.claude/skills/full-send \
  --with-deps --out ./my-agent
```

```text
.claude/agents/reviewer.md → bot/subagents/reviewer/{agent.ts,instructions.md}
skills/*/SKILL.md         → bot/skills/*/SKILL.md
skills/*/scripts/*        → bot/tools/*.ts（默认禁用的 JSON 适配存根）
每个 frontmatter 字段    → MIGRATION.zh-CN.md 中的 ✅ / ⚠️ / ❌ 结论
eval 骨架                → evals/*.eval.ts
```

转换不会执行输入脚本，默认不覆盖输出。模型默认继承父代理；模型 ID 是否可用需要用自己的账户核实。`validate` 通过只代表项目结构有效，不代表模型行为、权限语义或托管部署通过。

## 本地安装

```bash
npm pack
npm install --global ./cc2agent-0.1.0.tgz
cc2agent inspect ./fixtures/tstack
cc2agent convert ./fixtures/tstack/skills --with-deps --out /tmp/my-tstack-agent
cc2agent demo full-send --out /tmp/full-send-agent
cc2agent demo pr-review --out /tmp/pr-review-agent
cc2agent doctor --dir /tmp/my-tstack-agent
```

正式 npm 发布后才可以把第一步换成 `npx cc2agent ...`。现在展示该命令不等于包已发布。

SDK 按[官方文档](https://cursor.com/docs/agent-sdk)安装：

```bash
npm install --global @grok/agent-sdk@0.3.0
cd /tmp/my-tstack-agent
npm install
agent-sdk validate --dir .
agent-sdk eval --dir . --list
```

交互认证使用 `agent-sdk login`，随后可运行 `agent-sdk dev --dir .`。真实包名是 `@grok/agent-sdk`，旧名为 `@cursor/bdk`。不要使用公告里写的 `@cursor/agent-sdk`。核实日期与边界见[上游核实记录](docs/upstream-verification.md)。

## 命令

```text
cc2agent convert <input...> [--out <dir>] [--name <name>]
  [--model-map sonnet=<id>,opus=<id>] [--keep-model]
  [--root-tools read,grep,glob,ls,task] [--lang zh|en]
  [--with-deps] [--dry-run] [--json] [--no-validate]
cc2agent inspect <input...>
cc2agent demo <full-send|pr-review> [--out <dir>]
cc2agent doctor [--dir <project>]
```

支持单个子代理 Markdown、递归 `.claude/agents/`、单个 skill、skill 集合和 tstack 仓库。`--with-deps` 携带 tstack 依赖；`--dry-run` 只预览，`--json` 输出机器可读结果。默认中文。

子代理 `inherit` 不输出 model，其余模型名默认去掉并报告。`--model-map` 显式映射，`--keep-model` 原样保留并承担运行时验证责任。skill 的未知字段保留在原文件，同时进入报告。prompt 中的异构工具名称会被扫描提示，不擅自改写普通用户的正文。

`--root-tools` 设置根代理内置工具白名单；未传入时使用 SDK 默认工具集。不同子代理的独立权限无法忠实映射。`shell` 可以任意执行命令，不能称为只读。SDK 0.3.0 的子代理仍使用 harness task 工具自己的工具集，根代理白名单**不能证明子代理同样受限**；运行前要检查报告与实际隔离条件。

## 与官方方案的区别

| 方案 | 适用情况 |
| --- | --- |
| `cursorPlugin()` | 有插件清单，希望运行时挂载 Claude/Cursor 插件 |
| 直接复制 SKILL.md | 已兼容原生 skill，无需转换器 |
| cc2agent | 散装文件、源码输出、逐字段损失说明、异构工具提示、eval 骨架、中文模板 |

`init --from automation:` 和 `migrate` 面向其他迁移来源。cc2agent 仅生成公开 API 并调用 SDK CLI 自检，不依赖 SDK 内部 API；不会自动实现 Claude hooks、MCP、memory 或跨厂商模型路由。

## 两个 tstack demo

两者都来自固定 MIT 快照，附完整 `LICENSE-tstack`、来源提交与改动说明。当前是可生成、可结构验证的项目模板，真实执行和部署尚未验收。

- **full-send**：5 个 skill、一个 reviewer、中文本地修改/PR 草稿流程；`pr_wait` 是单次 GitHub GET 快照。根代理没有 shell，因此本项目编写的流程不会运行测试、git push 或创建 PR。保留原 Python watcher，但 `pr_wait_script` 适配存根默认禁用。`merge_pr` 是服务端写工具，只有操作员开启环境开关、人工批准本次调用、GitHub 会话仓库匹配、head SHA 未变且 PR clean 时才尝试合并；eval 禁止合并，dry-run 返回未合并。
- **pr-review**：council + leaving-pr-comments，3 个 reviewer 分别关注正确性、安全、测试和维护。默认继承同一模型，明确输出降级声明和中文 `Council review` 评分表。根代理无 shell/edit/delete；作者提供的工具只有读取，不提供发评论或改 PR 描述功能。

这些是本项目代码与 prompt 的默认边界，**不是经过真实 harness 验证的全体子代理隔离保证**。两个 demo 都开 `local.sandbox`；SDK 文档指出它会阻止本地 MCP 调用，因此 `pr_wait` 在真实本地模型回合中的可用性也未通过验收。不能为了演示方便自动关闭 sandbox。远程账户权限和子代理运行时工具仍需独立检查。

先把 `bot/lib/settings.ts` 的 `OWNER/REPO` 改成自己的仓库。GitHub channel 接收非 draft 的 opened/reopened/ready_for_review 事件；回复保留在 agent 会话里，不会因为收到事件就自动发评论。

[full-send 操作说明](demos/full-send/README.md) · [pr-review 操作说明](demos/pr-review/README.md)

## 验证与发布状态

```bash
npm run check
node scripts/build-demos.mjs
```

本地测试覆盖转换契约、输入与覆盖边界、tstack 来源字节、合并开关拒绝路径。SDK `validate` 和 `eval --list` 不需要真实模型运行；`--list` 只能证明发现了用例。具体交付证据见 `docs/ACCEPTANCE.md`。

当前**未声称真实 Cursor eval 通过、真实 PR 事件验收通过、已取得部署 URL、npm 已发布或已发推**。三名 reviewer 也不代表三家模型。仍需模型权限、真实运行、托管权限和发布决策。

基于 [t3dotgg/tstack](https://github.com/t3dotgg/tstack)（MIT）改编，与 Theo / T3 无官方关联或背书。SDK 是专有依赖，本项目不复制它的源码或文档。见[第三方声明](THIRD_PARTY_NOTICES.md)。
