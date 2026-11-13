import { AS_OF } from "./disha/constants";

export { AS_OF } from "./disha/constants";
export const LEDGER_START = "2026-08-16";
export const LEDGER_END = "2026-11-13";
export const SEED_RANDOM = 20261114;

export type SeedLine = {
  skuId: string;
  item: string;
  qty: number;
  unitPriceRecorded: number;
  lineTotalRecorded: number;
};

export type SeedBill = {
  id: string;
  number: number;
  date: string;
  customerId: string | null;
  paymentMode: "cash" | "upi" | "card";
  total: number;
  lines: SeedLine[];
  payments: { amount: number; mode: "cash" | "upi" | "card" }[];
};

export type SeedCustomer = {
  id: string;
  name: string;
  monthlySpend: number;
  balanceDue: number;
  consentToMessage: boolean;
  visits: string[];
};

export type SeedSku = {
  id: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  onHand: number;
  supplierId: string;
  leadTimeDays: number;
};

export type DemoSeedData = {
  asOf: string;
  merchant: { id: string; name: string; owner: string; city: string; state: string };
  customers: SeedCustomer[];
  skus: SeedSku[];
  suppliers: { id: string; name: string; phone: string }[];
  bills: SeedBill[];
  discounts: { skuId: string; date: string; amount: number; approved: boolean }[];
  stockMovements: { id: string; billId: string; skuId: string; date: string; qty: number }[];
  checksum: string;
};

const suppliers = [
  { id: "supplier_sri_lakshmi", name: "Sri Lakshmi Distributors", phone: "+91-90000-00001" },
  { id: "supplier_deccan", name: "Deccan Wholesale Mart", phone: "+91-90000-00002" },
  { id: "supplier_city", name: "City Daily Needs", phone: "+91-90000-00003" },
];

const skuDefinitions = [
  ["sku_sugar", "Sugar 2 kg", "pack", 96, 82, 34, "supplier_deccan"],
  ["sku_ghee", "Ghee 500 ml", "jar", 135, 111, 5, "supplier_sri_lakshmi"],
  ["sku_rice", "Rice 5 kg", "bag", 260, 218, 27, "supplier_deccan"],
  ["sku_toor_dal", "Toor dal 1 kg", "pack", 140, 119, 21, "supplier_city"],
  ["sku_oil", "Sunflower oil 1 L", "bottle", 135, 112, 18, "supplier_sri_lakshmi"],
  ["sku_atta", "Atta 5 kg", "bag", 220, 186, 16, "supplier_deccan"],
  ["sku_tea", "Tea 250 g", "pack", 105, 86, 14, "supplier_city"],
  ["sku_biscuits", "Biscuits assorted", "pack", 30, 22, 42, "supplier_city"],
  ["sku_salt", "Salt 1 kg", "pack", 25, 17, 38, "supplier_deccan"],
  ["sku_soap", "Bath soap", "bar", 40, 31, 29, "supplier_city"],
  ["sku_detergent", "Detergent 1 kg", "pack", 90, 72, 23, "supplier_deccan"],
  ["sku_milk", "Milk 500 ml", "pouch", 32, 27, 22, "supplier_sri_lakshmi"],
  ["sku_coffee", "Coffee 200 g", "pack", 120, 98, 11, "supplier_city"],
  ["sku_chilli", "Chilli powder 200 g", "pack", 75, 59, 13, "supplier_deccan"],
  ["sku_toothpaste", "Toothpaste 150 g", "tube", 90, 71, 17, "supplier_city"],
] as const;

const atRiskProfiles = [
  ["Anita", 7, 16, 1800],
  ["Ravi", 10, 22, 1500],
  ["Meena", 7, 15, 1400],
  ["Kiran", 14, 29, 1200],
  ["Savitri", 21, 45, 1800],
  ["Ramesh", 10, 21, 900],
  ["Farah", 14, 33, 1000],
  ["Manoj", 7, 18, 600],
  ["Deepa", 21, 43, 600],
] as const;

const customerNames = [
  "Lakshmi", "Anita", "Ravi", "Meena", "Kiran", "Savitri", "Ramesh", "Farah", "Manoj", "Deepa",
  "Vijay", "Asha", "Sunita", "Prakash", "Nisha", "Arun", "Pooja", "Suresh", "Geeta", "Mohan",
  "Rekha", "Imran", "Kavya", "Rahul", "Padma", "Ajay", "Latha", "Naveen", "Shanti", "Bala",
];

