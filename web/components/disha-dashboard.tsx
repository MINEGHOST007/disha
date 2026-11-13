"use client";

import { Children, cloneElement, isValidElement, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowRight, AudioLines, BadgeCheck, Bell, BookOpenCheck, Check, ChevronDown, CircleHelp, ClipboardList, Clock3, Coffee, Languages, Leaf, Mic, Package, RotateCcw, ShieldCheck, ShoppingBasket, Sparkles, Store, TrendingUp, Users, X } from "lucide-react";
import { predictStockout } from "@/lib/engine-core";
import { CashFlowPanel } from "@/components/cash-flow-panel";
import { DemoBillEditor } from "@/components/demo-bill-editor";
import { NarrationPlayer } from "@/components/narration-player";
import type { ActivityLog, CashFlowProjection, DemoAnalytics, DemoState } from "@/lib/disha/types";

type Tab = "Today" | "Bills" | "Customers" | "Stock" | "Cash flow" | "Activity";
type Log = ActivityLog;
type DashboardProps = { initialState: DemoState; initialLogs: ActivityLog[]; storageAvailable: boolean; analytics: DemoAnalytics; initialCashFlow: CashFlowProjection };

const messageTemplates = {
  en: "Namaste Lakshmi garu! We have fresh ghee and your usual favourites in stock. Drop by anytime — we’d love to see you.",
  te: "నమస్కారం లక్ష్మి గారు! తాజా నెయ్యి మరియు మీకు ఇష్టమైన వస్తువులు అందుబాటులో ఉన్నాయి. మీకు వీలైనప్పుడు రండి — మిమ్మల్ని చూడటం ఆనందంగా ఉంటుంది.",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Request failed");
  return payload as T;
}
type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognizer = { lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start: () => void };
type SpeechRecognizerConstructor = new () => SpeechRecognizer;

const copy = {
  en: { today: "Today", bills: "Bills", customers: "Customers", stock: "Stock", cashflow: "Cash flow", activity: "Activity", greeting: "Good morning, Suresh", subtitle: "Here’s your shop briefing for Saturday, 14 November.", priorities: "TODAY’S PRIORITIES", prioritiesSub: "Three things worth your attention today.", billing: "Billing check", retention: "Customer care", inventory: "Stock watch", open: "Review details", act: "Take a look", urgent: "Urgent", sandbox: "Sandbox data", sales: "Yesterday’s sales", billsCount: "Bills yesterday", prepared: "Prepared for you", allClear: "You’re all caught up", reset: "Reset demo", approved: "Approved", approve: "Approve action", cancel: "Not now", speak: "Try saying “check my stock”", online: "All systems ready", hello: "Namaskaram", details: "Why this matters", complete: "Action recorded", tapToHear: "Listen" },
  te: { today: "ఈ రోజు", bills: "బిల్లులు", customers: "కస్టమర్లు", stock: "స్టాక్", cashflow: "నగదు ప్రవాహం", activity: "చర్యలు", greeting: "శుభోదయం, సురేష్", subtitle: "శనివారం, నవంబర్ 14 కోసం మీ దుకాణం సమాచారం.", priorities: "ఈ రోజు ముఖ్యమైనవి", prioritiesSub: "ఈ రోజు మీ దృష్టికి అవసరమైన మూడు విషయాలు.", billing: "బిల్లు తనిఖీ", retention: "కస్టమర్ శ్రద్ధ", inventory: "స్టాక్ హెచ్చరిక", open: "వివరాలు చూడండి", act: "చూడండి", urgent: "అత్యవసరం", sandbox: "డెమో డేటా", sales: "నిన్నటి అమ్మకాలు", billsCount: "నిన్నటి బిల్లులు", prepared: "మీ కోసం సిద్ధం", allClear: "అన్నీ పూర్తయ్యాయి", reset: "డెమో రీసెట్", approved: "ఆమోదించబడింది", approve: "చర్యను ఆమోదించండి", cancel: "ఇప్పుడు వద్దు", speak: "“నా స్టాక్ చూడండి” అని చెప్పండి", online: "సిస్టమ్ సిద్ధంగా ఉంది", hello: "నమస్కారం", details: "ఇది ఎందుకు ముఖ్యం", complete: "చర్య నమోదు చేయబడింది", tapToHear: "వినండి" },
};

