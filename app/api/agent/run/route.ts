import { ZodError } from "zod";
import { NotionConnector } from "../../../../src/agent/connectors/notion";
import { NotionActivityLogger } from "../../../../src/agent/notion-activity-log";
import { ConnectorRegistry } from "../../../../src/agent/registry";
import { runAgentRequest } from "../../../../src/agent/router";
import { parseAgentRequest } from "../../../../src/agent/schema";
import type { AgentResult } from "../../../../src/agent/types";

function statusFor(result: AgentResult): number {
  switch (result.status) {
    case "completed":
      return 200;
    case "pending_approval":
      return 202;
    case "blocked":
      return result.errorCode === "CONNECTOR_NOT_CONFIGURED" ? 503 : 409;
    case "failed":
      return result.errorCode === "AUTHORIZATION_FAILED" ? 502 : 500;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const input = await request.json();
    const agentRequest = parseAgentRequest(input);

    const registry = new ConnectorRegistry([
      new NotionConnector({ token: process.env.NOTION_TOKEN }),
    ]);

    const logger = new NotionActivityLogger({
      token: process.env.NOTION_TOKEN,
      dataSourceId: process.env.NOTION_ACTIVITY_LOG_DATA_SOURCE_ID,
    });

    const result = await runAgentRequest(agentRequest, registry, logger);
    return Response.json(result, { status: statusFor(result) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return Response.json(
        {
          status: "failed",
          verified: false,
          errorCode: "VALIDATION_ERROR",
          message: "Invalid agent request.",
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        status: "failed",
        verified: false,
        errorCode: "UPSTREAM_ERROR",
        message: "The agent request could not be completed.",
      },
      { status: 500 },
    );
  }
}
