import { expect, it } from "vitest";
import { NotionConnector } from "../../src/agent/connectors/notion";

it("returns verified success only when Notion returns an object id", async () => {
  const connector = new NotionConnector({
    token: "test",
    fetchImpl: async () => new Response(JSON.stringify({ id: "page-123" }), { status: 200 }),
  });

  const result = await connector.execute({
    requestId: "r1",
    action: "product.read",
    service: "notion",
    target: "page-123",
    input: {},
    requestedBy: "jessie",
  });

  expect(result.verified).toBe(true);
  expect(result.externalId).toBe("page-123");
});

it("blocks execution when the token is missing", async () => {
  const connector = new NotionConnector({ token: undefined });
  const result = await connector.execute({
    requestId: "r2",
    action: "product.read",
    service: "notion",
    target: "page-123",
    input: {},
    requestedBy: "jessie",
  });

  expect(result.status).toBe("blocked");
  expect(result.errorCode).toBe("CONNECTOR_NOT_CONFIGURED");
});

it("rejects unsupported Notion actions", async () => {
  const connector = new NotionConnector({ token: "test" });
  const result = await connector.execute({
    requestId: "r3",
    action: "database.delete",
    service: "notion",
    target: "page-123",
    input: {},
    requestedBy: "jessie",
    approvalId: "approval-1",
  });

  expect(result.status).toBe("blocked");
  expect(result.errorCode).toBe("ACTION_NOT_ALLOWED");
});

it("returns upstream failure without verified success", async () => {
  const connector = new NotionConnector({
    token: "test",
    fetchImpl: async () => new Response("server error", { status: 500 }),
  });
  const result = await connector.execute({
    requestId: "r4",
    action: "product.read",
    service: "notion",
    target: "page-123",
    input: {},
    requestedBy: "jessie",
  });

  expect(result.status).toBe("failed");
  expect(result.verified).toBe(false);
  expect(result.errorCode).toBe("UPSTREAM_ERROR");
});
