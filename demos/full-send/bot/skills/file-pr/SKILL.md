---
name: file-pr
description: "起草简洁的 PR 标题和描述，供人工审核发布。"
---
<!-- Adapted from https://github.com/t3dotgg/tstack/tree/7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd/skills/file-pr; Copyright (c) 2026 Theo Browne; MIT, see LICENSE-tstack. Changes: Chinese prompts, Agent SDK delegation, bounded read tools, no automatic publication/merge/force-push. Original snapshot is fixtures/tstack in cc2agent. -->

# Prepare a PR

先确认修改对应用户问题。标题解释结果，正文从问题和修复后的行为开始，再列验证证据和未验证项。以实际可验证的模型/Agent SDK 信息署名，不猜模型名。

这是草稿工具流程：默认不创建 PR、不 push、不更改已有 PR 描述。输出可复制的标题与正文，由用户发布。需要评论格式时加载 leaving-pr-comments。检查引文是否包含秘密或私人信息。
