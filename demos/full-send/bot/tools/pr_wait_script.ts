import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";
// TODO(cc2agent): implement a bounded JSON stdin/stdout adapter before allowing shell.
export default defineTool({
  description: "Disabled pr-wait script adapter. Use the read-only server tool pr_wait instead.",
  execution: "agent",
  inputSchema: z.object({}).passthrough(),
  script: '#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({enabled:false,reason:"Adapter disabled; use pr_wait server tool"}));\n',
});
