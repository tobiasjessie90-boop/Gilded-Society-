import { expect, it } from "vitest";
import { ConnectorRegistry } from "../../src/agent/registry";
import { runAgentRequest } from "../../src/agent/router";
import { FakeActivityLog } from "../../src/agent/testing/fake-activity-log";
import type { AgentRequest } from "../../src/agent/types";

const validRequest: AgentRequest = {
  requestId: "r1",
  action: "product.read",
  service: "notion",
  input: {},
  requestedBy: "jessie",
};

it("blocks an unregistered connector", async () => {
  const result = await runAgentRequest(validRequest, new ConnectorRegistry([]));
  expect(result.errorCode).toBe("CONNECTOR_NOT_CONFIGURED");
});

it("logs blocked executions exactly once", async () => {
  const log = new FakeActivityLog();
  await runAgentRequest(validRequest, new ConnectorRegistry([]), log);
  expect(log.entries).toHaveLength(1);
  expect(log.entries[0].result.status).toBe("blocked");
});
