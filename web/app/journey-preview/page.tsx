import { notFound } from "next/navigation";
import { MerchantWorkspace } from "@/components/merchant-workspace";
import { buildPurchaseForecast } from "@/lib/merchant/purchase-forecast";
import { customerFrequency, projectCashFlow } from "@/lib/merchant/financials";

export const dynamic = "force-dynamic";

function isoDay(offset: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

/** Local-only visual fixture used for product walkthrough screenshots. */
export default async function JourneyPreview({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const initialTab = ["Orders", "Khata", "GST", "Cash flow", "Customers", "Ask Disha"].includes(params.tab ?? "") ? params.tab : "Orders";
  const purchaseBills = [
    { supplier_name:"Sri Lakshmi Traders",bill_number:"DEMO-SL-01",bill_date:isoDay(-62),total_amount:6840,credit_days:7,items:[{name:"Rice · 25 kg",quantity:60,unit:"bag",unit_price:92,line_total:5520},{name:"Sugar · 50 kg",quantity:30,unit:"bag",unit_price:44,line_total:1320}] },
    { supplier_name:"Sri Lakshmi Traders",bill_number:"DEMO-SL-02",bill_date:isoDay(-32),total_amount:8208,credit_days:7,items:[{name:"Rice · 25 kg",quantity:72,unit:"bag",unit_price:94,line_total:6768},{name:"Sugar · 50 kg",quantity:36,unit:"bag",unit_price:40,line_total:1440}] },
    { supplier_name:"Sri Lakshmi Traders",bill_number:"DEMO-SL-03",bill_date:isoDay(-2),total_amount:7488,credit_days:7,items:[{name:"Rice · 25 kg",quantity:72,unit:"bag",unit_price:96,line_total:6912},{name:"Sugar · 50 kg",quantity:36,unit:"bag",unit_price:16,line_total:576}] },
    { supplier_name:"City Wholesale",bill_number:"DEMO-CW-01",bill_date:isoDay(-1),total_amount:6720,credit_days:5,items:[{name:"Rice · 25 kg",quantity:72,unit:"bag",unit_price:93,line_total:6696},{name:"Sugar · 50 kg",quantity:36,unit:"bag",unit_price:24,line_total:864}] },
  ];
  const forecast = buildPurchaseForecast(purchaseBills);
  const transactions = [
    ...[0,7,14,21].map((offset,index)=>({id:`preview-r-${index}`,ts:`${isoDay(-offset)}T10:30:00+05:30`,customer_name:"Ramesh",amount:820+index*30,mode:"UPI",status:"success" as const})),
    ...[2,9,16,23].map((offset,index)=>({id:`preview-a-${index}`,ts:`${isoDay(-offset)}T13:10:00+05:30`,customer_name:"Asha Stores",amount:1350,mode:"Paytm digital",status:"success" as const})),
  ];
  const khata = [
    {id:"preview-k1",customer_name:"Ramesh",amount:2400,paid_amount:400,note:"Snacks and household items",due_date:isoDay(-3),contact_phone:null,auto_match:false,status:"partially_paid" as const,created_at:`${isoDay(-12)}T09:00:00Z`,closed_at:null},
    {id:"preview-k2",customer_name:"Asha Stores",amount:1750,paid_amount:0,note:"Weekly groceries",due_date:isoDay(4),contact_phone:null,auto_match:true,status:"open" as const,created_at:`${isoDay(-4)}T09:00:00Z`,closed_at:null},
    {id:"preview-k3",customer_name:"Suresh",amount:900,paid_amount:900,note:"Cleared",due_date:isoDay(-18),contact_phone:null,auto_match:false,status:"closed" as const,created_at:`${isoDay(-25)}T09:00:00Z`,closed_at:`${isoDay(-17)}T09:00:00Z`},
  ];
  const customers = customerFrequency(transactions, [], isoDay(0));
  const cashFlow = projectCashFlow(forecast.lines.reduce((sum,line)=>sum+line.estimated_order_value,0),7,transactions,isoDay(0));
  const gstObligations=[{id:"preview-gst-1",tax_period:"Oct 2026",amount:5200,paid_amount:0,due_date:isoDay(6),payment_reference:null,note:"Entered from merchant's GST portal",status:"due" as const,created_at:`${isoDay(-1)}T09:00:00Z`,paid_at:null}];
  return <MerchantWorkspace merchantName="Shanti General Store" schemaReady gstReady gstObligations={gstObligations} demoData initialTab={initialTab} role="manager" supplierCallMode="stub" purchaseBills={purchaseBills} forecast={forecast} transactions={transactions} cashFlow={cashFlow} khata={khata} orders={[]} customers={customers} aliases={[]} audit={[]} />;
}
