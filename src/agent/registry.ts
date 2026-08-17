import type { AgentService } from "./types";
import type { AgentConnector } from "./connectors/connector";

export class ConnectorRegistry {
  private connectors = new Map<AgentService, AgentConnector>();

  constructor(connectors: AgentConnector[]) {
    connectors.forEach((connector) => this.connectors.set(connector.service, connector));
  }

  get(service: AgentService): AgentConnector | undefined {
    return this.connectors.get(service);
  }

  entries(): Array<[AgentService, AgentConnector]> {
    return Array.from(this.connectors.entries());
  }
}
