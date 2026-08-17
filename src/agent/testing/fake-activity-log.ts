import type { ActivityLogger } from "../activity-log";
import type { AgentRequest, AgentResult } from "../types";

export class FakeActivityLog implements ActivityLogger {
  entries: Array<{ request: AgentRequest; result: AgentResult }> = [];

  async log(request: AgentRequest, result: AgentResult): Promise<void> {
    this.entries.push({ request, result });
  }
}
