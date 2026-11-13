import { AS_OF } from "./disha/constants";

export const VELOCITY_WINDOW_DAYS = 28;
export function isDigitSwap(expected: number, recorded: number) {
  const left = String(Math.round(Math.abs(expected)));
  const right = String(Math.round(Math.abs(recorded)));
  if (left.length !== right.length || left === right || left.length < 2) return false;
  let mismatch = -1;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      if (mismatch !== -1) {
        if (index !== mismatch + 1) return false;
        const swapped = right.split("");
        [swapped[mismatch], swapped[index]] = [swapped[index], swapped[mismatch]];
        return swapped.join("") === left;
      }
      mismatch = index;
    }
  }
  return false;
}

export function predictStockout(onHand = 5, unitsSold28Days = 72, leadTime = 2, asOf = AS_OF) {
  const velocity = unitsSold28Days / VELOCITY_WINDOW_DAYS;
  const daysLeft = velocity > 0 ? Math.max(0, onHand) / velocity : Number.POSITIVE_INFINITY;
  const safetyBuffer = Math.ceil(2 * velocity);
  const onHandAtDelivery = Math.max(0, onHand - velocity * leadTime);
  const reorderQty = Math.max(0, Math.ceil(Math.ceil(7 * velocity) + safetyBuffer - onHandAtDelivery));
  const stockout = new Date(`${asOf}T00:00:00Z`);
  if (Number.isFinite(daysLeft)) stockout.setUTCDate(stockout.getUTCDate() + Math.floor(daysLeft));
  return {
    velocity,
    daysLeft,
    stockoutDate: Number.isFinite(daysLeft) ? stockout.toISOString().slice(0, 10) : null,
    safetyBuffer,
    onHandAtDelivery,
    reorderQty,
    isUrgent: daysLeft <= 2,
  };
}

const teluguDigits = "౦౧౨౩౪౫౬౭౮౯";
const numberWords: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
};

function normalizeNumberText(value: string) {
  return value.split("").map((character) => {
    const digit = teluguDigits.indexOf(character);
    return digit === -1 ? character : String(digit);
  }).join("").replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
    (word) => numberWords[word.toLowerCase()]);
}

function addNumberVariants(allowed: Set<string>, raw: string) {
  const normalized = normalizeNumberText(raw).replaceAll(",", "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return;
  allowed.add(String(value));
  allowed.add(value.toLocaleString("en-IN"));
  allowed.add(value.toFixed(1));
  allowed.add(String(Math.round(value)));
}

export function allowedNumbers(facts: unknown) {
  const allowed = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      addNumberVariants(allowed, String(value));
    } else if (typeof value === "string") {
      for (const token of normalizeNumberText(value).match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
        addNumberVariants(allowed, token);
      }
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(facts);
  return allowed;
}

export function validateNarration(candidate: string, facts: unknown) {
  const normalized = normalizeNumberText(candidate);
  const allowed = allowedNumbers(facts);
  const violations = (normalized.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .filter((number) => !allowed.has(number) && !allowed.has(number.replaceAll(",", "")));
  const forbidden = /\b(?:guaranteed|approved loan|pre-approved)\b/i.test(candidate);
  if (forbidden) violations.push("forbidden financial promise");
  return { valid: violations.length === 0, violations };
}

export function numberIsAllowed(candidate: string, facts: Record<string, unknown>) {
  return validateNarration(candidate, facts).valid;
}
