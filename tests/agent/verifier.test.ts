import { expect, it } from "vitest";
import { verifyResult } from "../../src/agent/verifier";

it("does not allow verified success without an external id", () => {
  const result = verifyResult({
    requestId: "r1",
    status: "completed",
    verified: true,
    service: "notion",
    action: "product.read",
    message: "done",
  });

  expect(result.status).toBe("failed");
  expect(result.errorCode).toBe("VERIFICATION_FAILED");
  expect(result.verified).toBe(false);
});
