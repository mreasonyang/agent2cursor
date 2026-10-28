---
name: full-send
description: "Full send；完成本地修改、评审并准备 PR 草稿，在合并前停止。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/full-send; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in agent2cursor. -->

# Full Send — safe preparation

触发“full send”时，加载 sol-loop、file-pr、babysit-pr 和 leaving-pr-comments。目标是完成最小的本地修改，并准备可供人工发布的 PR。

1. 使用 read、grep、glob、ls 理解请求；只编辑属于本次任务的文件。
2. 通过 task 委派 reviewer 做最多三轮检查。没有测试执行器时，明确写“测试未运行”。
3. 用 file-pr 起草标题、问题、方案和验证证据；默认没有 Git push 或建 PR 工具，提交草稿供用户操作。
4. 已有 PR 时用 pr_wait 读取一次状态，之后由 GitHub 事件或用户继续触发；不自行轮询。
5. PR 准备好时停止。默认不合并，不强推，不发评论。

只有服务端操作员显式配置合并开关并批准本次工具调用，merge_pr 才能尝试合并已确认的最新 head。不要把“full send”文字理解为开启开关。

遇到阻塞时保留 PR，最终回复开头用中文提出具体问题。报告修改、评审、测试未覆盖项和人工下一步。
