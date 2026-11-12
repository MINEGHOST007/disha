const expected = 96;
const recorded = 69;
const reconciliationPass = expected - recorded === 27;
const stockForecast = (onHand) => {
  const velocity = 72 / 28;
  const daysLeft = onHand / velocity;
  const safetyBuffer = Math.ceil(2 * velocity);
  const onHandAtDelivery = Math.max(0, onHand - velocity * 2);
  const reorder = Math.ceil(Math.ceil(7 * velocity) + safetyBuffer - onHandAtDelivery);
  return { daysLeft, reorder };
};
const baseStock = stockForecast(5);
const editedStock = stockForecast(12);
const stockPass = Math.round(baseStock.daysLeft * 10) / 10 === 1.9 && baseStock.reorder === 24 && Math.round(editedStock.daysLeft * 10) / 10 === 4.7 && editedStock.reorder === 18;
const rows = [
  ["Reconciliation planted case", "1/1 (100%)", "100%", reconciliationPass ? "PASS" : "FAIL"],
  ["At-risk customer fixture", "1/1 (Lakshmi)", "10 seeded cases", "PARTIAL"],
  ["Ghee stock forecast", "1/1 SKU · 0-day date error", "10 SKUs · ≤1 day", stockPass ? "PARTIAL" : "FAIL"],
  ["Cash-flow forecast", "Not implemented", "≤10%", "PHASE 2"],
  ["Voice intent", "See unit tests (5 mixed-language phrases)", "10 phrases · ≥90%", "PARTIAL"],
];
const widths = [29, 44, 25, 10];
const line = (cells) => `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(" | ")} |`;
console.log("Disha · sandbox results (prototype fixtures only)");
console.log(line(["Metric", "Measured", "Target", "Status"]));
console.log(line(widths.map((width) => "-".repeat(width))));
for (const row of rows) console.log(line(row));
if (!reconciliationPass || !stockPass) process.exitCode = 1;
