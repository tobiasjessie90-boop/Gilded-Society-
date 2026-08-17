import type { ActivityLogger } from "./activity-log";
import { NullActivityLogger } from "./activity-log";
import { evaluateApproval } from "./policy";
import type { AgentRequest, AgentResult } from "./types";
import { ConnectorRegistry } from "./registry";
import { verifyResult } from "./verifier";

export async function runAgentRequest(
  request: AgentRequest,
  registry: ConnectorRegistry,
  logger: ActivityLogger = new NullActivityLogger(),
): Promise<AgentResult> {
  const finalize = async (result: AgentResult): Promise<AgentResult> => {
    await logger.log(request, result);
    return result;
  };

  const approval = evaluateApproval(request);
  if (approval) return finalize(approval);

  const connector = registry.get(request.service);
  if (!connector) {
    return finalize({
      requestId: request.requestId,
      status: "blocked",
      verified: false,
      service: request.service,
      action: request.action,
      message: "Connector is not configured.",
      errorCode: "CONNECTOR_NOT_CONFIGURED",
    });
  }

  try {
    return finalize(verifyResult(await connector.execute(request)));
  } catch {
    return finalize({
      requestId: request.requestId,
      status: "failed",
      verified: false,
      service: request.service,
      action: request.action,
      message: "Connector execution failed.",
      errorCode: "UPSTREAM_ERROR",
    });
  }
}
