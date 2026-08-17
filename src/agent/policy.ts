import type { AgentRequest, AgentResult } from "./types";

const approvalTerms = [
  "publish",
  "send",
  "delete",
  "price",
  "overwrite",
  "schema",
  "permission",
  "credential",
];

export function requiresApproval(action: string): boolean {
  const normalized = action.toLowerCase();
  return approvalTerms.some((term) => normalized.includes(term));
}

export function evaluateApproval(request: AgentRequest): AgentResult | null {
  if (!requiresApproval(request.action) || request.approvalId) return null;

  return {
    requestId: request.requestId,
    status: "pending_approval",
    verified: false,
    service: request.service,
    action: request.action,
    message: "Explicit approval is required before this action can execute.",
    errorCode: "APPROVAL_REQUIRED",
  };
}
