import type { AgentConnector } from "../connectors/connector";
import type { AgentRequest, AgentResult, AgentService } from "../types";

export class FakeConnector implements AgentConnector {
  constructor(
    public readonly service: AgentService,
    private readonly result: AgentResult,
    private readonly health = { ok: true as boolean, detail: "fake connector" as string | undefined },
  ) {}

  async execute(_request: AgentRequest): Promise<AgentResult> {
    return this.result;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    return this.health;
  }
}
