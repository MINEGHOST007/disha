import { NextResponse } from "next/server";
import { classifyIntent, parseStockChange } from "@/lib/agent";
import { apiErrorResponse, readJson, DishaApiError } from "@/lib/disha/http";
import { createProposal, getDashboardSnapshot, recordAuditEvent } from "@/lib/disha/store";
import { getCustomerSegments, predictStockout } from "@/lib/engines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    const language = body?.language === "te" ? "te" : "en";
    if (!transcript || transcript.length > 500) {
      throw new DishaApiError("Enter a short voice or typed request.", 400);
    }

    const intent = classifyIntent(transcript);
    const snapshot = await getDashboardSnapshot();
    let storageAvailable = snapshot.storageAvailable;
    if (storageAvailable) {
      try {
        await recordAuditEvent("voice_intent", { intent });
      } catch {
        storageAvailable = false;
      }
    }
    const state = snapshot.state;
    const forecast = predictStockout(state.onHand);
    let answer = "";
    let proposal = null;

    if (intent === "STOCK_QUERY") {
      answer = language === "te"
        ? `నెయ్యి ${state.onHand} జార్లు ఉన్నాయి. సుమారు ${Math.round(forecast.daysLeft)} రోజులు సరిపోతాయి.`
        : `There are ${state.onHand} jars of ghee. At this pace, that is about ${Math.round(forecast.daysLeft)} days.`;
    } else if (intent === "CUSTOMER_STATUS") {
      const customer = getCustomerSegments();
      answer = language === "te"
        ? `లక్ష్మి చివరిసారి ${customer.daysSince} రోజుల క్రితం వచ్చారు. సాధారణంగా ప్రతి ${customer.medianGap} రోజులకు వస్తారు.`
        : `Lakshmi last visited ${customer.daysSince} days ago; her usual gap is ${customer.medianGap} days.`;
    } else if (intent === "TODAY_PRIORITIES") {
      answer = language === "te" ? "ఈ రోజు మూడు ముఖ్యమైన పనులు సిద్ధంగా ఉన్నాయి." : "Your three priorities are ready for review.";
    } else if (intent === "STOCK_UPDATE") {
      const qtyChange = parseStockChange(transcript, state.onHand);
      if (qtyChange === null) throw new DishaApiError("Say a whole-number stock change, then review the proposal.", 400);
      if (qtyChange === 0) {
        answer = language === "te" ? `స్టాక్ ఇప్పటికే ${state.onHand} జార్లుగా ఉంది.` : `Stock is already at ${state.onHand} jars.`;
      } else {
        if (!storageAvailable) throw new DishaApiError("Offline demo cannot save a stock proposal.", 503);
        proposal = await createProposal("stock_update", language, qtyChange);
        answer = language === "te" ? "స్టాక్ మార్పు సిద్ధం. సేవ్ చేయడానికి ముందు ఆమోదించండి." : "Stock change prepared. Approve it before the sandbox count changes.";
      }
    } else if (intent === "APPROVE") {
      answer = language === "te" ? "ఆమోదించడానికి చర్య కార్డులోని బటన్‌ను నొక్కండి." : "Open the action card and tap Approve to confirm it.";
    } else if (intent === "REJECT") {
      answer = language === "te" ? "చర్యను మూసివేయడానికి ‘ఇప్పుడు వద్దు’ నొక్కండి." : "Choose Not now on the action card to dismiss it.";
    } else {
      answer = language === "te" ? "స్టాక్, లక్ష్మి లేదా ఈ రోజు పనుల గురించి అడగండి." : "Try asking about stock, Lakshmi, or today’s priorities.";
    }

    return NextResponse.json({ intent, answer, proposal, storageAvailable }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
