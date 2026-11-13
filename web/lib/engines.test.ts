import { describe, expect, it } from "vitest";
import { allowedNumbers, forecastAllSkus, getAllCustomerSegments, getCustomerSegments, isDigitSwap, predictStockout, reconcileBills, reconcileDay, reconcileSeededWindow, segmentCustomers, topCandidates, validateNarration } from "./engines";
import { generateSeedData, seededGheeUnitsSold28Days } from "./seed";
import { buildBriefingCards } from "./disha/briefing";
import { classifyIntent, parseStockChange, routeSignal, runDemoTool, TOOL_REGISTRY } from "./agent";
import { canTransition } from "./disha/state-machine";

describe("verified briefing narration", () => {
  const state = { onHand: 5, billRecorded: 69, billExpected: 96, billNumber: 1048, salesTotal: 14296, billCount: 62 };

  it("builds three deterministic cards whose fallback numbers are grounded in facts", () => {
    for (const language of ["en", "te"] as const) {
      const cards = buildBriefingCards(state, language);
      expect(cards.map((card) => card.id)).toEqual(["billing", "retention", "inventory"]);
      for (const card of cards) expect(validateNarration(card.narration, card.facts).valid).toBe(true);
    }
  });

  it("keeps customer identity and balance out of the model facts", () => {
    const retention = buildBriefingCards(state).find((card) => card.id === "retention");
    expect(retention?.facts).not.toHaveProperty("name");
    expect(retention?.facts).not.toHaveProperty("balance_due");
    expect(retention?.facts).toMatchObject({ last_visit_days_ago: 30, usual_gap_days: 14, segment: "At risk" });
  });
});

describe("Disha SRS acceptance cases", () => {
  it("flags the planted sugar price difference without changing a ledger", () => {
    expect(reconcileDay()[0]).toMatchObject({ bill: "#1048", expected: 96, recorded: 69, difference: 27, kind: "DIGIT_SWAP", needsReview: true });
  });
  it("matches the ghee forecast and recalculates a changed stock count", () => {
    expect(predictStockout(5).daysLeft).toBeCloseTo(1.94, 1);
    expect(predictStockout(5)).toMatchObject({ reorderQty: 24, isUrgent: true });
    expect(predictStockout(12).daysLeft).toBeCloseTo(4.67, 1);
    expect(predictStockout(12).reorderQty).toBe(18);
  });
  it("routes every signal deterministically and exposes all seven named tools", () => {
    expect(routeSignal("daily_run")).toEqual(["reconcile_day", "get_customer_segments", "predict_stockout"]);
    expect(routeSignal("daily_run")).toEqual(routeSignal("daily_run"));
    expect(TOOL_REGISTRY).toHaveLength(7);
    expect(runDemoTool("project_cash_flow")).toMatchObject({ status: "Phase 2" });
  });
  it("classifies ten English and ten Telugu intents without a network call", () => {
    const english: [string, string][] = [
      ["check my stock", "STOCK_QUERY"], ["is ghee available", "STOCK_QUERY"],
      ["how many customers are at risk", "CUSTOMER_STATUS"], ["when did Lakshmi last visit", "CUSTOMER_STATUS"],
      ["show today's sales", "TODAY_PRIORITIES"], ["show my priorities", "TODAY_PRIORITIES"],
      ["add 24 ghee", "STOCK_UPDATE"], ["set stock to 12", "STOCK_UPDATE"],
      ["approve this correction", "APPROVE"], ["no thanks", "REJECT"],
    ];
    const telugu: [string, string][] = [
      ["నెయ్యి స్టాక్ చూడండి", "STOCK_QUERY"], ["స్టాక్ ఎంత ఉంది", "STOCK_QUERY"],
      ["కస్టమర్ స్థితి", "CUSTOMER_STATUS"], ["లక్ష్మి ఎప్పుడు వచ్చింది", "CUSTOMER_STATUS"],
      ["ఈ రోజు ముఖ్యమైనవి", "TODAY_PRIORITIES"], ["అమ్మకాలు చూపించండి", "TODAY_PRIORITIES"],
      ["స్టాక్‌ను ౧౨కి మార్చండి", "STOCK_UPDATE"], ["స్టాక్ నుంచి ౨ తగ్గించండి", "STOCK_UPDATE"],
      ["ఆమోదించు", "APPROVE"], ["వద్దు", "REJECT"],
    ];
    for (const [phrase, intent] of [...english, ...telugu]) expect(classifyIntent(phrase)).toBe(intent);
    expect(parseStockChange("add 24 ghee", 5)).toBe(24);
    expect(parseStockChange("set stock to 12", 5)).toBe(7);
    expect(parseStockChange("reduce stock by 2", 5)).toBe(-2);
    expect(parseStockChange("స్టాక్‌ను ౧౨కి మార్చండి", 5)).toBe(7);
    expect(parseStockChange("స్టాక్ నుంచి ౨ తగ్గించండి", 5)).toBe(-2);
    expect(parseStockChange("12 ghee", 5)).toBeNull();
  });
});

