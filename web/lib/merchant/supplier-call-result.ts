import { z } from "zod";

export const supplierCallResultSchema = z.object({
  result: z.enum(["placed", "needs_review", "cancelled"]),
  confirmation: z.string().trim().max(500).default(""),
}).strict().superRefine((value, context) => {
  if (value.result !== "cancelled" && !value.confirmation) {
    context.addIssue({ code: "custom", path: ["confirmation"], message: "Seller confirmation is required for this outcome." });
  }
});
