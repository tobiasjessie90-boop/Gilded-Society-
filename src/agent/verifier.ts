import type { AgentResult } from "./types";

export function verifyResult(result: AgentResult): AgentResult {
  if (result.status === "completed" && result.verified && !result.externalId) {
    return {
      ...result,
      status: "failed",
      verified: false,
      message: "Connector did not return verifiable upstream evidence.",
      errorCode: "VERIFICATION_FAILED",
    };
  }

  return result;
}
