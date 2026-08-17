import type { AgentRequest, AgentResult, AgentService } from "../types";

export interface AgentConnector {
  service: AgentService;
  execute(request: AgentRequest): Promise<AgentResult>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
