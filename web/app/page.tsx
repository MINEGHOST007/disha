import { redirect } from "next/navigation";
import { MerchantWorkspace } from "@/components/merchant-workspace";
import { buildPurchaseForecast, isFestivalScenarioActive, seasonalOrderQuantity } from "@/lib/merchant/purchase-forecast";
import { customerFrequency, projectCashFlow } from "@/lib/merchant/financials";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/authz";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  const workspace = await getWorkspaceContext();
  if (!workspace) redirect("/onboarding");

  const [merchantResult, suppliersResult, purchaseBillsResult, purchaseLinesResult, transactionsResult, aliasesResult, khataResult, ordersResult, orderLinesResult, gstResult, seasonalResult, auditResult] = await Promise.all([
    supabase.from("disha_merchants").select("name").eq("id", workspace.merchantId).maybeSingle(),
    supabase.from("disha_suppliers").select("id,name").eq("merchant_id", workspace.merchantId).limit(1000),
    supabase.from("disha_purchase_bills").select("id,supplier_id,bill_number,bill_date,total_amount,credit_days,source,source_file_name").eq("merchant_id", workspace.merchantId).order("bill_date", { ascending: true }).limit(5000),
    supabase.from("disha_purchase_bill_lines").select("purchase_bill_id,item_name,quantity,unit,unit_price,line_total").eq("merchant_id", workspace.merchantId).limit(10000),
    supabase.from("disha_transactions").select("id,occurred_at,customer_name,amount,mode,status").eq("merchant_id", workspace.merchantId).order("occurred_at", { ascending: false }).limit(10000),
    supabase.from("disha_customer_aliases").select("customer_name,alias").eq("merchant_id", workspace.merchantId).limit(5000),
    supabase.from("disha_khata_entries").select("id,customer_name,amount,paid_amount,note,due_date,contact_phone,auto_match,status,created_at,closed_at").eq("merchant_id", workspace.merchantId).order("created_at", { ascending: false }).limit(5000),
    supabase.from("disha_order_drafts").select("id,supplier_name,supplier_phone,order_date,status,order_total,call_status,seller_confirmation,created_at").eq("merchant_id", workspace.merchantId).order("created_at", { ascending: false }).limit(200),
    supabase.from("disha_order_draft_lines").select("order_id,item_name,quantity,unit,unit_price,line_total").eq("merchant_id", workspace.merchantId).limit(5000),
    supabase.from("disha_tax_obligations").select("id,tax_period,amount,paid_amount,due_date,payment_reference,note,status,created_at,paid_at").eq("merchant_id", workspace.merchantId).order("due_date", { ascending: false }).limit(500),
    supabase.from("disha_seasonal_order_scenarios").select("state,district,festival_name,event_date,uplift_percent,source").eq("merchant_id",workspace.merchantId).maybeSingle(),
    supabase.from("disha_audit_log").select("id,created_at,actor,tool,decision,outcome,facts").eq("merchant_id", workspace.merchantId).order("created_at", { ascending: false }).limit(50),
  ]);
  const schemaReady = [suppliersResult,purchaseBillsResult,purchaseLinesResult,transactionsResult,aliasesResult,khataResult,ordersResult,orderLinesResult].every((result) => !result.error);
  const suppliers = new Map((suppliersResult.data ?? []).map((supplier) => [supplier.id, supplier.name]));
  const linesByBill = new Map<string, typeof purchaseLinesResult.data>();
  for (const line of purchaseLinesResult.data ?? []) linesByBill.set(line.purchase_bill_id, [...(linesByBill.get(line.purchase_bill_id) ?? []), line]);
  const purchaseBills = (purchaseBillsResult.data ?? []).map((bill) => ({
    supplier_name: suppliers.get(bill.supplier_id) ?? "Unknown supplier",
    bill_number: bill.bill_number,
    bill_date: bill.bill_date,
    total_amount: Number(bill.total_amount),
    credit_days: bill.credit_days,
    items: (linesByBill.get(bill.id) ?? []).map((line) => ({ name: line.item_name, quantity: Number(line.quantity), unit: line.unit, unit_price: Number(line.unit_price), line_total: Number(line.line_total) })),
  }));
  const transactions = (transactionsResult.data ?? []).map((row) => ({ id: row.id, ts: row.occurred_at, customer_name: row.customer_name, amount: Number(row.amount), mode: row.mode, status: row.status }));
  const aliases = aliasesResult.data ?? [];
  const khata = (khataResult.data ?? []).map((row) => ({ ...row, amount: Number(row.amount), paid_amount: Number(row.paid_amount) }));
  const demoData = (purchaseBillsResult.data ?? []).some((bill) => bill.bill_number.startsWith("DEMO-"))
    || (transactionsResult.data ?? []).some((row) => row.id && "external_id" in row && String(row.external_id).startsWith("DEMO-TX-"))
    || khata.some((row) => row.note?.startsWith("[DEMO DATA]"))
    || (auditResult.data ?? []).some((event) => event.tool === "demo_data_seed");
  const orders = (ordersResult.data ?? []).map((order) => ({ ...order, order_total: Number(order.order_total), lines: (orderLinesResult.data ?? []).filter((line) => line.order_id === order.id).map((line) => ({ ...line, quantity: Number(line.quantity), unit_price: Number(line.unit_price), line_total: Number(line.line_total) })) }));
  const gstObligations = (gstResult.data ?? []).map((row) => ({ ...row, amount:Number(row.amount), paid_amount:Number(row.paid_amount) }));
  const seasonalScenario = seasonalResult.data ? { ...seasonalResult.data, uplift_percent:Number(seasonalResult.data.uplift_percent) } : null;
  const forecast = buildPurchaseForecast(purchaseBills);
  const asOfDate = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata"}).format(new Date());
  const scenarioLines = forecast.lines.map((line) => {
    const applies=isFestivalScenarioActive(seasonalScenario?.event_date??null,asOfDate,line.next_order_date);
    const quantity=seasonalOrderQuantity(line.predicted_quantity,line.pack_size,seasonalScenario?.uplift_percent??0,applies);
    return {...line,estimated_order_value:quantity*line.unit_price};
  });
  const nearestOrder = scenarioLines[0];
  const cashFlow = projectCashFlow(nearestOrder ? scenarioLines.reduce((sum, line) => sum + line.estimated_order_value, 0) : 0, nearestOrder?.credit_days ?? 7, transactions, asOfDate);
  const customers = customerFrequency(transactions, aliases, asOfDate);
  return <MerchantWorkspace
    merchantName={merchantResult.data?.name ?? "Your store"}
    supplierCallMode={process.env.LIVEKIT_MODE?.trim().toLowerCase() === "live" ? "live" : "stub"}
    schemaReady={schemaReady}
    demoData={demoData}
    gstReady={!gstResult.error}
    gstObligations={gstObligations}
    seasonalScenarioReady={!seasonalResult.error}
    seasonalScenario={seasonalScenario}
    role={workspace.role}
    purchaseBills={purchaseBills}
    forecast={forecast}
    transactions={transactions}
    cashFlow={cashFlow}
    khata={khata}
    orders={orders}
    customers={customers}
    aliases={aliases}
    audit={auditResult.data ?? []}
  />;
}
