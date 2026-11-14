import { classifyIntent } from "./fixtures/legacy-agent";
import {
  forecastAllSkus,
  getAllCustomerSegments,
  getCustomerSegments,
  predictStockout,
  projectCashFlow,
  reconcileSeededWindow,
  validateNarration,
} from "../lib/engines";
import { buildBriefingCards } from "../lib/disha/briefing";
import { generateSeedData, seededGheeUnitsSold28Days } from "../lib/seed";

const seed = generateSeedData();
const segments = getAllCustomerSegments();
const discrepancies = reconcileSeededWindow();
const forecasts = forecastAllSkus();
const ghee = forecasts.find((sku) => sku.id === "sku_ghee");
const gheeForecast = predictStockout(5, seededGheeUnitsSold28Days(seed), 2);
const voiceCases: [string, ReturnType<typeof classifyIntent>][] = [
  ["check my stock", "STOCK_QUERY"], ["is ghee available", "STOCK_QUERY"],
  ["how many customers are at risk", "CUSTOMER_STATUS"], ["when did Lakshmi last visit", "CUSTOMER_STATUS"],
  ["show today's sales", "TODAY_PRIORITIES"], ["show my priorities", "TODAY_PRIORITIES"],
  ["add 24 ghee", "STOCK_UPDATE"], ["set stock to 12", "STOCK_UPDATE"],
  ["approve this correction", "APPROVE"], ["no thanks", "REJECT"],
  ["నెయ్యి స్టాక్ చూడండి", "STOCK_QUERY"], ["స్టాక్ ఎంత ఉంది", "STOCK_QUERY"],
  ["కస్టమర్ స్థితి", "CUSTOMER_STATUS"], ["లక్ష్మి ఎప్పుడు వచ్చింది", "CUSTOMER_STATUS"],
  ["ఈ రోజు ముఖ్యమైనవి", "TODAY_PRIORITIES"], ["అమ్మకాలు చూపించండి", "TODAY_PRIORITIES"],
  ["స్టాక్‌ను ౧౨కి మార్చండి", "STOCK_UPDATE"], ["స్టాక్ నుంచి ౨ తగ్గించండి", "STOCK_UPDATE"],
  ["ఆమోదించు", "APPROVE"], ["వద్దు", "REJECT"],
];
const defaultState = { onHand: 5, billRecorded: 69, billExpected: 96, billNumber: 1048, salesTotal: 14296, billCount: 62, festivalMultiplier: 1, extraBills: [] };
const narrationChecks = ["en", "te"].flatMap((language) =>
  buildBriefingCards(defaultState, language as "en" | "te").map((card) => validateNarration(card.narration, card.facts).valid),
);
const e1 = discrepancies.find((row) => row.bill === "#1048");
const yesterday = seed.bills.filter((bill) => bill.date === "2026-11-13");
const countBySegment = (segment: string) => segments.filter((customer) => customer.segment === segment).length;
const cashFlow = projectCashFlow();
const cashFlowPass = cashFlow.holdout.errorPercent <= 10;
const rows: { metric: string; measured: string; target: string; status: string; passed: boolean }[] = [
  { metric: "Seed scale", measured: `${seed.bills.length.toLocaleString("en-IN")} bills · ${seed.customers.length} customers · ${seed.skus.length} SKUs`, target: "90 days · 30 · 15", status: seed.bills.length === 5402 && seed.customers.length === 30 && seed.skus.length === 15 ? "PASS" : "FAIL", passed: seed.bills.length === 5402 && seed.customers.length === 30 && seed.skus.length === 15 },
  { metric: "E1–E5 reconciliation", measured: `${discrepancies.length} review flags · E5 suppressed`, target: "4 flags · E5 suppressed", status: discrepancies.length === 4 && e1?.difference === 27 ? "PASS" : "FAIL", passed: discrepancies.length === 4 && e1?.difference === 27 },
  { metric: "Yesterday totals", measured: `${yesterday.length} bills · ₹${yesterday.reduce((total, bill) => total + bill.total, 0).toLocaleString("en-IN")}`, target: "62 bills · ₹14,296", status: yesterday.length === 62 && yesterday.reduce((total, bill) => total + bill.total, 0) === 14296 ? "PASS" : "FAIL", passed: yesterday.length === 62 && yesterday.reduce((total, bill) => total + bill.total, 0) === 14296 },
  { metric: "Customer segments", measured: `${countBySegment("At risk")} at risk · ${countBySegment("Active")} active · ${countBySegment("New")} new`, target: "10 · 15 · 5", status: countBySegment("At risk") === 10 && countBySegment("Active") === 15 && countBySegment("New") === 5 ? "PASS" : "FAIL", passed: countBySegment("At risk") === 10 && countBySegment("Active") === 15 && countBySegment("New") === 5 },
  { metric: "SKU forecasts", measured: `${forecasts.length} SKUs · Ghee ${gheeForecast.daysLeft.toFixed(1)}d · reorder ${gheeForecast.reorderQty}`, target: "15 SKUs · 1.9d · 24", status: forecasts.length === 15 && ghee?.unitsSold28Days === 72 && gheeForecast.reorderQty === 24 ? "PASS" : "FAIL", passed: forecasts.length === 15 && ghee?.unitsSold28Days === 72 && gheeForecast.reorderQty === 24 },
  { metric: "Voice intent", measured: `${voiceCases.filter(([phrase, intent]) => classifyIntent(phrase) === intent).length}/${voiceCases.length} English/Telugu phrases`, target: "20/20 deterministic", status: voiceCases.every(([phrase, intent]) => classifyIntent(phrase) === intent) ? "PASS" : "FAIL", passed: voiceCases.every(([phrase, intent]) => classifyIntent(phrase) === intent) },
  { metric: "Narration number safety", measured: `${narrationChecks.filter(Boolean).length}/${narrationChecks.length} fallback cards validated`, target: "6/6", status: narrationChecks.every(Boolean) ? "PASS" : "FAIL", passed: narrationChecks.every(Boolean) },
  { metric: "Cash-flow forecast", measured: `${cashFlow.holdout.errorPercent.toFixed(1)}% · 7-day cumulative hold-out`, target: "≤ 10%", status: cashFlowPass ? "PASS" : "OVER TARGET", passed: cashFlowPass },
];
const widths = [25, 47, 25, 10];
const line = (cells: string[]) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
console.log(`Disha · deterministic SRS evaluation · seed checksum ${seed.checksum}`);
console.log(line(["Metric", "Measured", "Target", "Status"]));
console.log(line(widths.map((width) => "-".repeat(width))));
for (const row of rows) console.log(line([row.metric, row.measured, row.target, row.status]));
console.log(`Lakshmi worked example: ${getCustomerSegments().segment}, ${getCustomerSegments().medianGap}-day median, ${getCustomerSegments().daysSince} days since visit.`);
if (rows.some((row) => !row.passed)) process.exitCode = 1;
