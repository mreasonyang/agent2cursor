---
name: sol-loop
description: "使用 reviewer 子代理进行有界代码评审；默认不声称使用 Sol。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/sol-loop; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in cc-to-cursor-agent. -->

# Review loop

通过 task 调用 reviewer；给出范围、用户意图、相关代码和已有证据。最多三轮，后续只评审已改代码与未解决问题。只修复实际问题，不扩大范围。

reviewer 默认继承父模型，因此这是单模型角色评审，不是已验证的 GPT Sol。记录实际可观测的模型，无法观测时如实说明。没有回复、超时、预算耗尽都不是通过。不要自动推送或发评论。
