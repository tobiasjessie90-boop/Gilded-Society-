import type { AgentRequest, AgentResult } from "./types";

export interface ActivityLogger {
  log(request: AgentRequest, result: AgentResult): Promise<void>;
}

export class NullActivityLogger implements ActivityLogger {
  async log(_request: AgentRequest, _result: AgentResult): Promise<void> {
    return;
  }
}
