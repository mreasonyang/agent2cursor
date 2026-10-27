# cc2agent 验收记录

日期：2026-10-27。目标 SDK：`@grok/agent-sdk@0.3.0`。工作名尚未定为公开品牌。

用户决定：使用 `mreasonyang/cc2agent` **私有仓库**验收；暂不公开发布。根 package.json 保持 `private: true`。

## 已验证

| 项目 | 结果 | 证据边界 |
| --- | --- | --- |
| TypeScript 构建 | PASS | 本机 Node 26.11.0；CI 另测 Node 22.13 / 24 |
| 自动测试 | PASS，40 项 | 包括 CLI 子进程、递归扫描、字段完整性、模型映射、依赖、许可证、拒绝覆盖、危险输入和合并门禁 |
| 四类 Claude 示例 | PASS，4 个子代理 | 独立编写的官方示例模式 fixture；不是官方示例逐字副本 |
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

本机结构验收证据在忽略目录 `.validation/acceptance-2S5wZr/evidence.json`；不包含凭证或真实模型轨迹，不提交到仓库。

## 线上验收

用户已授权配合 Cursor 登录并继续线上验收。正在通过官方远程浏览器登录流程完成认证。

- 真实模型 loadedSkill eval：待执行。
- full-send 安全触发回合：待执行。
- 三视角 Council review：待执行；默认同模型，不能声称三厂商。
- 测试 PR 事件：待执行。
- 托管部署与 URL：待检查团队 hosting 权限。
- GitHub CI：待私有仓库推送后核验。
- npm / 公开 GitHub / 社交发布：按用户要求暂不执行。

## 不能混同的边界

脚本存根明确禁用，不能以 validate 成功声称原脚本可执行。工具名扫描不自动改写任意输入 prompt。SDK 子代理权限与根白名单不等价；多代理隔离须通过真实运行另行确认。full-send 默认准备本地修改和 PR 草稿，自动测试、push、建 PR 尚未实现；合并 server tool 默认关闭并有审批和 head SHA 门禁。本地 sandbox 可能阻止 MCP server tool，因此结构发现不能证明实际可用。
