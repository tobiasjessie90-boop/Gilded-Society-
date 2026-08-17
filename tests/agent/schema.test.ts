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