function jsonArrayEnv(name: string): unknown[] {
  try {
    const value: unknown = JSON.parse(process.env[name] ?? "");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function commaListEnv(name: string) {
  return (process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

const fallbackActiveNames = customerNames.slice(10, 25);
const fallbackNewNames = customerNames.slice(25);
const configuredActiveNames = commaListEnv("ACTIVE_NAMES");
const configuredNewNames = jsonArrayEnv("NEW_NAMES").filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean);
const activeNames = configuredActiveNames.length === 15 ? configuredActiveNames : fallbackActiveNames;
const newNames = configuredNewNames.length === 5 ? configuredNewNames : fallbackNewNames;
const configuredGheePattern = jsonArrayEnv("GHEE_PATTERN");
const gheePattern = configuredGheePattern.length === 7 && configuredGheePattern.every((value) => Number.isInteger(value) && Number(value) >= 0) && configuredGheePattern.reduce<number>((sum, value) => sum + Number(value), 0) === 18
  ? configuredGheePattern.map(Number)
  : [2, 2, 2, 3, 2, 3, 4];
const defaultLakshmiVisits = ["2026-08-20", "2026-09-03", "2026-09-17", "2026-10-01", "2026-10-15"];
const configuredLakshmiVisits = commaListEnv("LAKSHMI_VISITS");
const lakshmiVisits = configuredLakshmiVisits.length === 5 && configuredLakshmiVisits.every((date) => /^\\d{4}-\\d{2}-\\d{2}$/.test(date))
  && configuredLakshmiVisits.slice(1).every((date, index) => dayDifference(configuredLakshmiVisits[index], date) === 14)
  && dayDifference(configuredLakshmiVisits[4], AS_OF) === 30
  ? configuredLakshmiVisits
  : defaultLakshmiVisits;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
}

function daysAgo(days: number) {
  const date = new Date(`${AS_OF}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dayDifference(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function visitSeries(gap: number, daysSince: number, count: number) {
  return Array.from({ length: count }, (_, index) => daysAgo(daysSince + gap * (count - index - 1)));
}

function buildCustomers(): SeedCustomer[] {
  const risk = [
    { name: "Lakshmi", gap: 14, daysSince: 30, monthlySpend: 3200, visits: lakshmiVisits },
    ...atRiskProfiles.map(([name, gap, daysSince, monthlySpend]) => ({ name, gap, daysSince, monthlySpend, visits: visitSeries(gap, daysSince, 4) })),
  ];
  const active = activeNames.map((name, index) => {
    const gap = [7, 10, 14, 21, 10][index % 5];
    const daysSince = Math.max(1, Math.round(gap * (0.45 + (index % 6) * 0.18)));
    return { name, gap, daysSince, monthlySpend: 700 + index * 115, visits: visitSeries(gap, daysSince, 5) };
  });
  const fresh = newNames.map((name, index) => {
    const count = 1 + (index % 3);
    const gap = 10 + index * 2;
    return { name, gap, daysSince: 2 + index, monthlySpend: 300 + index * 100, visits: visitSeries(gap, 2 + index, count) };
  });

  return [...risk, ...active, ...fresh].map((customer, index) => ({
    id: `cust_${String(index + 1).padStart(2, "0")}`,
    name: customer.name,
    monthlySpend: customer.monthlySpend,
    balanceDue: index === 0 ? 340 : 0,
    consentToMessage: true,
    visits: customer.visits,
  }));
}

function checksum(value: string) {
  let hash = 0x811c9dc5;
  for (const code of value) {
    hash ^= code.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function generateSeedData(): DemoSeedData {
  const random = seededRandom(SEED_RANDOM);
  const customers = buildCustomers();
  const skus: SeedSku[] = skuDefinitions.map(([id, name, unit, price, cost, onHand, supplierId]) => ({
    id, name, unit, price, cost, onHand, supplierId, leadTimeDays: 2,
  }));
  const visitCustomersByDate = new Map<string, string[]>();
  for (const customer of customers) {
    for (const visit of customer.visits) {
      visitCustomersByDate.set(visit, [...(visitCustomersByDate.get(visit) ?? []), customer.id]);
    }
  }

  const bills: SeedBill[] = [];
  const discounts: DemoSeedData["discounts"] = [];
  const stockMovements: DemoSeedData["stockMovements"] = [];
  const ordinarySkus = skus.filter((sku) => sku.id !== "sku_ghee");
  const paymentModes = ["cash", "upi", "card"] as const;

  for (let age = 90; age >= 1; age -= 1) {
    const date = daysAgo(age);
    const count = date === LEDGER_END ? 62 : 60;
    const visitingCustomers = visitCustomersByDate.get(date) ?? [];
    const gheeUnits = gheePattern[(age - 1) % gheePattern.length];

    for (let index = 0; index < count; index += 1) {
      const number = 1001 + index;
      const id = `${date}-${number}`;
      const isE1 = date === "2026-11-13" && number === 1048;
      const isE2 = date === "2026-11-12" && number === 1017;
      const isE3 = date === "2026-11-11" && number === 1033;
      const isE4 = date === "2026-11-10" && number === 1009;
      const isE5 = date === "2026-11-12" && number === 1040;
      const lines: SeedLine[] = [];

      if (isE1) {
        lines.push({ skuId: "sku_sugar", item: "Sugar 2 kg", qty: 1, unitPriceRecorded: 69, lineTotalRecorded: 69 });
      } else if (isE2) {
        lines.push({ skuId: "sku_toor_dal", item: "Toor dal 1 kg", qty: 2, unitPriceRecorded: 140, lineTotalRecorded: 120 });
      } else if (isE5) {
        lines.push({ skuId: "sku_sugar", item: "Sugar 2 kg", qty: 1, unitPriceRecorded: 86, lineTotalRecorded: 86 });
        discounts.push({ skuId: "sku_sugar", date, amount: 10, approved: true });
      } else if (isE3) {
        const sku = ordinarySkus[6];
        lines.push({ skuId: sku.id, item: sku.name, qty: 1, unitPriceRecorded: sku.price, lineTotalRecorded: sku.price });
      } else if (isE4) {
        const sku = ordinarySkus[2];
        lines.push({ skuId: sku.id, item: sku.name, qty: 2, unitPriceRecorded: sku.price, lineTotalRecorded: 2 * sku.price });
      } else {
        const lineCount = 2;
        const used = new Set<string>();
        for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
          let sku = ordinarySkus[Math.floor(random() * ordinarySkus.length)];
          while (used.has(sku.id)) sku = ordinarySkus[Math.floor(random() * ordinarySkus.length)];
          used.add(sku.id);
          const qty = 1;
          lines.push({ skuId: sku.id, item: sku.name, qty, unitPriceRecorded: sku.price, lineTotalRecorded: qty * sku.price });
        }
        const thirdSku = ordinarySkus.find((sku) => !used.has(sku.id));
        if (thirdSku) lines.push({ skuId: thirdSku.id, item: thirdSku.name, qty: 1, unitPriceRecorded: thirdSku.price, lineTotalRecorded: thirdSku.price });
      }

      if (index === 0 && gheeUnits > 0 && ![isE1, isE2, isE3, isE4, isE5].some(Boolean)) {
        const ghee = skus.find((sku) => sku.id === "sku_ghee")!;
        lines.push({ skuId: ghee.id, item: ghee.name, qty: gheeUnits, unitPriceRecorded: ghee.price, lineTotalRecorded: gheeUnits * ghee.price });
      }

      let total = isE4 ? 740 : lines.reduce((sum, line) => sum + line.lineTotalRecorded, 0);
      if (date === LEDGER_END && index === count - 1) {
        const yesterdayTotal = bills.filter((bill) => bill.date === LEDGER_END).reduce((sum, bill) => sum + bill.total, 0);
        total = 14296 - yesterdayTotal;
      }
      const paymentMode = paymentModes[Math.floor(random() * paymentModes.length)];
      const paymentAmount = isE4 ? total - 40 : total;
      const bill: SeedBill = {
        id,
        number,
        date,
        customerId: visitingCustomers[index] ?? null,
        paymentMode,
        total,
        lines,
        payments: [{ mode: paymentMode, amount: paymentAmount }],
      };
      bills.push(bill);
      if (isE3) {
        stockMovements.push({ id: `movement-${id}`, billId: id, skuId: "sku_oil", date, qty: 1 });
      }
    }
  }

  const demoCustomer = customers[0];
  const ghee = skus.find((sku) => sku.id === "sku_ghee")!;
  const yesterdayTotal = bills.filter((bill) => bill.date === LEDGER_END).reduce((sum, bill) => sum + bill.total, 0);
  const gheeUnits28Days = bills
    .filter((bill) => dayDifference(bill.date, AS_OF) > 0 && dayDifference(bill.date, AS_OF) <= 28)
    .flatMap((bill) => bill.lines)
    .filter((line) => line.skuId === ghee.id)
    .reduce((total, line) => total + line.qty, 0);
  const seedChecksum = checksum(`E1|2026-11-13|1048|96|69|27|Lakshmi|${demoCustomer.visits.join(",")}|${demoCustomer.balanceDue}|Ghee|${gheeUnits28Days}|${ghee.onHand}|${bills.length}|${yesterdayTotal}`);
  return {
    asOf: AS_OF,
    merchant: { id: "merchant_sri_sai", name: "Sri Sai General Stores", owner: "Suresh", city: "Hyderabad", state: "Telangana" },
    customers,
    skus,
    suppliers,
    bills,
    discounts,
    stockMovements,
    checksum: seedChecksum,
  };
}

export const DEMO_SEED = generateSeedData();

export function seededGheeUnitsSold28Days(data: DemoSeedData = DEMO_SEED) {
  return data.bills
    .filter((bill) => dayDifference(bill.date, AS_OF) > 0 && dayDifference(bill.date, AS_OF) <= 28)
    .flatMap((bill) => bill.lines)
    .filter((line) => line.skuId === "sku_ghee")
    .reduce((total, line) => total + line.qty, 0);
}
