# API Agent Helper v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a verified API Agent Helper with a dashboard, approval gates, Notion-first integration, and a connector architecture that can later support GitHub, Slack, Supabase, and OpenAI.

**Architecture:** Use one TypeScript/Next.js repository for the first vertical slice. API route handlers receive requests; framework-independent modules perform validation, routing, approval checks, connector execution, result verification, and activity logging. Start with a Notion connector and mock the upstream API in tests.

**Tech Stack:** Next.js App Router, TypeScript, Zod, Vitest, React, server-side environment variables.

## Global Constraints

- Never mark an action completed and verified without upstream evidence.
- Consequential actions require explicit approval before execution.
- Secrets must never be committed, logged, stored in Notion, or exposed to the browser.
- Start with the Notion vertical slice before adding other connectors.
- Use stable error codes for validation, approval, configuration, authorization, upstream, verification, and policy failures.
- Keep connector modules framework-independent.

---

## File Structure

```text
app/
  api/agent/run/route.ts
  api/agent/health/route.ts
  agent/page.tsx
  agent/AgentConsole.tsx
src/agent/
  types.ts
  schema.ts
  errors.ts
  policy.ts
  router.ts
  verifier.ts
  registry.ts
  activity-log.ts
  connectors/
    connector.ts
    notion.ts
  testing/
    fake-connector.ts
    fake-activity-log.ts
tests/agent/
  schema.test.ts
  policy.test.ts
  router.test.ts
  verifier.test.ts
  notion.test.ts
  run-route.test.ts
  health-route.test.ts
.env.example
package.json
vitest.config.ts
tsconfig.json
```

Each file has one responsibility: contracts, validation, policy, routing, verification, connector registration, logging, connector implementation, HTTP transport, or UI.

---

