import { afterEach, expect, it } from "vitest";
import { GET } from "../../app/api/agent/health/route";

afterEach(() => {
  delete process.env.NOTION_TOKEN;
});

it("returns a per-connector health map without pretending unimplemented connectors are configured", async () => {
  const response = await GET();
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.notion.ok).toBe(false);
  expect(body.github).toEqual({ ok: false, detail: "not configured" });
  expect(body.slack).toEqual({ ok: false, detail: "not configured" });
  expect(body.supabase).toEqual({ ok: false, detail: "not configured" });
  expect(body.openai).toEqual({ ok: false, detail: "not configured" });
});
