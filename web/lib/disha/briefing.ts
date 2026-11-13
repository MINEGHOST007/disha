import { createReorderDraft, demoGheeUnitsSold28Days, getCustomerSegments, predictStockout, reconcileDay } from "../engines";
import type { DemoState } from "./types";

export type BriefingCardId = "billing" | "retention" | "inventory";
export type BriefingLanguage = "en" | "te";

export type BriefingCard = {
  id: BriefingCardId;
  category: "billing" | "retention" | "inventory";
  title: string;
  facts: Record<string, string | number | boolean>;
  narration: string;
};

const round1 = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function buildBriefingCards(state: DemoState, language: BriefingLanguage = "en"): BriefingCard[] {
  const billing = reconcileDay(state.billRecorded)[0];
  const customer = getCustomerSegments();
  const unitsSold28Days = demoGheeUnitsSold28Days(state.extraBills);
  const forecast = predictStockout(state.onHand, unitsSold28Days, 2, state.festivalMultiplier);
  const reorder = createReorderDraft(state.onHand, state.festivalMultiplier, unitsSold28Days);
  const billingFacts = {
    bill_number: state.billNumber,
    item: "Sugar 2 kg",
    expected: state.billExpected,
    recorded: state.billRecorded,
    difference: Math.abs(state.billExpected - state.billRecorded),
    review_required: state.billRecorded !== state.billExpected,
  };
  const retentionFacts = {
    last_visit_days_ago: customer.daysSince,
    usual_gap_days: customer.medianGap,
    segment: customer.segment,
  };
  const inventoryFacts = {
    sku_name: "Ghee 500 ml",
    on_hand: state.onHand,
    units_sold_28_days: unitsSold28Days,
    days_in_window: 28,
    daily_velocity: round2(forecast.velocity),
    days_left: round1(forecast.daysLeft),
    reorder_quantity: reorder.quantity,
    supplier_lead_days: 2,
    festival_multiplier: state.festivalMultiplier,
  };

  return [
    {
      id: "billing",
      category: "billing",
      title: language === "te" ? "బిల్లు తనిఖీ" : "Billing check",
      facts: billingFacts,
      narration: language === "te"
        ? billing.needsReview
          ? `బిల్ #${state.billNumber}లో షుగర్ 2 కిలోలకు ₹${state.billRecorded} నమోదు చేశారు. ధరల జాబితా ₹${state.billExpected}; ₹${billingFacts.difference} తేడాను పరిశీలించండి.`
          : `బిల్ #${state.billNumber} ఇప్పుడు ధరల జాబితా ₹${state.billExpected}తో సరిపోతుంది. మరింత సమీక్ష అవసరం లేదు.`
        : billing.needsReview
          ? `Bill #${state.billNumber} shows ₹${state.billRecorded} for Sugar 2 kg; the price list is ₹${state.billExpected}. Please review the ₹${billingFacts.difference} difference.`
          : `Bill #${state.billNumber} now matches the ₹${state.billExpected} price list. No further review is needed.`,
    },
    {
      id: "retention",
      category: "retention",
      title: language === "te" ? "కస్టమర్ శ్రద్ధ" : "Customer care",
      facts: retentionFacts,
      narration: language === "te"
        ? `లక్ష్మి గారు చివరిసారి ${customer.daysSince} రోజుల క్రితం వచ్చారు. ఆమె సాధారణంగా ${customer.medianGap} రోజులకు వస్తారు; సున్నితమైన సందేశం సిద్ధంగా ఉంది.`
        : `Lakshmi last visited ${customer.daysSince} days ago. Her usual interval is ${customer.medianGap} days; a gentle check-in is ready for your review.`,
    },
    {
      id: "inventory",
      category: "inventory",
      title: language === "te" ? "స్టాక్ హెచ్చరిక" : "Stock watch",
      facts: inventoryFacts,
      narration: language === "te"
        ? `నెయ్యి 500 మి.లీ.లో ${state.onHand} జార్లు ఉన్నాయి. గత 28 రోజుల్లో రోజుకు ${round2(forecast.velocity)} జార్లు అమ్ముడయ్యాయి. సుమారు ${round1(forecast.daysLeft)} రోజుల్లో స్టాక్ అయిపోవచ్చు; ${reorder.quantity} జార్ల ఆర్డర్‌ను పరిశీలించండి.`
        : `Ghee 500 ml has ${state.onHand} jars. Recent sales average ${round2(forecast.velocity)} jars a day; stock may run out in about ${round1(forecast.daysLeft)} days. Review a ${reorder.quantity}-jar reorder.` ,
    },
  ];
}

export function getBriefingCard(state: DemoState, id: BriefingCardId, language: BriefingLanguage = "en") {
  return buildBriefingCards(state, language).find((card) => card.id === id) ?? null;
}
