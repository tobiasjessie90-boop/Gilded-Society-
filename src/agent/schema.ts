import { z } from "zod";
import type { AgentRequest } from "./types";

const agentRequestSchema = z.object({
  requestId: z.string().min(1),
  action: z.string().min(1),
  service: z.enum(["notion", "github", "slack", "supabase", "openai"]),
  target: z.string().min(1).optional(),
  input: z.record(z.unknown()),
  requestedBy: z.string().min(1),
  dryRun: z.boolean().optional(),
  approvalId: z.string().min(1).optional(),
});

export function parseAgentRequest(input: unknown): AgentRequest {
  return agentRequestSchema.parse(input);
}
