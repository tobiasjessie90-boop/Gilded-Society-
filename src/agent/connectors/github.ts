import type { AgentConnector } from "./connector";
import type { AgentRequest, AgentResult } from "../types";

type FetchLike = typeof fetch;
const API = "https://api.github.com";
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+$/;

export class GitHubConnector implements AgentConnector {
  readonly service = "github" as const;
  constructor(private readonly options: { token?: string; fetchImpl?: FetchLike } = {}) {}

  async healthCheck() {
    if (!this.options.token) return { ok: false, detail: "not configured" };
    try {
      const response = await this.fetchImpl(`${API}/user`, { headers: this.headers() });
      return { ok: response.ok, detail: response.ok ? "connected" : `GitHub returned HTTP ${response.status}` };
    } catch {
      return { ok: false, detail: "GitHub health check failed" };
    }
  }

  async execute(request: AgentRequest): Promise<AgentResult> {
    const result = (status: AgentResult["status"], message: string, errorCode?: AgentResult["errorCode"], externalId?: string): AgentResult =>
      ({ requestId: request.requestId, service: this.service, action: request.action, status,
         verified: status === "completed" && !!externalId, message, errorCode, externalId });

    if (!this.options.token) return result("blocked", "GitHub is not configured.", "CONNECTOR_NOT_CONFIGURED");
    if (!["repository.read", "repository.file.read", "pull_request.read"].includes(request.action))
      return result("blocked", "GitHub action is not allowed in v2.", "ACTION_NOT_ALLOWED");
    const repo = request.target;
    if (!repo || !REPO.test(repo) || repo.includes(".."))
      return result("blocked", "Target must be owner/repository.", "VALIDATION_ERROR");
    const path = request.input.path;
    const number = request.input.number;
    let endpoint = `/repos/${repo}`;
    if (request.action === "repository.file.read") {
      if (typeof path !== "string" || !SAFE_PATH.test(path))
        return result("blocked", "Invalid repository file path.", "VALIDATION_ERROR");
      endpoint += `/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
    }
    if (request.action === "pull_request.read") {
      if (!Number.isSafeInteger(number) || (number as number) <= 0)
        return result("blocked", "Invalid pull request number.", "VALIDATION_ERROR");
      endpoint += `/pulls/${number}`;
    }
    if (request.dryRun) return result("completed", "Dry run: no GitHub API request made.");
    try {
      const response = await this.fetchImpl(API + endpoint, { method: "GET", headers: this.headers() });
      if (!response.ok)
        return result("failed", `GitHub returned HTTP ${response.status}.`,
          response.status === 401 || response.status === 403 ? "AUTHORIZATION_FAILED" : "UPSTREAM_ERROR");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("url" in payload) || typeof payload.url !== "string")
        return result("failed", "GitHub response lacks verifiable resource URL.", "VERIFICATION_FAILED");
      return result("completed", "GitHub resource retrieved successfully.", undefined, payload.url);
    } catch {
      return result("failed", "GitHub request failed.", "UPSTREAM_ERROR");
    }
  }

  private get fetchImpl(): FetchLike { return this.options.fetchImpl ?? fetch; }
  private headers() {
    return { Authorization: `Bearer ${this.options.token}`, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" };
  }
}
