import { expect, it } from "vitest";
import { evaluateApproval, requiresApproval } from "../../src/agent/policy";

it("requires approval for publishing", () => {
  expect(requiresApproval("listing.publish")).toBe(true);
});

it("requires approval for product updates", () => {
  expect(requiresApproval("product.update")).toBe(true);
});

it("allows read actions without approval", () => {
  expect(requiresApproval("product.read")).toBe(false);
});

it("returns pending approval when required and absent", () => {
  const result = evaluateApproval({
    requestId: "r1",
    action: "product.update",
    service: "notion",
    input: {},
    requestedBy: "jessie",
  });
  expect(result?.status).toBe("pending_approval");
  expect(result?.verified).toBe(false);
});
