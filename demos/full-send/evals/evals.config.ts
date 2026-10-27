import { defineEvalConfig } from "@grok/agent-sdk/evals";
export default defineEvalConfig({ maxConcurrency: 1, timeoutMs: 180000 });
