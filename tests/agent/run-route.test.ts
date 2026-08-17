import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/agent/run/route";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NOTION_TOKEN;
  delete process.env.NOTION_ACTIVITY_LOG_DATABASE_ID;
});

describe("POST /api/agent/run", () => {
  it("returns 200 with verified evidence for a valid Notion read", async () => {
    process.env.NOTION_TOKEN = "test-token";
    process.env.NOTION_ACTIVITY_LOG_DATABASE_ID = "activity-db";

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "page-123" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "log-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(new Request("http://localhost/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "r1",
        action: "product.read",
        service: "notion",
        target: "page-123",
        input: {},
        requestedBy: "jessie",
      }),
    }));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.verified).toBe(true);
    expect(body.externalId).toBe("page-123");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns validation error for an invalid payload", async () => {
    const response = await POST(new Request("http://localhost/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: "unknown" }),
    }));

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 202 and does not PATCH when approval is missing", async () => {
    process.env.NOTION_TOKEN = "test-token";
    process.env.NOTION_ACTIVITY_LOG_DATABASE_ID = "activity-db";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "log-123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(new Request("http://localhost/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: "r2",
        action: "product.update",
        service: "notion",
        target: "page-123",
        input: { properties: {} },
        requestedBy: "jessie",
      }),
    }));

    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.status).toBe("pending_approval");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.notion.com/v1/pages");
  });
});