describe("data-driven deterministic engines", () => {
  it("generates a reproducible 90-day ledger with the required merchant-scale dataset", () => {
    const seed = generateSeedData();
    const yesterday = seed.bills.filter((bill) => bill.date === "2026-11-13");
    expect(seed.bills).toHaveLength(5402);
    expect(seed.customers).toHaveLength(30);
    expect(seed.skus).toHaveLength(15);
    expect(yesterday).toHaveLength(62);
    expect(yesterday.reduce((sum, bill) => sum + bill.total, 0)).toBe(14296);
    expect(generateSeedData().checksum).toBe(seed.checksum);
    expect(seededGheeUnitsSold28Days(seed)).toBe(72);
  });

  it("reconciles E1-E4 and suppresses the approved E5 discount", () => {
    const rows = reconcileSeededWindow();
    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.bill === "#1048")).toMatchObject({ expected: 96, recorded: 69, difference: 27, kind: "DIGIT_SWAP" });
    expect(rows.find((row) => row.bill === "#1017")).toMatchObject({ expected: 280, recorded: 120, kind: "QTY_MISMATCH" });
    expect(rows.find((row) => row.bill === "#1033")).toMatchObject({ expected: 135, recorded: 0, kind: "MISSING_ITEM" });
    expect(rows.find((row) => row.bill === "#1009")).toMatchObject({ expected: 740, recorded: 700, kind: "PAYMENT_MISMATCH" });
    expect(rows.some((row) => row.bill === "#1040")).toBe(false);
  });

  it("segments the complete 30-customer cohort and forecasts all 15 SKUs", () => {
    const segments = getAllCustomerSegments();
    expect(segments.filter((customer) => customer.segment === "At risk")).toHaveLength(10);
    expect(segments.filter((customer) => customer.segment === "Active")).toHaveLength(15);
    expect(segments.filter((customer) => customer.segment === "New")).toHaveLength(5);
    expect(forecastAllSkus()).toHaveLength(15);
    expect(forecastAllSkus().find((sku) => sku.id === "sku_ghee")).toMatchObject({ unitsSold28Days: 72, reorderQty: 24, isUrgent: true });
  });

  it("recognizes only a single adjacent digit swap", () => {
    expect(isDigitSwap(96, 69)).toBe(true);
    expect(isDigitSwap(123, 132)).toBe(true);
    expect(isDigitSwap(123, 321)).toBe(false);
  });

  it("computes Lakshmi's visit interval and at-risk status from visit dates", () => {
    const lakshmi = getCustomerSegments();
    expect(lakshmi).toMatchObject({ name: "Lakshmi", medianGap: 14, daysSince: 30, segment: "At risk", balance: 340 });
    expect(lakshmi.severity).toBeCloseTo(30 / 14, 2);
    expect(lakshmi.retentionScore).toBe(6857);
    expect(segmentCustomers([{ id: "new", name: "New customer", monthlySpend: 0, visits: ["2026-11-10"] }])[0].segment).toBe("New");
  });

  it("suppresses an approved discount and flags the planted digit swap", () => {
    const bills = [{
      id: "bill-1048",
      number: 1048,
      date: "2026-11-13",
      total: 69,
      lines: [{ skuId: "sugar", item: "Sugar 2 kg", qty: 1, unitPriceRecorded: 69, lineTotalRecorded: 69 }],
      payments: [{ amount: 69 }],
    }];
    expect(reconcileBills(bills, { sugar: 96 })[0]).toMatchObject({
      bill: "#1048", expected: 96, recorded: 69, difference: 27, kind: "DIGIT_SWAP", needsReview: true,
    });
    expect(reconcileBills(bills, { sugar: 96 }, [{ skuId: "sugar", date: "2026-11-13", amount: 27, approved: true }])).toEqual([]);
    expect(reconcileDay(96)[0].needsReview).toBe(false);
  });

  it("recomputes stock-out dates and validates narration numbers", () => {
    expect(predictStockout(5).stockoutDate).toBe("2026-11-15");
    expect(predictStockout(12).stockoutDate).toBe("2026-11-18");
    const facts = { difference: 27, expected: 96, recorded: 69, bill_number: 1048 };
    expect(allowedNumbers(facts).has("27")).toBe(true);
    expect(validateNarration("₹27 difference on Bill #1048 (96 vs 69)", facts).valid).toBe(true);
    expect(validateNarration("₹28 difference on Bill #1048", facts).valid).toBe(false);
    expect(validateNarration("You are pre-approved for credit", facts).valid).toBe(false);
  });

  it("keeps deterministic priority ordering and proposal transitions", () => {
    const candidates = [
      { id: "z", category: "billing" as const, score: 10 },
      { id: "a", category: "billing" as const, score: 10 },
      { id: "late", category: "inventory" as const, score: 1, daysLeft: 4 },
      { id: "urgent", category: "inventory" as const, score: 1, daysLeft: 1 },
    ];
    expect(topCandidates(candidates).map((candidate) => candidate.id)).toEqual(["a", "urgent"]);
    expect(canTransition("PROPOSED", "APPROVED")).toBe(true);
    expect(canTransition("PROPOSED", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "EXECUTED")).toBe(true);
    expect(canTransition("EXECUTED", "APPROVED")).toBe(false);
  });
});
