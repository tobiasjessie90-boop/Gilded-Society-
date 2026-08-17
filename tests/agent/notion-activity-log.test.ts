import { expect, it, vi } from "vitest";
import { NotionActivityLogger } from "../../src/agent/notion-activity-log";

it("writes only verified Activity Log properties using the confirmed schema", async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "log-1" }), { status: 200 }));
  const logger = new NotionActivityLogger({
    token: "test",
    dataSourceId: "65bc8ae7-dfad-4f61-8871-471f552c08db",
    fetchImpl,
    now: () => new Date("2026-08-17T14:00:00.000Z"),
  });

  await logger.log(
    {
      requestId: "req-1",
      action: "product.read",
      service: "notion",
      target: "page-1",
      input: { secretLikeField: "not logged" },
      requestedBy: "jessie",
    },
    {
      requestId: "req-1",
      status: "completed",
      verified: true,
      service: "notion",
      action: "product.read",
      message: "Notion page read successfully.",
      externalId: "page-1",
    },
  );

  const [, init] = fetchImpl.mock.calls[0];
  const payload = JSON.parse(String(init?.body));

  expect(payload.parent).toEqual({
    type: "data_source_id",
    data_source_id: "65bc8ae7-dfad-4f61-8871-471f552c08db",
  });
  expect(payload.properties.Activity.title[0].text.content).toBe("notion: product.read");
  expect(payload.properties["Event ID"].rich_text[0].text.content).toBe("req-1");
  expect(payload.properties.Actor.rich_text[0].text.content).toBe("jessie");
  expect(payload.properties.Action.rich_text[0].text.content).toBe("product.read");
  expect(payload.properties.Result.select.name).toBe("Succeeded");
  expect(payload.properties.Timestamp.date.start).toBe("2026-08-17T14:00:00.000Z");
  expect(JSON.stringify(payload)).not.toContain("not logged");
});
