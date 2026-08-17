export type AgentService = "notion" | "github" | "slack" | "supabase" | "openai";

export type AgentRequest = {
  requestId: string;
  action: string;
  service: AgentService;
  target?: string;
  input: Record<string, unknown>;
  requestedBy: string;
  dryRun?: boolean;
  approvalId?: string;
};

export type AgentResult = {
  requestId: string;
  status: "completed" | "pending_approval" | "failed" | "blocked";
  verified: boolean;
  service: AgentService;
  action: string;
  message: string;
  externalId?: string;
  errorCode?: AgentErrorCode;
};

export type AgentErrorCode =
  | "VALIDATION_ERROR"
  | "APPROVAL_REQUIRED"
  | "CONNECTOR_NOT_CONFIGURED"
  | "AUTHORIZATION_FAILED"
  | "UPSTREAM_ERROR"
  | "VERIFICATION_FAILED"
  | "ACTION_NOT_ALLOWED";
