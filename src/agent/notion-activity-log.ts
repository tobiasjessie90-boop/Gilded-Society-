import type { ActivityLogger } from "./activity-log";
import type { AgentRequest, AgentResult } from "./types";

const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2026-03-11";

type FetchLike = typeof fetch;

type Options = {
  token?: string;
  dataSourceId?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
};

export class NotionActivityLogger implements ActivityLogger {
  private readonly token?: string;
  private readonly dataSourceId?: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(options: Options) {
    this.token = options.token;
    this.dataSourceId = options.dataSourceId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.dataSourceId);
  }

  async log(request: AgentRequest, result: AgentResult): Promise<void> {
    if (!this.token || !this.dataSourceId) return;

    const response = await this.fetchImpl(NOTION_PAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { type: "data_source_id", data_source_id: this.dataSourceId },
        properties: this.properties(request, result),
      }),
    });

    if (!response.ok) {
      throw new Error(`Activity log write failed with HTTP ${response.status}`);
    }
  }

  private properties(request: AgentRequest, result: AgentResult): Record<string, unknown> {
    const resultOption =
      result.status === "completed" && result.verified
        ? "Succeeded"
        : result.status === "pending_approval"
          ? "Warning"
          : "Failed";

    return {
      Activity: {
        type: "title",
        title: [{ type: "text", text: { content: `${request.service}: ${request.action}` } }],
      },
      "Event ID": {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: request.requestId } }],
      },
      Actor: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: request.requestedBy } }],
      },
      Action: {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: request.action } }],
      },
      Result: { type: "select", select: { name: resultOption } },
      "Error Details": {
        type: "rich_text",
        rich_text: [
          {
            type: "text",
            text: {
              content: result.errorCode ? `${result.errorCode}: ${result.message}` : "",
            },
          },
        ],
      },
      "New Value": {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: result.message } }],
      },
      Timestamp: { type: "date", date: { start: this.now().toISOString() } },
    };
  }
}
