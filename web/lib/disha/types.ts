export type ProposalType = "billing_correction" | "message" | "reorder" | "stock_update";

export type ProposalStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";

export type DemoBill = {
  id: string;
  date: string;
  total: number;
  inventoryCost: number;
  gheeQty: number;
};

export type DemoState = {
  onHand: number;
  billRecorded: number;
  billExpected: number;
  billNumber: number;
  salesTotal: number;
  billCount: number;
  festivalMultiplier: number;
  extraBills: DemoBill[];
};

export type CashFlowPoint = {
  date: string;
  forecast: number;
  low: number;
  high: number;
  bandWidth: number;
};

export type CashFlowProjection = {
  status: "ready";
  days: number;
  series: CashFlowPoint[];
  holdout: { days: number; actual: number; forecast: number; errorPercent: number };
};

export type ActivityLog = {
  id: string;
  time: string;
  action: string;
  detail: string;
  result: string;
};

export type ProposalRecord = {
  id: string;
  type: ProposalType;
  status: ProposalStatus;
  facts: Record<string, unknown>;
  reason: string;
  narration: string | null;
  fallback_used: boolean;
  created_at: string;
  resolved_at: string | null;
  outcome: string | null;
  result: Record<string, unknown> | null;
};

export type CustomerSegment = {
  id: string;
  name: string;
  medianGap: number;
  daysSince: number;
  severity: number;
  retentionScore: number;
  segment: "At risk" | "Active" | "New";
  monthlySpend: number;
  balance: number;
};

export type StockForecast = {
  id: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  onHand: number;
  supplierId: string;
  leadTimeDays: number;
  unitsSold28Days: number;
  velocity: number;
  daysLeft: number;
  stockoutDate: string | null;
  safetyBuffer: number;
  onHandAtDelivery: number;
  reorderQty: number;
  isUrgent: boolean;
};

export type DemoAnalytics = {
  customers: CustomerSegment[];
  stock: StockForecast[];
  discrepancies: { bill: string; item: string; expected: number; recorded: number; difference: number; kind: string; needsReview: boolean }[];
  dataset: { asOf: string; start: string; end: string; billCount: number; customerCount: number; skuCount: number; checksum: string };
};

export type DashboardSnapshot = {
  state: DemoState;
  logs: ActivityLog[];
  storageAvailable: boolean;
  analytics: DemoAnalytics;
};
