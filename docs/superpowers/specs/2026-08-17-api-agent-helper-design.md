# API Agent Helper v1 — Design Specification

## Goal
Build a reusable API Agent Helper that gives The Gilded Society one command surface for routing verified actions to connected services while preserving human approval for consequential changes.

## Product Form
The product has two layers:

1. **Agent API backend** — accepts structured tasks, validates them, routes them to a connector adapter, enforces approval policy, records outcomes, and returns a verified result.
2. **Visual Agent Dashboard** — provides a command box, integration status, approval queue, recent activity, errors/retries, and quick actions.

## Existing System Grounding
The Product Factory already contains dedicated Notion structures for Approvals, Integrations, and Activity Log. API Agent Helper v1 reuses those structures instead of creating duplicate operational databases.

## Core Architecture

```text
Dashboard / API Client
        |
        v
Request Validator
        |
        v
Agent Router
        |
        +--> Policy / Approval Gate
        |
        +--> Connector Registry
               |-- Notion
               |-- GitHub
               |-- Slack
               |-- Supabase
               `-- OpenAI
        |
        v
Result Verifier
        |
        v
Activity Log
```

## Request Contract

```ts
export type AgentRequest = {
  requestId: string;
  action: string;
  service: "notion" | "github" | "slack" | "supabase" | "openai";
  target?: string;
  input: Record<string, unknown>;
  requestedBy: string;
  dryRun?: boolean;
};
```

## Result Contract

```ts
export type AgentResult = {
  requestId: string;
  status: "completed" | "pending_approval" | "failed" | "blocked";
  verified: boolean;
  service: AgentRequest["service"];
  action: string;
  message: string;
  externalId?: string;
  errorCode?: string;
};
```

## Approval Policy
Approval is required before any action that:

- publishes content;
- sends an external message;
- deletes data;
- changes a live price;
- overwrites or removes a live file;
- performs a destructive database/schema operation;
- changes permissions or credentials.

Read-only searches, summaries, validation, readiness analysis, missing-asset detection, draft preparation, and checklist generation may run without approval.

## Verification Rule
No action may return `status: "completed"` with `verified: true` unless the target connector returns evidence of success such as an object ID, commit SHA, message ID, page ID, or other service-specific success response.

If a connector is missing, unavailable, unauthorized, or returns an ambiguous result, the request must return `failed` or `blocked`; the helper must never simulate success.

## Connector Boundary
Every connector must implement the same interface:

```ts
export interface AgentConnector {
  service: AgentRequest["service"];
  execute(request: AgentRequest): Promise<AgentResult>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
```

Connectors are isolated so one service can be added, removed, or repaired without changing the router.

## v1 Connector Sequence
1. Notion
2. GitHub
3. Slack
4. Supabase
5. OpenAI

Notion is first because the Product Factory already uses Notion for product records, approvals, integrations, and activity logs.

## Dashboard v1
The dashboard should contain:

- command input;
- project/product selector;
- service selector with automatic routing option;
- connected-service health status;
- approval queue;
- recent agent actions;
- error/retry center;
- quick actions for common Product Factory work;
- clear dry-run indicator.

## Error Handling
Errors use stable error codes and never expose secrets. Minimum codes:

- `VALIDATION_ERROR`
- `APPROVAL_REQUIRED`
- `CONNECTOR_NOT_CONFIGURED`
- `AUTHORIZATION_FAILED`
- `UPSTREAM_ERROR`
- `VERIFICATION_FAILED`
- `ACTION_NOT_ALLOWED`

Retries are allowed only for safe, idempotent operations or connector calls explicitly marked retry-safe.

## Security
- Secrets live only in environment variables or approved secret storage.
- No API keys are stored in Notion, source code, browser local storage, or logs.
- Dashboard never displays raw secrets.
- Every consequential action records who requested it, what was requested, the approval state, and the verified outcome.

## Activity Logging
Each execution records:

- request ID;
- timestamp;
- requested by;
- service;
- action;
- target;
- approval status;
- final status;
- verification status;
- external result identifier when available;
- safe error code/message when applicable.

## Initial Technology Direction
Because the repository contains no application framework yet, v1 will use a single TypeScript codebase with Next.js App Router for the dashboard and API route handlers, Zod for runtime validation, and Vitest for unit tests. Connector implementations remain framework-independent modules so they can later move into a separate worker/service if scale requires it.

## Acceptance Criteria
API Agent Helper v1 is acceptable when:

1. A valid request can be submitted through an API endpoint.
2. Invalid requests fail validation deterministically.
3. Approval-required actions cannot execute before approval.
4. Notion connector can perform at least one read operation and one approved write operation.
5. Every execution produces an activity-log record.
6. No successful result is marked verified without upstream confirmation.
7. Missing credentials/configuration produce a visible failure rather than simulated success.
8. Dashboard displays command input, integration health, approvals, activity, and errors.
9. Automated tests cover validation, routing, approval policy, verification, and Notion connector behavior using mocks.

## Non-Goals for v1
- Fully autonomous publishing.
- Payment processing.
- Credential management UI.
- Arbitrary code execution.
- Automatic destructive retries.
- Building every connector before the Notion vertical slice is working.

## Implementation Boundary
The first working vertical slice is: request -> validation -> router -> approval policy -> Notion connector -> verification -> activity log -> dashboard result. Additional connectors are added only after that path is tested.