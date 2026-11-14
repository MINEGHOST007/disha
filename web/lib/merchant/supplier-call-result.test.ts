import { describe, expect, it } from "vitest";
import { supplierCallResultSchema } from "./supplier-call-result";

describe("supplier call results", () => {
  it("requires seller words before an order can be marked placed", () => {
    expect(supplierCallResultSchema.safeParse({ result: "placed" }).success).toBe(false);
    expect(supplierCallResultSchema.safeParse({ result: "placed", confirmation: "   " }).success).toBe(false);
  });

  it("requires seller words before changed terms enter review", () => {
    expect(supplierCallResultSchema.safeParse({ result: "needs_review", confirmation: "" }).success).toBe(false);
  });

  it("allows cancellation without a seller statement", () => {
    expect(supplierCallResultSchema.parse({ result: "cancelled" })).toEqual({ result: "cancelled", confirmation: "" });
  });
});
