---
name: babysit-pr
description: "读取 PR 的当前 CI 与可合并状态；需要观察已有 PR 时使用。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/babysit-pr; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in cc-to-cursor-agent. -->

# Observe a PR

使用 pr_wait 读取配置仓库中一个 PR 的当前状态。该工具只请求 GitHub GET 接口，单次返回，不是持续 watcher。后续变化由 GitHub channel 的事件或用户消息触发。

验证反馈是否对应当前 head。只报告实际检查结果；缺失检查不能当作通过。失败、冲突、等待审核时明确指出阻塞。不要发评论、解决讨论、重置分支、强推或自动合并。需要人工回复时加载 leaving-pr-comments 并只提供草稿。

附带的 scripts/pr-wait 是原版 Python 脚本，仅供审阅。默认无 shell，pr_wait_script 也是禁用的 JSON 适配存根；本 demo 不执行它。
