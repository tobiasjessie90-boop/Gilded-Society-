import type { ActivityLogger } from "./activity-log";
import type { AgentRequest, AgentResult } from "./types";

const NOTION_PAGES_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28";

type FetchLike = typeof fetch;

type Options = {
  token?: string;
  databaseId?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
};

export class NotionActivityLogger implements ActivityLogger {
  private readonly token?: string;
  private readonly databaseId?: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(options: Options) {
    this.token = options.token;
    this.databaseId = options.databaseId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.databaseId);
  }

  async log(request: AgentRequest, result: AgentResult): Promise<void> {
    if (!this.token || !this.databaseId) return;

    const response = await this.fetchImpl(NOTION_PAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: this.databaseId },
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
        title: [{ type: "text", text: { content: `${request.service}: ${request.action}` } }],
      },
      "Event ID": {
        rich_text: [{ type: "text", text: { content: request.requestId } }],
      },
      Actor: {
        rich_text: [{ type: "text", text: { content: request.requestedBy } }],
      },
      Action: {
        rich_text: [{ type: "text", text: { content: request.action } }],
      },
      Result: { select: { name: resultOption } },
      "Error Details": {
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
        rich_text: [{ type: "text", text: { content: result.message } }],
      },
      Timestamp: { date: { start: this.now().toISOString() } },
    };
  }
}