### Task 1: Scaffold the TypeScript testable application

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/agent/types.ts`
- Create: `src/agent/errors.ts`
- Test: `tests/agent/schema.test.ts`

**Interfaces:**
- Produces `AgentService`, `AgentRequest`, `AgentResult`, `AgentErrorCode` types used by every later task.

- [ ] **Step 1: Add the project manifest**

```json
{
  "name": "gilded-society-api-agent-helper",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Add strict TypeScript configuration**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Vitest configuration**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 4: Define shared contracts**

```ts
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
```

- [ ] **Step 5: Add example environment keys without secrets**

```dotenv
NOTION_TOKEN=
NOTION_PRODUCT_FACTORY_PAGE_ID=
NOTION_APPROVALS_DATABASE_ID=
NOTION_ACTIVITY_LOG_DATABASE_ID=
```

- [ ] **Step 6: Install and verify the test runner starts**

Run: `npm install && npm test`

Expected: Vitest starts successfully; no application test failures exist yet.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .env.example src/agent/types.ts src/agent/errors.ts
git commit -m "chore: scaffold API agent helper"
```

---

### Task 2: Validate every incoming agent request

**Files:**
- Create: `src/agent/schema.ts`
- Test: `tests/agent/schema.test.ts`

**Interfaces:**
- Produces `parseAgentRequest(input: unknown): AgentRequest`.

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from "vitest";
import { parseAgentRequest } from "../../src/agent/schema";

describe("parseAgentRequest", () => {
  it("accepts a valid request", () => {
    expect(parseAgentRequest({
      requestId: "req-1",
      action: "product.read",
      service: "notion",
      input: {},
      requestedBy: "jessie"
    }).service).toBe("notion");
  });

  it("rejects an unsupported service", () => {
    expect(() => parseAgentRequest({
      requestId: "req-2",
      action: "x",
      service: "unknown",
      input: {},
      requestedBy: "jessie"
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx vitest run tests/agent/schema.test.ts`

Expected: FAIL because `parseAgentRequest` does not exist.

- [ ] **Step 3: Implement Zod validation**

```ts
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
```

- [ ] **Step 4: Run the test and confirm pass**

Run: `npx vitest run tests/agent/schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/schema.ts tests/agent/schema.test.ts
git commit -m "feat: validate agent requests"
```

---

### Task 3: Enforce approval policy before connector execution

**Files:**
- Create: `src/agent/policy.ts`
- Test: `tests/agent/policy.test.ts`

**Interfaces:**
- Produces `requiresApproval(action: string): boolean`.
- Produces `evaluateApproval(request: AgentRequest): AgentResult | null`.

- [ ] **Step 1: Write failing policy tests**

```ts
import { describe, expect, it } from "vitest";
import { evaluateApproval, requiresApproval } from "../../src/agent/policy";

it("requires approval for publishing", () => {
  expect(requiresApproval("listing.publish")).toBe(true);
});

it("allows read actions without approval", () => {
  expect(requiresApproval("product.read")).toBe(false);
});

it("returns pending approval when required and absent", () => {
  const result = evaluateApproval({
    requestId: "r1",
    action: "listing.publish",
    service: "notion",
    input: {},
    requestedBy: "jessie"
  });
  expect(result?.status).toBe("pending_approval");
  expect(result?.verified).toBe(false);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/agent/policy.test.ts`

Expected: FAIL because policy functions do not exist.

- [ ] **Step 3: Implement explicit consequential-action matching**

```ts
import type { AgentRequest, AgentResult } from "./types";

const approvalTerms = ["publish", "send", "delete", "price", "overwrite", "schema", "permission", "credential"];

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
    errorCode: "APPROVAL_REQUIRED"
  };
}
```

- [ ] **Step 4: Run and confirm pass**

Run: `npx vitest run tests/agent/policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/policy.ts tests/agent/policy.test.ts
git commit -m "feat: enforce approval policy"
```

---

### Task 4: Add the connector interface, registry, router, and verifier

**Files:**
- Create: `src/agent/connectors/connector.ts`
- Create: `src/agent/registry.ts`
- Create: `src/agent/router.ts`
- Create: `src/agent/verifier.ts`
- Create: `src/agent/testing/fake-connector.ts`
- Test: `tests/agent/router.test.ts`
- Test: `tests/agent/verifier.test.ts`

**Interfaces:**
- `AgentConnector.execute(request): Promise<AgentResult>`
- `AgentConnector.healthCheck(): Promise<{ ok: boolean; detail?: string }>`
- `ConnectorRegistry.get(service): AgentConnector | undefined`
- `runAgentRequest(request, registry): Promise<AgentResult>`
- `verifyResult(result): AgentResult`

- [ ] **Step 1: Write failing router and verification tests**

```ts
it("blocks an unregistered connector", async () => {
  const result = await runAgentRequest(validRequest, new ConnectorRegistry([]));
  expect(result.errorCode).toBe("CONNECTOR_NOT_CONFIGURED");
});

it("does not allow verified success without an external id", () => {
  const result = verifyResult({
    requestId: "r1",
    status: "completed",
    verified: true,
    service: "notion",
    action: "product.read",
    message: "done"
  });
  expect(result.status).toBe("failed");
  expect(result.errorCode).toBe("VERIFICATION_FAILED");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/agent/router.test.ts tests/agent/verifier.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the connector interface**

```ts
import type { AgentRequest, AgentResult, AgentService } from "../types";

export interface AgentConnector {
  service: AgentService;
  execute(request: AgentRequest): Promise<AgentResult>;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
}
```

- [ ] **Step 4: Implement registry and router**

```ts
export class ConnectorRegistry {
  private connectors = new Map<AgentService, AgentConnector>();
  constructor(connectors: AgentConnector[]) {
    connectors.forEach((connector) => this.connectors.set(connector.service, connector));
  }
  get(service: AgentService) {
    return this.connectors.get(service);
  }
}
```

```ts
export async function runAgentRequest(request: AgentRequest, registry: ConnectorRegistry): Promise<AgentResult> {
  const approval = evaluateApproval(request);
  if (approval) return approval;

  const connector = registry.get(request.service);
  if (!connector) {
    return {
      requestId: request.requestId,
      status: "blocked",
      verified: false,
      service: request.service,
      action: request.action,
      message: "Connector is not configured.",
      errorCode: "CONNECTOR_NOT_CONFIGURED"
    };
  }

  return verifyResult(await connector.execute(request));
}
```

- [ ] **Step 5: Implement verification**

```ts
export function verifyResult(result: AgentResult): AgentResult {
  if (result.status === "completed" && result.verified && !result.externalId) {
    return {
      ...result,
      status: "failed",
      verified: false,
      message: "Connector did not return verifiable upstream evidence.",
      errorCode: "VERIFICATION_FAILED"
    };
  }
  return result;
}
```

- [ ] **Step 6: Run and confirm pass**

Run: `npx vitest run tests/agent/router.test.ts tests/agent/verifier.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/agent/connectors/connector.ts src/agent/registry.ts src/agent/router.ts src/agent/verifier.ts src/agent/testing/fake-connector.ts tests/agent/router.test.ts tests/agent/verifier.test.ts
git commit -m "feat: add connector routing and verification"
```

---

### Task 5: Implement the Notion connector with explicit action mapping

**Files:**
- Create: `src/agent/connectors/notion.ts`
- Test: `tests/agent/notion.test.ts`

**Interfaces:**
- Consumes `AgentConnector`, `AgentRequest`, `AgentResult`.
- Produces `NotionConnector`.

- [ ] **Step 1: Write failing Notion connector tests using a mocked fetch implementation**

```ts
it("returns verified success only when Notion returns an object id", async () => {
  const connector = new NotionConnector({
    token: "test",
    fetchImpl: async () => new Response(JSON.stringify({ id: "page-123" }), { status: 200 })
  });
  const result = await connector.execute({
    requestId: "r1",
    action: "product.read",
    service: "notion",
    target: "page-123",
    input: {},
    requestedBy: "jessie"
  });
  expect(result.verified).toBe(true);
  expect(result.externalId).toBe("page-123");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/agent/notion.test.ts`

Expected: FAIL because `NotionConnector` does not exist.

- [ ] **Step 3: Implement only two v1 actions**

Map:

```text
product.read   -> GET /v1/pages/{target}
product.update -> PATCH /v1/pages/{target}
```

Reject every other action with `ACTION_NOT_ALLOWED` until explicitly added and tested.

- [ ] **Step 4: Ensure missing token fails health check and execution**

Expected connector result:

```ts
{
  status: "blocked",
  verified: false,
  errorCode: "CONNECTOR_NOT_CONFIGURED"
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/agent/notion.test.ts`

Expected: PASS for read, approved update, missing token, unsupported action, and upstream failure cases.

- [ ] **Step 6: Commit**

```bash
git add src/agent/connectors/notion.ts tests/agent/notion.test.ts
git commit -m "feat: add Notion connector"
```

---

### Task 6: Add activity logging as a required post-execution step

**Files:**
- Create: `src/agent/activity-log.ts`
- Create: `src/agent/testing/fake-activity-log.ts`
- Modify: `src/agent/router.ts`
- Test: `tests/agent/router.test.ts`

**Interfaces:**
- Produces `ActivityLogger.log(request, result): Promise<void>`.
- Router receives an `ActivityLogger` dependency and logs every final result, including blocked and failed results.

- [ ] **Step 1: Write a failing test that proves blocked requests are logged**

```ts
it("logs blocked executions", async () => {
  const log = new FakeActivityLog();
  await runAgentRequest(validRequest, new ConnectorRegistry([]), log);
  expect(log.entries).toHaveLength(1);
  expect(log.entries[0].result.status).toBe("blocked");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/agent/router.test.ts`

Expected: FAIL because router does not accept a logger.

- [ ] **Step 3: Implement logger interface and fake**

```ts
export interface ActivityLogger {
  log(request: AgentRequest, result: AgentResult): Promise<void>;
}
```

- [ ] **Step 4: Update router to log exactly once before return**

Use one finalization helper so every exit path logs consistently.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/agent/router.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agent/activity-log.ts src/agent/testing/fake-activity-log.ts src/agent/router.ts tests/agent/router.test.ts
git commit -m "feat: log every agent execution"
```

---

### Task 7: Expose the agent through HTTP endpoints

**Files:**
- Create: `app/api/agent/run/route.ts`
- Create: `app/api/agent/health/route.ts`
- Test: `tests/agent/run-route.test.ts`
- Test: `tests/agent/health-route.test.ts`

**Interfaces:**
- `POST /api/agent/run`
- `GET /api/agent/health`

- [ ] **Step 1: Write failing route tests**

Test cases:

```text
POST valid read request -> 200 + AgentResult
POST invalid payload -> 400 + VALIDATION_ERROR
POST approval-required request without approval -> 202 + pending_approval
GET health -> 200 + per-connector health map
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/agent/run-route.test.ts tests/agent/health-route.test.ts`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement request route**

The handler must:

1. parse JSON;
2. call `parseAgentRequest`;
3. build the registry server-side;
4. run the router;
5. map result status to HTTP status without exposing secrets.

- [ ] **Step 4: Implement health route**

Return only:

```ts
{
  notion: { ok: boolean, detail?: string },
  github: { ok: false, detail: "not configured" },
  slack: { ok: false, detail: "not configured" },
  supabase: { ok: false, detail: "not configured" },
  openai: { ok: false, detail: "not configured" }
}
```

until those connectors are truly implemented.

- [ ] **Step 5: Run route tests**

Run: `npx vitest run tests/agent/run-route.test.ts tests/agent/health-route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/agent/run/route.ts app/api/agent/health/route.ts tests/agent/run-route.test.ts tests/agent/health-route.test.ts
git commit -m "feat: expose API agent routes"
```

---

### Task 8: Build the first dashboard screen

**Files:**
- Create: `app/agent/page.tsx`
- Create: `app/agent/AgentConsole.tsx`

**Interfaces:**
- Consumes `/api/agent/run` and `/api/agent/health`.
- Produces a user-visible command surface without exposing credentials.

- [ ] **Step 1: Implement the dashboard shell**

Include visible regions for:

```text
API Agent Helper
Command
Project / target
Service
Dry run
Run button
Integration health
Approval status
Latest result
Recent activity placeholder
Error message area
```

- [ ] **Step 2: Implement request submission**

Generate a browser-side `requestId` with `crypto.randomUUID()`, submit to `/api/agent/run`, and render the returned `AgentResult`.

- [ ] **Step 3: Implement health loading**

Fetch `/api/agent/health` and render each service as connected, unavailable, or not configured based strictly on the API response.

- [ ] **Step 4: Verify no environment variable or secret is referenced in client code**

Run: `grep -R "NOTION_TOKEN\|OPENAI_API_KEY\|SUPABASE.*KEY" app/agent src/agent || true`

Expected: No secret values or client-side secret references.

- [ ] **Step 5: Build the application**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/agent/page.tsx app/agent/AgentConsole.tsx
git commit -m "feat: add API agent dashboard"
```

---

### Task 9: Add the real Notion activity-log adapter only after schema verification

**Files:**
- Create: `src/agent/notion-activity-log.ts`
- Modify: `app/api/agent/run/route.ts`
- Test: `tests/agent/notion-activity-log.test.ts`

**Interfaces:**
- Produces `NotionActivityLogger` implementing `ActivityLogger`.

- [ ] **Step 1: Retrieve the actual Activity Log database schema before writing code**

Use the Notion API/connector to fetch the database and record the exact property names in the test fixture.

Do not guess property names.

- [ ] **Step 2: Write a failing test using that verified schema fixture**

The test must assert the exact payload shape sent to Notion.

- [ ] **Step 3: Implement the logger against the verified schema**

Map request/result fields only to properties confirmed to exist. If a desired property is absent, fail configuration validation instead of inventing it.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/agent/notion-activity-log.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/agent/notion-activity-log.ts app/api/agent/run/route.ts tests/agent/notion-activity-log.test.ts
git commit -m "feat: persist verified activity to Notion"
```

---

### Task 10: Verification gate for the Notion-first vertical slice

**Files:**
- Modify only files required by failures discovered in this verification pass.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Perform a dry-run request with no credentials**

Expected: visible `CONNECTOR_NOT_CONFIGURED`; never a simulated success.

- [ ] **Step 4: Perform a configured Notion read using a test page**

Expected: `completed`, `verified: true`, and a real Notion object ID.

- [ ] **Step 5: Submit an approval-required update without approval**

Expected: `pending_approval`; no upstream PATCH request is sent.

- [ ] **Step 6: Submit the same approved update against a non-production test page**

Expected: `completed`, `verified: true`, and the returned Notion page ID.

- [ ] **Step 7: Confirm an Activity Log row exists for each attempted action**

Expected: one record per request with accurate final status and no secret values.

- [ ] **Step 8: Commit any verification-only fixes**

```bash
git add -A
git commit -m "test: verify Notion-first agent vertical slice"
```

---

## Follow-on Plans

Do not mix these into the first vertical slice. After Task 10 passes, create separate implementation plans for:

1. GitHub connector.
2. Slack connector.
3. Supabase connector.
4. OpenAI connector.
5. Notion-backed approval queue lifecycle.
6. Dashboard activity/history and retry UX.

Each connector plan must preserve the same request/result contracts and verification rule.

## Self-Review

- Spec coverage: request validation, approval gating, connector isolation, Notion-first implementation, verification, activity logging, HTTP API, dashboard, health status, errors, and security boundaries are represented.
- Placeholder scan: no TBD/TODO implementation placeholders remain.
- Type consistency: `AgentRequest`, `AgentResult`, `AgentConnector`, `ConnectorRegistry`, `ActivityLogger`, and error-code names are consistent across tasks.
- Scope: v1 is intentionally limited to a working Notion vertical slice before additional connectors.