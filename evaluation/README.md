# Independent evaluation

[2026-10-27 retest conclusion](20261027-2216/复测结论.md) preserves the independent evaluator's findings. The portable counts and source hashes are in [the evaluation summary](../docs/evidence/independent-evaluation.json).

The project is now named `agent2cursor`. The original report and hash-bound evidence retain the historical names `cc-to-cursor-agent` and `cc2agent`; they describe the versions actually evaluated.

- The structural retest used `d5a9da3283d8746c87a9df0eafd0dd52d2fe901c`: all 24 normal conversions and their post-install SDK validations passed. Six boundary inputs expected to be rejected were rejected.
- The original generated routing evals passed 35 of 41 cases. The revised prompts and timeout then passed 41 of 41 across the same 30 projects. The summary identifies the revised generator by source hashes; this is a narrow routing result, not a general quality or safety guarantee.
- Three real tasks were repeated three times per method. The converter and the direct-copy/plugin baselines each passed all nine task runs.
- The permission probe confirmed that a source subagent restriction did not prevent shell execution. Script adapters remained disabled. Hosted deployment was not completed.

The original report's final paragraph refers to the first routing run; its section “补上的三项” also records the subsequent 41/41 result. Neither run is discarded.

Raw runs, generated projects, inputs and local evaluation runners remain on disk and are excluded from Git. They can contain machine paths, model traces and dependencies. This directory tracks final conclusions; `docs/evidence/` tracks bounded summaries. Product tests, demo eval suites and source fixtures remain in their existing directories.

No model evals or test suites were rerun when preparing this record on 2026-10-28.