const teluguStrings: Record<string, string> = {
  "Disha home": "దిషా హోమ్",
  "YOUR SHOP": "మీ దుకాణం",
  "Help & feedback": "సహాయం మరియు అభిప్రాయం",
  "Shop owner": "దుకాణ యజమాని",
  "Profile options": "ప్రొఫైల్ ఎంపికలు",
  "Change language": "భాష మార్చండి",
  Notifications: "నోటిఫికేషన్లు",
  "Yesterday at a glance": "నిన్నటి ముఖ్యాంశాలు",
  SATURDAY: "శనివారం",
  "14 NOVEMBER 2026": "14 నవంబర్ 2026",
  English: "ఆంగ్లం",
  "may be missing a visit": "సందర్శనకు ఆలస్యమవుతోంది",
  "Last visited": "చివరిసారి వచ్చి",
  "days ago · usually every": "రోజుల క్రితం · సాధారణంగా ప్రతి",
  "days.": "రోజులకు ఒకసారి.",
  Only: "ఇంకా",
  "jars left · about": "జార్లు మాత్రమే ఉన్నాయి · సుమారు",
  "days of stock.": "రోజుల స్టాక్.",
  Reorder: "మళ్లీ ఆర్డర్ చేయండి",
  "SATURDAY · 14 NOVEMBER 2026": "శనివారం · 14 నవంబర్ 2026",
  "vs. Thursday": "గురువారంతో పోలిస్తే",
  "Your busiest day this week": "ఈ వారంలో అత్యధిక అమ్మకాల రోజు",
  "Shop health": "దుకాణ స్థితి",
  "Looking good": "బాగుంది",
  "One small fix can make it better": "ఒక చిన్న సవరణతో మరింత మెరుగవుతుంది",
  BILLING: "బిల్లింగ్",
  "Needs a look": "పరిశీలించండి",
  "Correction approved": "సవరణ ఆమోదించబడింది",
  "Bill #1048 correction recorded": "బిల్లు #1048 సవరణ నమోదు చేయబడింది",
  "The original ₹69 entry was corrected to ₹96 after your approval.": "మీ ఆమోదంతో అసలు ₹69 నమోదు ₹96గా సవరించబడింది.",
  "Correction saved": "సవరణ సేవ్ చేయబడింది",
  "Digit swap detected": "అంకెల మార్పు గుర్తించబడింది",
  "Review bill": "బిల్లు చూడండి",
  "CUSTOMER CARE": "కస్టమర్ సేవ",
  "Worth reaching out": "పలకరించడానికి మంచి సమయం",
  "Potentially at risk": "ప్రమాదంలో ఉండవచ్చు",
  "View customer": "కస్టమర్‌ను చూడండి",
  INVENTORY: "ఇన్వెంటరీ",
  "Low stock": "స్టాక్ తక్కువగా ఉంది",
  "Ghee may run out soon": "నెయ్యి స్టాక్ త్వరలో అయిపోవచ్చు",
  "Review stock": "స్టాక్ చూడండి",
  "Try another request or select a section above.": "మరో అభ్యర్థన చెప్పండి లేదా పై విభాగాన్ని ఎంచుకోండి.",
  "Ask Disha about bills, customers or stock": "బిల్లులు, కస్టమర్లు లేదా స్టాక్ గురించి దిషాను అడగండి",
  "Start voice input": "వాయిస్ ఇన్‌పుట్ ప్రారంభించండి",
  "What would you like to know?": "మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?",
  "Type instead": "టైప్ చేయండి",
  "Disha notices patterns. You stay in control.": "దిషా నమూనాలను గుర్తిస్తుంది. నియంత్రణ మీ చేతుల్లోనే ఉంటుంది.",
  "Nothing happens without your approval.": "మీ ఆమోదం లేకుండా ఏ చర్యా జరగదు.",
  RECONCILIATION: "బిల్లుల సరిపోలిక",
  "A quick billing check": "బిల్లుల త్వరిత తనిఖీ",
  "A small difference stood out in yesterday’s bills.": "నిన్నటి బిల్లుల్లో ఒక చిన్న తేడా కనిపించింది.",
  "13 Nov 2026 · 11:42 AM": "13 నవం 2026 · ఉదయం 11:42",
  "Paid by UPI": "UPI ద్వారా చెల్లింపు",
  "Bill total": "బిల్లు మొత్తం",
  ITEM: "వస్తువు",
  EXPECTED: "అంచనా",
  RECORDED: "నమోదైనది",
  approved: "ఆమోదించబడింది",
  "What we noticed": "మేము గమనించినది",
  "The synthetic bill now reflects the correction you approved.": "మీరు ఆమోదించిన సవరణ డెమో బిల్లులో కనిపిస్తోంది.",
  "The price list says ₹96. The bill has ₹69 — the digits may have been swapped. No changes have been made.": "ధరల జాబితాలో ₹96 ఉంది. బిల్లులో ₹69 ఉంది — అంకెలు మారి ఉండవచ్చు. ఎలాంటి మార్పూ చేయలేదు.",
  "Looks right": "సరిగ్గా ఉంది",
  "Approve correction": "సవరణను ఆమోదించండి",
  "The bill ledger stays unchanged until you approve a correction.": "మీరు సవరణను ఆమోదించే వరకు బిల్లు మారదు.",
  "7-DAY RECONCILIATION": "7 రోజుల బిల్లుల సరిపోలిక",
  "Other records to review": "పరిశీలించాల్సిన ఇతర నమోదులు",
  "additional flags": "అదనపు గుర్తింపులు",
  "Approved discounts are excluded from review.": "ఆమోదించిన తగ్గింపులు పరిశీలనలోకి రావు.",
  "A thoughtful hello goes a long way": "ఆప్యాయమైన పలకరింపు ఎంతో ప్రభావం చూపుతుంది",
  "at risk": "ప్రమాదంలో ఉండవచ్చు",
  active: "చురుకుగా ఉన్నారు",
  new: "కొత్తవారు",
  "Regular customer": "నిత్యం వచ్చే కస్టమర్",
  "Customer since Aug 2026": "ఆగస్టు 2026 నుంచి కస్టమర్",
  "LAST VISIT": "చివరి సందర్శన",
  "USUAL VISIT": "సాధారణ సందర్శన",
  "MONTHLY SPEND": "నెలవారీ ఖర్చు",
  "It’s been a little longer than usual since Lakshmi’s last visit. This is a gentle nudge, not a prediction.": "లక్ష్మి సాధారణం కంటే ఆలస్యంగా వచ్చారు. ఇది ఒక సున్నితమైన గుర్తు మాత్రమే, అంచనా కాదు.",
  "Outstanding balance": "బాకీ మొత్తం",
  "Only visible to you": "మీకు మాత్రమే కనిపిస్తుంది",
  Show: "చూపించండి",
  Hide: "దాచండి",
  "MESSAGE DRAFT": "సందేశం ముసాయిదా",
  "A warm, personal note": "ఆప్యాయమైన వ్యక్తిగత సందేశం",
  Simulated: "అనుకరణ మాత్రమే",
  "Edit message draft": "సందేశ ముసాయిదాను సవరించండి",
  "Nothing is sent until you approve. This is a demo.": "మీ ఆమోదం వచ్చే వరకు ఏ సందేశమూ పంపబడదు. ఇది డెమో మాత్రమే.",
  "Done editing": "సవరణ పూర్తయింది",
  "Edit draft": "ముసాయిదాను సవరించండి",
  "Approve & simulate send": "ఆమోదించి పంపినట్లు చూపండి",
  "SEGMENT OVERVIEW": "కస్టమర్ విభాగాల సమీక్ష",
  "Customer activity": "కస్టమర్ కార్యకలాపాలు",
  "synthetic profiles": "డెమో ప్రొఫైళ్లు",
  "Customer segments from recent visit intervals": "ఇటీవలి సందర్శనల మధ్య వ్యవధి ఆధారంగా కస్టమర్ విభాగాలు",
  Customer: "కస్టమర్",
  Segment: "విభాగం",
  "Last visit": "చివరి సందర్శన",
  "Usual gap": "సాధారణ విరామం",
  "Monthly spend": "నెలవారీ ఖర్చు",
  "Stay a step ahead of an empty shelf": "స్టాక్ ఖాళీ కాకముందే సిద్ధంగా ఉండండి",
  "Cash flow": "నగదు ప్రవాహం",
  "Festival demand multiplier": "పండుగ డిమాండ్ గుణకం",
  "SKU · Dairy & chilled": "SKU · పాల ఉత్పత్తులు",
  "ON HAND": "చేతిలో ఉన్న స్టాక్",
  "SALES VELOCITY": "అమ్మకాల వేగం",
  "DAYS LEFT": "మిగిలిన రోజులు",
  "Estimated stock over time": "అంచనా స్టాక్ మార్పు",
  "Based on recent sales": "ఇటీవలి అమ్మకాల ఆధారంగా",
  "Supplier delivery · 2d": "సరఫరాదారు డెలివరీ · 2 రోజులు",
  "2 days": "2 రోజులు",
  "/ day": "/ రోజు",
  "2d": "2 రోజులు",
  "5d": "5 రోజులు",
  "9d": "9 రోజులు",
  "5 days": "5 రోజులు",
  "9 days": "9 రోజులు",
  "On hand at delivery": "డెలివరీ సమయానికి మిగిలే స్టాక్",
  "7-day target + safety buffer": "7 రోజుల లక్ష్యం + భద్రతా నిల్వ",
  "Demo mode · change stock to see forecast update": "డెమో మోడ్ · అంచనాను చూడటానికి స్టాక్ మార్చండి",
  "Create reorder draft": "రీ-ఆర్డర్ ముసాయిదా సృష్టించండి",
  "Create reorder draft ·": "రీ-ఆర్డర్ ముసాయిదా సృష్టించండి ·",
  "Festival uplift not yet modelled.": "పండుగల అదనపు డిమాండ్ ఇంకా లెక్కించలేదు.",
  "HOW WE GOT HERE": "ఈ అంచనా ఎలా వచ్చింది",
  "Clear math. Your call.": "స్పష్టమైన లెక్క. నిర్ణయం మీది.",
  units: "యూనిట్లు",
  "sold in 28 days": "28 రోజుల్లో అమ్ముడయ్యాయి",
  "YOUR SUPPLIER": "మీ సరఫరాదారు",
  "Typical delivery · 2 days": "సాధారణ డెలివరీ · 2 రోజులు",
  "At this pace, stock could run out before a new delivery arrives.": "ఇదే వేగం కొనసాగితే, కొత్త సరుకు వచ్చేలోపు స్టాక్ అయిపోవచ్చు.",
  "FULL CATALOG": "పూర్తి ఉత్పత్తుల జాబితా",
  "Products tracked": "ట్రాక్ చేస్తున్న ఉత్పత్తులు",
  "synthetic SKUs": "డెమో SKUలు",
  "Stock, sales velocity and suggested replenishment for all tracked products": "అన్ని ఉత్పత్తుల స్టాక్, అమ్మకాల వేగం, సూచించిన రీ-ఆర్డర్",
  Product: "ఉత్పత్తి",
  "On hand": "చేతిలో ఉన్నది",
  "Sold · 28d": "అమ్మకాలు · 28 రోజులు",
  "Days left": "మిగిలిన రోజులు",
  "Suggested reorder": "సూచించిన రీ-ఆర్డర్",
  jars: "జార్లు",
  packs: "ప్యాకెట్లు",
  bags: "సంచులు",
  bottles: "సీసాలు",
  bars: "బార్లు",
  pouches: "పౌచ్‌లు",
  days: "రోజులు",
  "YOUR DECISIONS": "మీ నిర్ణయాలు",
  "A clear record of every action": "ప్రతి చర్యకు స్పష్టమైన రికార్డు",
  "Nothing happens behind your back. Here’s the activity you approved.": "మీకు తెలియకుండా ఏదీ జరగదు. మీరు ఆమోదించిన చర్యలు ఇవి.",
  "No actions yet": "ఇంకా చర్యలు లేవు",
  "When you approve or dismiss a suggestion, it will appear here.": "మీరు సూచనను ఆమోదించినా లేదా తీసివేసినా, అది ఇక్కడ కనిపిస్తుంది.",
  "Back to your briefing": "సారాంశానికి తిరిగి వెళ్లండి",
  Merchant: "వ్యాపారి",
  "Sandbox activity is saved in Supabase; the audit log is append-only.": "డెమో కార్యకలాపాలు Supabaseలో భద్రపడ్డాయి; ఆడిట్ లాగ్‌ను మార్చలేరు.",
  "Offline demo mode: activity cannot be saved until Supabase is reachable.": "ఆఫ్‌లైన్ డెమో: Supabase అందుబాటులోకి వచ్చే వరకు కార్యకలాపాలు భద్రపరచబడవు.",
  "Offline demo · not saved": "ఆఫ్‌లైన్ డెమో · భద్రపరచలేదు",
  "Made for the people behind the counter": "కౌంటర్ వెనుక పనిచేసే వారి కోసం",
  "RESET DEMO": "డెమో రీసెట్",
  "YOUR APPROVAL NEEDED": "మీ ఆమోదం అవసరం",
  "Start fresh?": "మళ్లీ మొదలుపెట్టాలా?",
  "Send Lakshmi a hello?": "లక్ష్మికి సందేశం పంపాలా?",
  "Confirm stock update?": "స్టాక్ మార్పును నిర్ధారించాలా?",
  "Correct Bill #1048?": "బిల్లు #1048 సవరించాలా?",
  "This clears visible activity and restores the demo values. The append-only audit history is preserved.": "ఇది కనిపించే కార్యకలాపాలను తొలగించి డెమో విలువలను పునరుద్ధరిస్తుంది. ఆడిట్ చరిత్ర అలాగే ఉంటుంది.",
  "The edited message draft will be added to the sandbox outbox. No real message will be sent.": "సవరించిన సందేశం డెమో అవుట్‌బాక్స్‌లో చేరుతుంది. నిజమైన సందేశం పంపబడదు.",
  "Sandbox only · clears visible activity": "డెమో మాత్రమే · కనిపించే కార్యకలాపాలు తొలగించబడతాయి",
  "Sandbox only · no live systems connected": "డెమో మాత్రమే · ప్రత్యక్ష వ్యవస్థలు అనుసంధానించలేదు",
  "You can review this action in Activity": "ఈ చర్యను కార్యకలాపాల్లో చూడవచ్చు",
  "Saving…": "భద్రపరుస్తోంది…",
  Close: "మూసివేయండి",
  "Dismiss notification": "నోటిఫికేషన్‌ను తీసివేయండి",
  "Main navigation": "ప్రధాన నావిగేషన్",
  "Close unavailable; choose an action": "అందుబాటులో లేదు; ఒక చర్యను ఎంచుకోండి",
  "BILL #1048": "బిల్లు #1048",
  Bill: "బిల్లు",
  Issue: "సమస్య",
  Expected: "అంచనా",
  Recorded: "నమోదైనది",
  "Payment total": "చెల్లింపు మొత్తం",
  "qty mismatch": "పరిమాణంలో తేడా",
  "Sugar 2 kg was entered as ₹69 instead of ₹96.": "షుగర్ 2 కిలోలు ₹96కు బదులుగా ₹69గా నమోదు చేయబడింది.",
  "At risk": "ప్రమాదంలో",
  Active: "చురుకుగా",
  New: "కొత్త",
  "price mismatch": "ధరలో తేడా",
  "digit swap": "అంకెల మార్పు",
  "quantity mismatch": "పరిమాణంలో తేడా",
  "missing item": "వస్తువు లేదు",
  "payment mismatch": "చెల్లింపులో తేడా",
  "quantity anomaly": "పరిమాణ అసాధారణత",
  "Add a note or adjust the proposed quantity.": "గమనిక జోడించండి లేదా సూచించిన పరిమాణాన్ని మార్చండి.",
};

