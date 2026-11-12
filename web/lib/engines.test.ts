import { describe, expect, it } from "vitest";
import { predictStockout, reconcileDay } from "./engines";
import { classifyIntent, routeSignal, runDemoTool, TOOL_REGISTRY } from "./agent";

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
  it("classifies English and Telugu intents without a network call", () => {
    expect(classifyIntent("check my stock")).toBe("STOCK_QUERY");
    expect(classifyIntent("నెయ్యి స్టాక్ చూడండి")).toBe("STOCK_QUERY");
    expect(classifyIntent("add 24 ghee")).toBe("STOCK_UPDATE");
    expect(classifyIntent("approve it")).toBe("APPROVE");
    expect(classifyIntent("no thanks")).toBe("REJECT");
  });
});
