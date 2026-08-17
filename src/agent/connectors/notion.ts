import type { AgentConnector } from "./connector";
import type { AgentRequest, AgentResult } from "../types";

const NOTION_BASE_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type FetchLike = typeof fetch;

type NotionConnectorOptions = {
  token?: string;
  fetchImpl?: FetchLike;
};

export class NotionConnector implements AgentConnector {
  readonly service = "notion" as const;
  private readonly token?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: NotionConnectorOptions) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async healthCheck(): Promise<{ ok: boolean; detail?: string }> {
    if (!this.token) return { ok: false, detail: "not configured" };

    try {
      const response = await this.fetchImpl(`${NOTION_BASE_URL}/users/me`, {
        headers: this.headers(),
      });
      return response.ok
        ? { ok: true, detail: "connected" }
        : { ok: false, detail: `Notion returned HTTP ${response.status}` };
    } catch {
      return { ok: false, detail: "Notion health check failed" };
    }
  }

  async execute(request: AgentRequest): Promise<AgentResult> {
    if (!this.token) return this.blocked(request, "Connector is not configured.", "CONNECTOR_NOT_CONFIGURED");
    if (!request.target) return this.blocked(request, "A Notion target page ID is required.", "VALIDATION_ERROR");

    if (request.action !== "product.read" && request.action !== "product.update") {
      return this.blocked(request, "This Notion action is not allowed in v1.", "ACTION_NOT_ALLOWED");
    }

    if (request.dryRun) {
      return {
        requestId: request.requestId,
        status: "completed",
        verified: false,
        service: this.service,
        action: request.action,
        message: "Dry run completed without calling Notion.",
      };
    }

    const method = request.action === "product.read" ? "GET" : "PATCH";
    const response = await this.fetchImpl(`${NOTION_BASE_URL}/pages/${encodeURIComponent(request.target)}`, {
      method,
      headers: this.headers(),
      ...(method === "PATCH" ? { body: JSON.stringify(request.input) } : {}),
    });

    if (!response.ok) {
      return {
        requestId: request.requestId,
        status: "failed",
        verified: false,
        service: this.service,
        action: request.action,
        message: `Notion returned HTTP ${response.status}.`,
        errorCode: response.status === 401 || response.status === 403 ? "AUTHORIZATION_FAILED" : "UPSTREAM_ERROR",
      };
    }

    const payload = (await response.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      return {
        requestId: request.requestId,
        status: "failed",
        verified: false,
        service: this.service,
        action: request.action,
        message: "Notion response did not contain a verifiable object ID.",
        errorCode: "VERIFICATION_FAILED",
      };
    }

    return {
      requestId: request.requestId,
      status: "completed",
      verified: true,
      service: this.service,
      action: request.action,
      message: request.action === "product.read" ? "Notion page read successfully." : "Notion page updated successfully.",
      externalId: payload.id,
    };
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };
  }

  private blocked(
    request: AgentRequest,
    message: string,
    errorCode: AgentResult["errorCode"],
  ): AgentResult {
    return {
      requestId: request.requestId,
      status: "blocked",
      verified: false,
      service: this.service,
      action: request.action,
      message,
      errorCode,
    };
  }
}