function translateDynamicText(value: string) {
  let match = value.match(/^₹([\d,]+) difference on Bill #(\d+)$/);
  if (match) return `బిల్లు #${match[2]}లో ₹${match[1]} తేడా`;
  match = value.match(/^Last visited (\d+) days ago · usually every (\d+) days\.$/);
  if (match) return `${match[1]} రోజుల క్రితం చివరిసారి వచ్చారు · సాధారణంగా ప్రతి ${match[2]} రోజులకు ఒకసారి.`;
  match = value.match(/^Every (\d+) days$/);
  if (match) return `ప్రతి ${match[1]} రోజులకు ఒకసారి`;
  match = value.match(/^(\d+) days ago$/);
  if (match) return `${match[1]} రోజుల క్రితం`;
  match = value.match(/^Only (\d+) jars left · about (\d+) days of stock\.$/);
  if (match) return `ఇంకా ${match[1]} జార్లు మాత్రమే ఉన్నాయి · సుమారు ${match[2]} రోజుల స్టాక్.`;
  match = value.match(/^Reorder (\d+) jars$/);
  if (match) return `${match[1]} జార్లు మళ్లీ ఆర్డర్ చేయండి`;
  match = value.match(/^Prepare a (\d+)-jar reorder\?$/);
  if (match) return `${match[1]} జార్లను మళ్లీ ఆర్డర్ చేయాలా?`;
  match = value.match(/^This creates a purchase draft for (\d+) jars from (.+)\. Nothing is ordered yet\.$/);
  if (match) return `${match[2]} నుంచి ${match[1]} జార్ల కొనుగోలు ముసాయిదా సిద్ధమవుతుంది. ఇంకా ఆర్డర్ చేయలేదు.`;
  match = value.match(/^This proposes changing the synthetic Ghee count from (\d+) to (\d+) jars\. Your approval is required\.$/);
  if (match) return `డెమో నెయ్యి స్టాక్‌ను ${match[1]} నుంచి ${match[2]} జార్లకు మార్చే ప్రతిపాదన. మీ ఆమోదం అవసరం.`;
  match = value.match(/^Approving updates the synthetic bill from ₹(\d+) to ₹(\d+)\. Nothing is sent to a live ledger\.$/);
  if (match) return `ఆమోదిస్తే డెమో బిల్లు ₹${match[1]} నుంచి ₹${match[2]}కు మారుతుంది. ప్రత్యక్ష లెడ్జర్‌కు ఏదీ పంపబడదు.`;
  match = value.match(/^(\d+) additional flags$/);
  if (match) return `${match[1]} అదనపు గుర్తింపులు`;
  match = value.match(/^(\d+) jars$/);
  if (match) return `${match[1]} జార్లు`;
  match = value.match(/^([\d.]+) days$/);
  if (match) return `${match[1]} రోజులు`;
  match = value.match(/^([\d.]+) units$/);
  if (match) return `${match[1]} యూనిట్లు`;
  match = value.match(/^([\d.]+) \/ day$/);
  if (match) return `${match[1]} / రోజు`;
  match = value.match(/^Create reorder draft · ([\d,]+) jars$/);
  if (match) return `రీ-ఆర్డర్ ముసాయిదా సృష్టించండి · ${match[1]} జార్లు`;
  match = value.match(/^(\d+) products · ([\d,]+) bills from (.+) to (.+)$/);
  if (match) return `${match[1]} ఉత్పత్తులు · ${match[2]} బిల్లులు ${match[3]} నుంచి ${match[4]} వరకు`;
  match = value.match(/^(\d+) customers · (\d+) at risk · (\d+) active · (\d+) new$/);
  if (match) return `${match[1]} కస్టమర్లు · ${match[2]} ప్రమాదంలో · ${match[3]} చురుకుగా · ${match[4]} కొత్తవారు`;
  match = value.match(/^Estimated stock depletion in ([\d.]+) days$/);
  if (match) return `${match[1]} రోజుల్లో స్టాక్ ఖాళీ అయ్యే అంచనా`;
  return value;
}

function localizeTree(node: ReactNode, language: "en" | "te"): ReactNode {
  if (language !== "te" || node == null || typeof node === "boolean") return node;
  if (typeof node === "string") {
    const trimmed = node.trim();
    const translation = teluguStrings[trimmed] ?? translateDynamicText(trimmed);
    return translation ? node.replace(trimmed, translation) : node;
  }
  if (Array.isArray(node)) return Children.map(node, (child) => localizeTree(child, language));
  if (!isValidElement(node)) return node;

  const element = node as ReactElement<Record<string, unknown>>;
  const translatedProps: Record<string, unknown> = {};
  for (const key of ["aria-label", "placeholder", "title", "subtitle", "eyebrow", "alt", "description"]) {
    const value = element.props[key];
    if (typeof value === "string") {
      const translated = teluguStrings[value] ?? translateDynamicText(value);
      if (translated !== value) translatedProps[key] = translated;
    }
  }
  return cloneElement(element, translatedProps, localizeTree(element.props.children as ReactNode, language));
}

export function DishaDashboard({ initialState, initialLogs, storageAvailable, analytics, initialCashFlow }: DashboardProps) {
  const [tab, setTab] = useState<Tab>("Today");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [onHand, setOnHand] = useState(initialState.onHand);
  const [festivalMultiplier, setFestivalMultiplier] = useState(initialState.festivalMultiplier);
  const [salesTotal, setSalesTotal] = useState(initialState.salesTotal);
  const [billCount, setBillCount] = useState(initialState.billCount);
  const [ledgerBillCount, setLedgerBillCount] = useState(analytics.dataset.billCount);
  const [additionalGheeUnits, setAdditionalGheeUnits] = useState(0);
  const [cashFlow, setCashFlow] = useState(initialCashFlow);
  const [savingBill, setSavingBill] = useState(false);
  const [billRecorded, setBillRecorded] = useState(initialState.billRecorded);
  const [showBalance, setShowBalance] = useState(false);
  const [modal, setModal] = useState<"bill" | "customer" | "stock" | "stock_update" | "reset" | null>(null);
  const [notice, setNotice] = useState("");
  const [logs, setLogs] = useState<Log[]>(initialLogs);
  const [voiceText, setVoiceText] = useState("");
  const [voiceComposerOpen, setVoiceComposerOpen] = useState(false);
  const [voiceComposerText, setVoiceComposerText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [, setSpeechFailures] = useState(0);
  const [voiceAnswer, setVoiceAnswer] = useState("");
  const [messagePreview, setMessagePreview] = useState(false);
  const [messageDrafts, setMessageDrafts] = useState(messageTemplates);
  const [editingMessage, setEditingMessage] = useState(false);
  const [pendingVoiceProposal, setPendingVoiceProposal] = useState<{ id: string; facts: Record<string, unknown> } | null>(null);
  const [savingAction, setSavingAction] = useState(false);
  const [databaseAvailable, setDatabaseAvailable] = useState(storageAvailable);
  const lastSavedDemoState = useRef({ onHand: initialState.onHand, festivalMultiplier: initialState.festivalMultiplier });
  const savingDemoState = useRef<{ key: string; promise: Promise<boolean> } | null>(null);
  const t = copy[language];
  const l = (value: string) => language === "te" ? teluguStrings[value] ?? value : value;
  const lakshmi = analytics.customers.find((customer) => customer.name === "Lakshmi") ?? analytics.customers[0];
  const gheeForecast = analytics.stock.find((sku) => sku.id === "sku_ghee")!;
  const forecast = useMemo(() => predictStockout(onHand, gheeForecast.unitsSold28Days + additionalGheeUnits, gheeForecast.leadTimeDays, festivalMultiplier), [additionalGheeUnits, festivalMultiplier, gheeForecast.leadTimeDays, gheeForecast.unitsSold28Days, onHand]);
  const refreshLogs = async () => {
    try {
      const response = await fetch("/api/audit", { cache: "no-store" });
      if (!response.ok) throw new Error("Audit unavailable");
      const data = await response.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setDatabaseAvailable(true);
    } catch {
      setDatabaseAvailable(false);
    }
  };
  const persistStock = async (value = onHand, multiplier = festivalMultiplier, action: "stock" | "festival" = "stock") => {
    if (lastSavedDemoState.current.onHand === value && lastSavedDemoState.current.festivalMultiplier === multiplier) return true;
    const key = `${value}:${multiplier}`;
    if (savingDemoState.current?.key === key) return savingDemoState.current.promise;
    const promise = postJson<{ state: DemoState }>("/api/stock", { onHand: value, festivalMultiplier: multiplier, action })
      .then(async () => {
        lastSavedDemoState.current = { onHand: value, festivalMultiplier: multiplier };
        setDatabaseAvailable(true);
        await refreshLogs();
        return true;
      })
      .catch(() => {
        setDatabaseAvailable(false);
        setNotice("Demo forecast settings could not be saved. The displayed forecast is local to this session.");
        return false;
      });
    savingDemoState.current = { key, promise };
    const saved = await promise;
    if (savingDemoState.current?.promise === promise) savingDemoState.current = null;
    return saved;
  };
  const audit = async () => {
    try {
      await postJson("/api/audit", { event: "dismiss_reconciliation" });
      await refreshLogs();
      setNotice("Marked as legitimate · ledger unchanged");
    } catch {
      setNotice("This review could not be saved to the audit log.");
    }
  };
  const finish = async (action: string) => {
    if (!modal || modal === "reset" || savingAction) return;
    setSavingAction(true);
    try {
      if (modal === "stock" && !(await persistStock(onHand))) return;
      const type = action === "reconcile_day" ? "billing_correction" : action === "draft_whatsapp_message" ? "message" : action === "update_stock_from_voice" ? "stock_update" : "reorder";
      const languageForMessage = messagePreview ? "en" : "te";
      if (modal === "stock_update" && !pendingVoiceProposal) throw new Error("Stock proposal is missing.");
      const proposal = modal === "stock_update" && pendingVoiceProposal
        ? pendingVoiceProposal
        : await postJson<{ id: string }>("/api/proposals", {
            type,
            language: languageForMessage,
          });
      const resolved = await postJson<{ outcome: string; result: Record<string, unknown> | null }>(
        `/api/actions/${proposal.id}/approve`,
        { language: languageForMessage, messageText: type === "message" ? messageDrafts[languageForMessage] : undefined },
      );
      if (type === "billing_correction") setBillRecorded(Number(resolved.result?.new_value ?? initialState.billExpected));
      if (type === "stock_update") {
        const nextOnHand = Number(resolved.result?.new_value ?? pendingVoiceProposal?.facts.new_on_hand);
        setOnHand(nextOnHand);
        lastSavedDemoState.current = { onHand: nextOnHand, festivalMultiplier };
        setPendingVoiceProposal(null);
      }
      setDatabaseAvailable(true);
      setNotice(resolved.outcome === "sent_in_sandbox" ? "Sent in sandbox" : resolved.outcome === "purchase_draft_saved" ? "Purchase draft saved in sandbox" : resolved.outcome === "ledger_corrected" ? "Bill corrected in the sandbox" : t.complete);
      setModal(null);
      await refreshLogs();
    } catch {
      setDatabaseAvailable(false);
      setNotice("Could not save this action. No external system was contacted.");
    } finally {
      setSavingAction(false);
    }
  };
  const dismissAction = async () => {
    const currentModal = modal;
    if (!currentModal || currentModal === "reset") {
      setModal(null);
      return;
    }
    if (savingAction) return;
    setSavingAction(true);
    try {
      const type = currentModal === "bill" ? "billing_correction" : currentModal === "customer" ? "message" : currentModal === "stock_update" ? "stock_update" : "reorder";
      if (currentModal === "stock_update" && !pendingVoiceProposal) throw new Error("Stock proposal is missing.");
      const proposal = currentModal === "stock_update" && pendingVoiceProposal
        ? pendingVoiceProposal
        : await postJson<{ id: string }>("/api/proposals", {
            type,
            language: messagePreview ? "en" : "te",
          });
      await postJson(`/api/actions/${proposal.id}/reject`, { reason: "Dismissed by merchant" });
      if (currentModal === "stock_update") setPendingVoiceProposal(null);
      setDatabaseAvailable(true);
      await refreshLogs();
      setModal(null);
    } catch {
      setDatabaseAvailable(false);
      setModal(currentModal === "stock_update" ? "stock_update" : null);
      setNotice("This decision could not be saved to the audit log.");
    } finally {
      setSavingAction(false);
    }
  };
  const addDemoBill = async (bill: { total: number; inventoryCost: number; gheeQty: number }) => {
    if (savingBill) return;
    setSavingBill(true);
    try {
      const response = await postJson<{ state: DemoState; cashFlow: CashFlowProjection }>("/api/demo-bills", bill);
      setOnHand(response.state.onHand);
      setSalesTotal(response.state.salesTotal);
      setBillCount(response.state.billCount);
      setLedgerBillCount((current) => current + 1);
      setAdditionalGheeUnits((current) => current + bill.gheeQty);
      setCashFlow(response.cashFlow);
      lastSavedDemoState.current = { onHand: response.state.onHand, festivalMultiplier: response.state.festivalMultiplier };
      setDatabaseAvailable(true);
      setNotice("Synthetic bill added. Sales, stock, and forecasts updated.");
      await refreshLogs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The synthetic bill could not be saved.");
    } finally {
      setSavingBill(false);
    }
  };

  const resetDemo = async () => {
    if (savingAction) return;
    setSavingAction(true);
    try {
      const response = await postJson<{ state: DemoState; cashFlow: CashFlowProjection }>("/api/reset", {});
      setOnHand(response.state.onHand);
      setFestivalMultiplier(response.state.festivalMultiplier);
      setSalesTotal(response.state.salesTotal);
      setBillCount(response.state.billCount);
      setLedgerBillCount(analytics.dataset.billCount - initialState.extraBills.length);
      setAdditionalGheeUnits(0);
      setCashFlow(response.cashFlow);
      setBillRecorded(response.state.billRecorded);
      lastSavedDemoState.current = { onHand: response.state.onHand, festivalMultiplier: response.state.festivalMultiplier };
      setLogs([]);
      setShowBalance(false);
      setMessagePreview(false);
      setMessageDrafts(messageTemplates);
      setPendingVoiceProposal(null);
      setModal(null);
      setDatabaseAvailable(true);
      setNotice("Demo restored to seed state");
    } catch {
      setDatabaseAvailable(false);
      setNotice("The demo could not be reset while storage is unavailable.");
    } finally {
      setSavingAction(false);
    }
    window.setTimeout(() => setNotice(""), 3200);
  };
  const handleVoiceText = async (text: string) => {
    setVoiceText(text);
    setVoiceAnswer("");
    try {
      const result = await postJson<{ intent: string; answer: string; proposal?: { id: string; facts: Record<string, unknown> } | null; storageAvailable: boolean }>("/api/voice/intent", { transcript: text, language });
      setDatabaseAvailable(result.storageAvailable);
      setVoiceAnswer(result.answer);
      if (result.intent === "STOCK_QUERY") setTab("Stock");
      if (result.intent === "CUSTOMER_STATUS") setTab("Customers");
      if (result.intent === "TODAY_PRIORITIES") setTab("Today");
      if (result.intent === "STOCK_UPDATE" && result.proposal) {
        setPendingVoiceProposal(result.proposal);
        setModal("stock_update");
      }
      setNotice(result.answer);
    } catch {
      setNotice("Voice answers are unavailable offline. You can still explore the seeded demo.");
    }
  };
  const speak = () => {
    const Speech = window as unknown as { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
    const SpeechRecognitionAPI = Speech.SpeechRecognition || Speech.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) { setVoiceText(language === "te" ? "వాయిస్ అందుబాటులో లేదు — టైప్ చేసి పంపండి" : "Voice isn’t available here — type a request instead."); return; }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === "te" ? "te-IN" : "en-IN";
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      setSpeechFailures((failures) => {
        const nextFailures = failures + 1;
        if (nextFailures >= 2) {
          setVoiceComposerOpen(true);
          setNotice("Voice recognition failed twice. Type your request instead.");
        } else {
          setNotice("Voice input stopped. Try once more, or type your request instead.");
        }
        return nextFailures;
      });
    };
    recognition.onresult = (event) => {
      setSpeechFailures(0);
      void handleVoiceText(event.results[0][0].transcript);
    };
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setNotice("Voice input could not start. You can type the request instead.");
    }
  };

  const nav: { label: Tab; icon: typeof Activity }[] = [{ label: "Today", icon: Coffee }, { label: "Bills", icon: ClipboardList }, { label: "Customers", icon: Users }, { label: "Stock", icon: Package }, { label: "Cash flow", icon: TrendingUp }, { label: "Activity", icon: Activity }];
  return localizeTree(<div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#today" aria-label={l("Disha home")}><span className="brand-mark"><Leaf size={20} strokeWidth={2.2} /></span><span>disha<span className="brand-period">.</span></span></a>
      <div className="store-switch"><span className="store-avatar"><Store size={17} /></span><span className="store-info"><strong>Sri Sai General Stores</strong><small>Hyderabad, Telangana</small></span><ChevronDown size={15} /></div>
      <span className="nav-label">YOUR SHOP</span>
      <nav className="main-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => setTab(label)} className={`nav-item ${tab === label ? "active" : ""}`} aria-current={tab === label ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{t[(label === "Cash flow" ? "cashflow" : label.toLowerCase()) as keyof typeof t]}</span>{label === "Bills" && <span className="nav-count">4</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-row"><CircleHelp size={17} /><span>Help & feedback</span><ArrowRight size={14} /></div><div className="profile"><span className="profile-avatar">S</span><span className="profile-info"><strong>Suresh</strong><small>Shop owner</small></span><button className="icon-button" aria-label="Profile options"><ChevronDown size={16} /></button></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Sri Sai General Stores <span>/</span> <strong>{t[(tab === "Cash flow" ? "cashflow" : tab.toLowerCase()) as keyof typeof t]}</strong></div><div className="top-actions"><span className="sandbox-pill" title="This preview uses deterministic synthetic shop data. Connect production data before launch."><span />{t.sandbox}<small>synthetic preview</small></span><button className="language-toggle" onClick={() => { const nextLanguage = language === "en" ? "te" : "en"; setLanguage(nextLanguage); document.documentElement.lang = nextLanguage; }} aria-label="Change language"><Languages size={15} />{language === "en" ? "EN" : "తె"}<span className="toggle-caret">⌄</span></button><button className="language-planned" type="button" disabled title="Planned" aria-label="Hindi planned">हिन्दी · planned</button><button className="icon-button notification" aria-label="Notifications"><Bell size={18} /><i /></button></div></header>
      <div className="content-wrap">
        {tab === "Today" && <>
          <section className="welcome-row"><div><p className="eyebrow">SATURDAY <span>·</span> 14 NOVEMBER 2026</p><h1>{t.greeting}<span className="greeting-dot">.</span></h1><p className="welcome-subtitle">{t.subtitle}</p></div><button className="reset-button" onClick={() => setModal("reset")}><RotateCcw size={15} />{t.reset}</button></section>
          <section className="stats-row" aria-label="Yesterday at a glance"><div className="stat-card"><span className="stat-icon sales-icon"><TrendingUp size={18} /></span><span className="stat-meta">{t.sales}<strong>₹{salesTotal.toLocaleString("en-IN")}</strong></span><span className="stat-foot"><span className="positive"><ArrowDownRight size={13} /> 8.4%</span> vs. Thursday</span></div><div className="stat-card"><span className="stat-icon bills-icon"><BookOpenCheck size={18} /></span><span className="stat-meta">{t.billsCount}<strong>{billCount}</strong></span><span className="stat-foot">Your busiest day this week</span></div><div className="stat-card quiet-stat"><span className="stat-icon calm-icon"><ShieldCheck size={18} /></span><span className="stat-meta">Shop health<strong>Looking good</strong></span><span className="stat-foot">One small fix can make it better</span></div></section>
          <section className="priority-section"><div className="section-heading"><div><p className="eyebrow">{t.priorities}</p><h2>{t.prioritiesSub}</h2></div><span className="prepared-tag"><Sparkles size={14} />{t.prepared}</span></div>
            <div className="priority-list">
              <article className="priority-card billing-card"><div className="priority-icon billing-icon"><ClipboardList size={20} /></div><div className="priority-body"><div className="card-kicker">BILLING <span className="soft-tag">Needs a look</span></div><h3>{billRecorded === initialState.billExpected ? "Bill #1048 correction recorded" : `₹${initialState.billExpected - billRecorded} difference on Bill #1048`}</h3><p>{billRecorded === initialState.billExpected ? `The original ₹69 entry was corrected to ₹${initialState.billExpected} after your approval.` : `Sugar 2 kg was entered as ₹${billRecorded} instead of ₹${initialState.billExpected}.`}</p><div className="card-bottom"><span className="fact-chip"><span className={`fact-dot ${billRecorded === initialState.billExpected ? "green" : "amber"}`} />{billRecorded === initialState.billExpected ? "Correction approved" : "Digit swap detected"}</span>{billRecorded === initialState.billExpected ? <span className="text-action">Correction saved</span> : <button className="text-action" onClick={() => setModal("bill")}>Review bill <ArrowRight size={15} /></button>}</div></div><span className="card-number">01</span></article>
              <article className="priority-card customer-card"><div className="priority-icon customer-icon"><Users size={20} /></div><div className="priority-body"><div className="card-kicker">CUSTOMER CARE <span className="soft-tag green-soft">Worth reaching out</span></div><h3>{lakshmi.name} may be missing a visit</h3><p>Last visited {lakshmi.daysSince} days ago · usually every {lakshmi.medianGap} days.</p><div className="card-bottom"><span className="fact-chip"><span className="fact-dot green" />Potentially at risk</span><button className="text-action" onClick={() => setModal("customer")}>View customer <ArrowRight size={15} /></button></div></div><span className="card-number">02</span></article>
              <article className="priority-card stock-card"><div className="priority-icon stock-icon"><Package size={20} /></div><div className="priority-body"><div className="card-kicker">INVENTORY <span className="urgent-tag"><span />{forecast.isUrgent ? t.urgent : "Low stock"}</span></div><h3>Ghee may run out soon</h3><p>Only {onHand} jars left · about {Math.round(forecast.daysLeft)} days of stock.</p><div className="card-bottom"><span className="fact-chip"><span className="fact-dot red" />Reorder {forecast.reorderQty} jars</span><button className="text-action" onClick={() => setModal("stock")}>Review stock <ArrowRight size={15} /></button></div></div><span className="card-number">03</span></article>
            </div>
          </section>
          <DemoBillEditor saving={savingBill} language={language} onAdd={addDemoBill} />
          <section className="voice-bar"><div className="voice-mark"><AudioLines size={19} /></div><div className="voice-copy"><strong>{voiceText || t.speak}</strong><span>{voiceText ? "Try another request or select a section above." : "Ask Disha about bills, customers or stock"}</span></div><div className={`voice-waveform ${isListening ? "is-listening" : ""}`} aria-label={isListening ? "Listening" : "Voice input ready"} role="img">{[18, 30, 12, 36, 23, 42, 16, 31, 22, 38, 14, 27, 19].map((height, index) => <span key={index} style={{ "--wave-height": `${height}%` } as React.CSSProperties} />)}</div><button className={`mic-button ${isListening ? "recording" : ""}`} onClick={speak} aria-label={isListening ? "Listening for voice input" : "Start voice input"}><Mic size={18} /></button><span className="voice-divider" /><button className="type-button" onClick={() => setVoiceComposerOpen((open) => !open)} aria-expanded={voiceComposerOpen}>Type instead <ArrowRight size={14} /></button>{voiceComposerOpen && <form className="voice-composer" onSubmit={(event) => { const nativeEvent = event.nativeEvent as SubmitEvent & { isComposing?: boolean; keyCode?: number }; if (nativeEvent.isComposing || nativeEvent.keyCode === 229) return; event.preventDefault(); const trimmed = voiceComposerText.trim(); if (!trimmed) return; void handleVoiceText(trimmed); setVoiceComposerText(""); setVoiceComposerOpen(false); }}><label htmlFor="voice-request">Ask Disha</label><div><input id="voice-request" value={voiceComposerText} onChange={(event) => setVoiceComposerText(event.target.value)} placeholder="e.g. How much ghee is left?" autoFocus /><button type="submit" aria-label="Send typed request"><ArrowRight size={14} /></button></div></form>}</section>
          {voiceAnswer && <NarrationPlayer text={voiceAnswer} language={language} />}
          <div className="footer-note"><span className="ai-spark"><Sparkles size={13} /></span> Disha notices patterns. You stay in control. <span className="footer-separator">·</span> Nothing happens without your approval.</div>
        </>}
        {tab === "Bills" && <section className="detail-page"><PageHeading eyebrow="RECONCILIATION" title="A quick billing check" subtitle="A small difference stood out in yesterday’s bills." /><div className="bill-summary panel"><div className="bill-topline"><span className="bill-id">BILL #1048</span><span className={`soft-tag ${billRecorded === initialState.billExpected ? "green-soft" : ""}`}>{billRecorded === initialState.billExpected ? "Correction approved" : "Needs a look"}</span><span className="bill-date">13 Nov 2026 · 11:42 AM</span></div><div className="bill-customer"><span className="customer-initial">R</span><div><strong>Ravi Kumar</strong><small>Paid by UPI</small></div><span className="total-label">Bill total <strong>₹684</strong></span></div><div className="recon-table"><div className="recon-row table-head"><span>ITEM</span><span>EXPECTED</span><span>RECORDED</span></div><div className="recon-row"><span>Sugar 2 kg</span><span>₹{initialState.billExpected}</span><span className={billRecorded === initialState.billExpected ? "" : "bad-value"}>₹{billRecorded.toLocaleString("en-IN")} <small>{billRecorded === initialState.billExpected ? "approved" : `−₹${initialState.billExpected - billRecorded}`}</small></span></div></div><div className="explain-box"><span className="explain-icon"><Sparkles size={16} /></span><div><strong>What we noticed</strong><p>{billRecorded === initialState.billExpected ? "The synthetic bill now reflects the correction you approved." : `The price list says ₹${initialState.billExpected}. The bill has ₹${billRecorded} — the digits may have been swapped. No changes have been made.`}</p></div></div><div className="action-row"><button className="secondary-action" onClick={() => void audit()} disabled={billRecorded === initialState.billExpected}>Looks right</button><button className="primary-action" onClick={() => setModal("bill")} disabled={billRecorded === initialState.billExpected}>Approve correction <ArrowRight size={16} /></button></div></div><div className="supporting-note"><ShieldCheck size={16} />{billRecorded === initialState.billExpected ? "The synthetic bill now reflects your approved correction." : "The bill ledger stays unchanged until you approve a correction."}</div><div className="cohort-panel panel"><div className="catalog-heading"><div><p className="eyebrow">7-DAY RECONCILIATION</p><h2>Other records to review</h2></div><span>{analytics.discrepancies.filter((row) => row.bill !== "#1048").length} additional flags</span></div><div className="catalog-table-wrap"><table className="catalog-table"><caption>Approved discounts are excluded from review.</caption><thead><tr><th scope="col">Bill</th><th scope="col">Issue</th><th scope="col">Expected</th><th scope="col">Recorded</th></tr></thead><tbody>{analytics.discrepancies.filter((row) => row.bill !== "#1048").map((row) => <tr key={`${row.bill}-${row.kind}`}><th scope="row">{row.bill}</th><td>{row.kind.toLowerCase().replaceAll("_", " ")} · {row.item}</td><td>₹{row.expected.toLocaleString("en-IN")}</td><td>₹{row.recorded.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div></div></section>}
        {tab === "Customers" && <section className="detail-page"><PageHeading eyebrow="CUSTOMER CARE" title="A thoughtful hello goes a long way" subtitle={`${analytics.dataset.customerCount} customers · ${analytics.customers.filter((customer) => customer.segment === "At risk").length} at risk · ${analytics.customers.filter((customer) => customer.segment === "Active").length} active · ${analytics.customers.filter((customer) => customer.segment === "New").length} new`} /><div className="customer-layout"><div className="customer-profile panel"><div className="profile-header"><span className="large-initial">L</span><div><h2>Lakshmi</h2><p>Regular customer <span className="profile-dot">·</span> Customer since Aug 2026</p></div><span className="risk-badge">Potentially at risk</span></div><div className="customer-metrics"><div><small>LAST VISIT</small><strong>{language === "te" ? `${lakshmi.daysSince} రోజుల క్రితం` : `${lakshmi.daysSince} days ago`}</strong></div><div><small>USUAL VISIT</small><strong>{language === "te" ? `ప్రతి ${lakshmi.medianGap} రోజులకు ఒకసారి` : `Every ${lakshmi.medianGap} days`}</strong></div><div><small>MONTHLY SPEND</small><strong>₹{lakshmi.monthlySpend.toLocaleString("en-IN")}</strong></div></div><div className="reason-box"><span className="reason-mark"><Clock3 size={17} /></span><p>It’s been a little longer than usual since Lakshmi’s last visit. This is a gentle nudge, not a prediction.</p></div><div className="balance-row"><div><span>Outstanding balance</span><small>Only visible to you</small></div><button className="show-balance" onClick={() => setShowBalance(!showBalance)}>{showBalance ? "Hide" : "Show"}</button>{showBalance && <strong className="balance-value">₹{lakshmi.balance.toLocaleString("en-IN")}</strong>}</div></div><div className="message-panel panel"><div className="message-panel-head"><div><p className="eyebrow">MESSAGE DRAFT</p><h3>A warm, personal note</h3></div><span className="simulated-tag">Simulated</span></div><div className="language-tabs"><button className={!messagePreview ? "selected" : ""} onClick={() => setMessagePreview(false)}>తెలుగు</button><button className={messagePreview ? "selected" : ""} onClick={() => setMessagePreview(true)}>English</button></div>{editingMessage ? <textarea className="message-preview message-editor" aria-label="Edit message draft" rows={4} maxLength={500} value={messageDrafts[messagePreview ? "en" : "te"]} onChange={(event) => setMessageDrafts((current) => ({ ...current, [messagePreview ? "en" : "te"]: event.target.value }))} /> : <div className="message-preview">{messageDrafts[messagePreview ? "en" : "te"]}</div>}<p className="no-send-note"><ShieldCheck size={14} />Nothing is sent until you approve. This is a demo.</p><div className="message-actions"><button className="secondary-action" onClick={() => setEditingMessage((editing) => !editing)}>{editingMessage ? "Done editing" : "Edit draft"}</button><button className="primary-action" onClick={() => setModal("customer")}>Approve & simulate send <ArrowRight size={15} /></button></div></div></div><div className="cohort-panel panel"><div className="catalog-heading"><div><p className="eyebrow">SEGMENT OVERVIEW</p><h2>Customer activity</h2></div><span>{analytics.dataset.customerCount} synthetic profiles</span></div><div className="catalog-table-wrap"><table className="catalog-table"><caption>Customer segments from recent visit intervals</caption><thead><tr><th scope="col">Customer</th><th scope="col">Segment</th><th scope="col">Last visit</th><th scope="col">Usual gap</th><th scope="col">Monthly spend</th></tr></thead><tbody>{analytics.customers.map((customer) => <tr key={customer.id}><th scope="row">{customer.name}</th><td><span className={`segment-tag ${customer.segment.toLowerCase().replace(" ", "-")}`}>{customer.segment}</span></td><td>{customer.daysSince} days</td><td>{customer.medianGap ? `Every ${customer.medianGap} days` : "New"}</td><td>₹{customer.monthlySpend.toLocaleString("en-IN")}</td></tr>)}</tbody></table></div></div></section>}
        {tab === "Stock" && <section className="detail-page"><PageHeading eyebrow="INVENTORY" title="Stay a step ahead of an empty shelf" subtitle={`${analytics.dataset.skuCount} products · ${ledgerBillCount.toLocaleString("en-IN")} bills from ${analytics.dataset.start} to ${analytics.dataset.end}`} /><div className="stock-layout"><div className="stock-panel panel"><div className="stock-head"><span className="product-icon"><ShoppingBasket size={20} /></span><div><h2>Ghee 500 ml</h2><p>SKU · Dairy & chilled</p></div><span className="urgent-tag"><span />{forecast.isUrgent ? t.urgent : "Low stock"}</span></div><div className="stock-numbers"><div><small>ON HAND</small><strong>{onHand}<span> jars</span></strong></div><div><small>SALES VELOCITY</small><strong>{forecast.velocity.toFixed(2)}<span> / day</span></strong></div><div><small>DAYS LEFT</small><strong className="danger-number">{forecast.daysLeft.toFixed(1)}<span> days</span></strong></div></div><div className="stock-chart"><div className="chart-title"><span>Estimated stock over time</span><span>Based on recent sales</span></div><svg viewBox="0 0 640 150" role="img" aria-label={`Estimated stock depletion in ${forecast.daysLeft.toFixed(1)} days`} preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d8a446" stopOpacity=".23"/><stop offset="100%" stopColor="#d8a446" stopOpacity="0"/></linearGradient></defs><path d={`M0 24 L${Math.max(40, forecast.daysLeft * 70)} 142 L640 142 L640 150 L0 150 Z`} fill="url(#fill)"/><path d={`M0 24 L${Math.max(40, forecast.daysLeft * 70)} 142`} fill="none" stroke="#ca9130" strokeWidth="3" strokeLinecap="round"/><line x1="0" y1="142" x2="640" y2="142" stroke="#e8e3d8" strokeDasharray="4 5"/><line x1="200" y1="0" x2="200" y2="145" stroke="#d7c5a2" strokeDasharray="4 5"/><text x="205" y="15" fill="#a57827" fontSize="10">Supplier delivery · 2d</text><text x="4" y="137" fill="#8a9289" fontSize="10">0</text><text x="150" y="137" fill="#8a9289" fontSize="10">2 days</text><text x="360" y="137" fill="#8a9289" fontSize="10">5 days</text><text x="590" y="137" fill="#8a9289" fontSize="10">9 days</text></svg></div><div className="math-lines"><div><span>On hand at delivery</span><span>{forecast.onHandAtDelivery.toFixed(1)} jars</span></div><div><span>7-day target + safety buffer</span><span>{Math.ceil(7 * forecast.velocity) + forecast.safetyBuffer} jars</span></div><div className="math-total"><span>Suggested reorder</span><strong>{forecast.reorderQty} jars</strong></div></div><div className="edit-stock"><label htmlFor="stock-count">Demo mode · change stock to see forecast update</label><div className="stock-input-row"><input id="stock-count" type="range" min="0" max="40" value={onHand} onChange={(e) => setOnHand(Number(e.target.value))} onPointerUp={() => void persistStock()} onKeyUp={() => void persistStock()} onBlur={() => void persistStock()} /><output>{onHand} jars</output></div></div><button className="primary-action full-action" onClick={async () => { if (await persistStock(onHand)) setModal("stock"); }}>Create reorder draft · {forecast.reorderQty} jars <ArrowRight size={16} /></button><div className="festival-control"><label htmlFor="festival-multiplier">Festival demand multiplier</label><div className="stock-input-row"><input id="festival-multiplier" type="range" min="1" max="3" step="0.25" value={festivalMultiplier} onChange={(event) => setFestivalMultiplier(Number(event.target.value))} onPointerUp={() => void persistStock(onHand, festivalMultiplier, "festival")} onKeyUp={() => void persistStock(onHand, festivalMultiplier, "festival")} onBlur={() => void persistStock(onHand, festivalMultiplier, "festival")} /><output>{festivalMultiplier.toFixed(2)}×</output></div><p className="festival-note"><CircleHelp size={14} />{festivalMultiplier === 1 ? "Festival uplift not yet modelled." : language === "te" ? `అంచనాలో ${festivalMultiplier.toFixed(2)}× పండుగ డిమాండ్ పరిగణించబడింది.` : `Forecast includes a ${festivalMultiplier.toFixed(2)}× festival demand uplift.`}</p></div></div><aside className="stock-side panel"><p className="eyebrow">HOW WE GOT HERE</p><h3>Clear math. Your call.</h3><div className="equation"><span>{gheeForecast.unitsSold28Days} units</span><small>sold in 28 days</small><b>÷ 28</b><strong>{forecast.velocity.toFixed(2)}/day</strong></div><div className="side-divider"/><div className="supplier-card"><small>YOUR SUPPLIER</small><strong>Sri Lakshmi Distributors</strong><span>Typical delivery · 2 days</span></div><div className="side-insight"><Sparkles size={16} /><span>At this pace, stock could run out before a new delivery arrives.</span></div></aside></div><DemoBillEditor saving={savingBill} language={language} onAdd={addDemoBill} /><div className="cohort-panel panel"><div className="catalog-heading"><div><p className="eyebrow">FULL CATALOG</p><h2>Products tracked</h2></div><span>{analytics.dataset.skuCount} synthetic SKUs</span></div><div className="catalog-table-wrap"><table className="catalog-table"><caption>Stock, sales velocity and suggested replenishment for all tracked products</caption><thead><tr><th scope="col">Product</th><th scope="col">On hand</th><th scope="col">Sold · 28d</th><th scope="col">Days left</th><th scope="col">Suggested reorder</th></tr></thead><tbody>{analytics.stock.map((sku) => { const isGhee = sku.id === "sku_ghee"; const daysLeft = isGhee ? forecast.daysLeft : sku.daysLeft; const reorderQty = isGhee ? forecast.reorderQty : sku.reorderQty; return <tr key={sku.id}><th scope="row">{sku.name}</th><td>{isGhee ? onHand : sku.onHand} {sku.unit === "jar" ? "jars" : sku.unit === "pack" ? "packs" : sku.unit === "bag" ? "bags" : sku.unit === "bottle" ? "bottles" : sku.unit === "bar" ? "bars" : sku.unit === "pouch" ? "pouches" : "units"}</td><td>{isGhee ? gheeForecast.unitsSold28Days + additionalGheeUnits : sku.unitsSold28Days}</td><td>{Number.isFinite(daysLeft) ? `${daysLeft.toFixed(1)} days` : "—"}</td><td>{reorderQty > 0 ? `${reorderQty} units` : "—"}</td></tr>; })}</tbody></table></div></div></section>}
        {tab === "Cash flow" && <CashFlowPanel projection={cashFlow} language={language} />}
        {tab === "Activity" && <section className="detail-page"><PageHeading eyebrow="YOUR DECISIONS" title="A clear record of every action" subtitle="Nothing happens behind your back. Here’s the activity you approved." /><div className="audit-panel panel">{logs.length === 0 ? <div className="empty-state"><span><Activity size={21} /></span><h3>No actions yet</h3><p>When you approve or dismiss a suggestion, it will appear here.</p><button className="text-action" onClick={() => setTab("Today")}>Back to your briefing <ArrowRight size={15} /></button></div> : logs.map((log, index) => <div className="audit-entry" key={`${log.time}-${index}`}><span className="audit-icon"><BadgeCheck size={17} /></span><div className="audit-copy"><strong>{log.action}</strong><span>{log.detail}</span><small>Merchant · {log.result}</small></div><time>{log.time}</time></div>)}</div><p className="audit-footnote"><ShieldCheck size={15} />{databaseAvailable ? "Sandbox activity is saved in Supabase; the audit log is append-only." : "Offline demo mode: activity cannot be saved until Supabase is reachable."}</p></section>}
      </div>
      <footer className="global-footer"><span>© 2026 Disha <i>·</i> Made for the people behind the counter</span><span><span className="online-dot" />{databaseAvailable ? t.online : "Offline demo · not saved"}</span></footer>
    </main>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && modal !== "stock_update") setModal(null); }}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => { if (modal !== "stock_update") setModal(null); }} aria-label={modal === "stock_update" ? "Close unavailable; choose an action" : "Close"} disabled={modal === "stock_update"}><X size={18} /></button><span className="modal-icon">{modal === "reset" ? <RotateCcw size={21} /> : modal === "customer" ? <Users size={21} /> : modal === "stock" || modal === "stock_update" ? <Package size={21} /> : <ClipboardList size={21} />}</span><p className="eyebrow">{modal === "reset" ? "RESET DEMO" : "YOUR APPROVAL NEEDED"}</p><h2 id="modal-title">{modal === "reset" ? "Start fresh?" : modal === "customer" ? "Send Lakshmi a hello?" : modal === "stock" ? `Prepare a ${forecast.reorderQty}-jar reorder?` : modal === "stock_update" ? "Confirm stock update?" : "Correct Bill #1048?"}</h2><p>{modal === "reset" ? "This clears visible activity and restores the demo values. The append-only audit history is preserved." : modal === "customer" ? "The edited message draft will be added to the sandbox outbox. No real message will be sent." : modal === "stock" ? `This creates a purchase draft for ${forecast.reorderQty} jars from Sri Lakshmi Distributors. Nothing is ordered yet.` : modal === "stock_update" ? `This proposes changing the synthetic Ghee count from ${pendingVoiceProposal?.facts.current_on_hand} to ${pendingVoiceProposal?.facts.new_on_hand} jars. Your approval is required.` : `Approving updates the synthetic bill from ₹${billRecorded} to ₹${initialState.billExpected}. Nothing is sent to a live ledger.`}</p><div className="approval-facts"><span><ShieldCheck size={16} />{modal === "reset" ? "Sandbox only · clears visible activity" : "Sandbox only · no live systems connected"}</span><span><Check size={16} />You can review this action in Activity</span></div><div className="modal-actions"><button className="secondary-action" onClick={() => void dismissAction()} disabled={savingAction}>{t.cancel}</button><button className="primary-action" onClick={() => modal === "reset" ? void resetDemo() : void finish(modal === "stock" ? "create_reorder_draft" : modal === "customer" ? "draft_whatsapp_message" : modal === "stock_update" ? "update_stock_from_voice" : "reconcile_day")} disabled={savingAction} aria-busy={savingAction}>{savingAction ? "Saving…" : modal === "reset" ? "Reset demo" : t.approve}<ArrowRight size={15} /></button></div></section></div>}
    {notice && <div className="toast" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
  </div>, language);
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>; }
