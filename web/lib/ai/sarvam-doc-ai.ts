import "server-only";

import { SarvamAIClient } from "sarvamai";

const schema = {
  type: "object",
  properties: {
    supplier_name: { type: "string", description: "Printed or handwritten wholesaler or supplier name on the invoice." },
    bill_number: { type: "string", description: "Supplier's invoice or bill number, preserving letters and digits." },
    bill_date: { type: "string", description: "Invoice date formatted YYYY-MM-DD." },
    total_amount: { type: "number", description: "Final payable invoice total in INR, digits only." },
    credit_days: { type: "integer", description: "Credit period in days printed on the invoice. Use 0 only when it states cash or no credit; do not infer an unstated term." },
    items: {
      type: "array",
      description: "Every purchase line on the invoice, including quantities and line totals.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Supplier's product description, keeping size and brand where visible." },
          quantity: { type: "number", description: "Purchased quantity as a number, without unit text." },
          unit: { type: "string", description: "Quantity unit, such as kg, litre, case, or pieces." },
          unit_price: { type: "number", description: "Price per quantity unit in INR, digits only." },
          line_total: { type: "number", description: "Final amount for this line in INR, digits only." },
        },
        required: ["name", "quantity", "unit", "unit_price", "line_total"],
      },
    },
  },
  required: ["supplier_name", "bill_number", "bill_date", "total_amount", "items"],
};

export async function extractSupplierBill(file: { name: string; mime: string; bytes: Buffer }) {
  const apiKey = process.env.SARVAM_API_KEY?.trim() || process.env.SARVAM?.trim();
  if (!apiKey) throw new Error("Sarvam Document AI is not configured.");

  const client = new SarvamAIClient({ apiSubscriptionKey: apiKey, timeoutInSeconds: 60, maxRetries: 1 });
  const job = await client.docAi.extract({
    file: [{ data: file.bytes, filename: file.name, contentType: file.mime }],
    schema: JSON.stringify(schema),
    output_format: "json",
    model: process.env.SARVAM_DOCUMENT_MODEL ?? "sarvam-vision-v1",
  }, { timeoutInSeconds: 60, maxRetries: 1 });

  const terminal = new Set(["completed", "partially_completed", "failed", "rejected"]);
  let status = job.status.toLowerCase();
  for (let attempt = 0; !terminal.has(status) && attempt < 45; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    status = (await client.docAi.getStatus(job.job_id, { timeoutInSeconds: 30, maxRetries: 1 })).status.toLowerCase();
  }
  if (status !== "completed" && status !== "partially_completed") throw new Error(`Sarvam document extraction ended with status ${status}.`);
  const result = await client.docAi.getResults(job.job_id, { format: "json" }, { timeoutInSeconds: 30, maxRetries: 1 });
  if (result.type !== "extract") throw new Error(`Sarvam returned ${result.type} results for an extraction request.`);
  return result.result;
}
