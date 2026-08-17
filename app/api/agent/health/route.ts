import { NotionConnector } from "../../../../src/agent/connectors/notion";

export async function GET(): Promise<Response> {
  const notion = new NotionConnector({ token: process.env.NOTION_TOKEN });

  return Response.json({
    notion: await notion.healthCheck(),
    github: { ok: false, detail: "not configured" },
    slack: { ok: false, detail: "not configured" },
    supabase: { ok: false, detail: "not configured" },
    openai: { ok: false, detail: "not configured" },
  });
}
