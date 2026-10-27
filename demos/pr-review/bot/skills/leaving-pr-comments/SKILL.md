---
name: leaving-pr-comments
description: "准备有来源说明的 GitHub 评论草稿；默认不发送。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/leaving-pr-comments; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in cc2agent. -->

# Comment draft attribution

默认只起草。只有操作员另行实现并授权写工具后才能发布。草稿先使用以下 GitHub NOTE，正文与署名分开：

> [!NOTE]
> 🤖 **Agent SDK responding on behalf of <user>**

正文先给结论，引用实际代码或检查，区分事实与判断。若能验证模型公开名称，可以替换 Agent SDK。不要猜模型身份，不泄露秘密。不要给 PR 描述加评论署名块。
