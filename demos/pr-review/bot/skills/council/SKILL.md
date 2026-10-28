---
name: council
description: "council 或 PR 评审：三种评审视角及中文 Council review 评分表。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/council; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in agent2cursor. -->

# Council review

使用 task 分别委派 reviewer-a（正确性）、reviewer-b（安全与权限）、reviewer-c（测试和维护）。三个子代理默认继承同一个父模型。必须写明“降级：三位 reviewer 继承同一模型，当前是三种视角，未验证三家模型”。

提供同一份 PR 上下文，让每个 reviewer 独立给出证据、问题和 0–10 分。未给分填 no score，不得编造。最多三轮，仅有新修复时复审。

最终中文回复包含：

## Council review

Rounds: 1

| Delegate | Focus | Round 1 |
| --- | --- | --- |
| reviewer-a | 正确性 | 实际评分或 no score |
| reviewer-b | 安全与权限 | 实际评分或 no score |
| reviewer-c | 测试和维护 | 实际评分或 no score |

说明分歧、证据范围和下一步。仅回复，不编辑代码、不改 PR 描述、不发评论。需要评论草稿时加载 leaving-pr-comments。
