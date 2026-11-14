import "server-only";

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DishaApiError } from "@/lib/disha/http";
import { buildPurchaseForecast } from "./purchase-forecast";
import { customerFrequency, findPaymentsFrom, projectCashFlow, type MerchantTransaction } from "./financials";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const safeError = "Merchant records could not be loaded. Check the Disha merchant growth migration and retry.";
export const MERCHANT_DATA_TOOL_NAMES = ["find_payments_from","get_cashflow_summary","get_purchase_history","forecast_next_orders","get_customer_frequency","get_khata_summary"] as const;

async function loadData(merchantId: string) {
  const supabase = await createClient();
  const [suppliersResult,billsResult,linesResult,transactionsResult,aliasesResult,khataResult] = await Promise.all([
    supabase.from("disha_suppliers").select("id,name").eq("merchant_id",merchantId).limit(1000),
    supabase.from("disha_purchase_bills").select("id,supplier_id,bill_number,bill_date,total_amount,credit_days").eq("merchant_id",merchantId).order("bill_date",{ascending:true}).limit(5000),
    supabase.from("disha_purchase_bill_lines").select("purchase_bill_id,item_name,quantity,unit,unit_price,line_total").eq("merchant_id",merchantId).limit(10000),
    supabase.from("disha_transactions").select("id,occurred_at,customer_name,amount,mode,status").eq("merchant_id",merchantId).order("occurred_at",{ascending:false}).limit(10000),
    supabase.from("disha_customer_aliases").select("customer_name,alias").eq("merchant_id",merchantId).limit(5000),
    supabase.from("disha_khata_entries").select("id,customer_name,amount,paid_amount,due_date,auto_match,status,created_at").eq("merchant_id",merchantId).order("created_at",{ascending:false}).limit(5000),
  ]);
  if ([suppliersResult,billsResult,linesResult,transactionsResult,aliasesResult,khataResult].some((result)=>result.error)) throw new DishaApiError(safeError,503);
  const supplierNames=new Map((suppliersResult.data??[]).map((supplier)=>[supplier.id,supplier.name]));
  const linesByBill=new Map<string,typeof linesResult.data>();
  for(const line of linesResult.data??[]) linesByBill.set(line.purchase_bill_id,[...(linesByBill.get(line.purchase_bill_id)??[]),line]);
  const bills=(billsResult.data??[]).map((bill)=>({supplier_name:supplierNames.get(bill.supplier_id)??"Unknown supplier",bill_number:bill.bill_number,bill_date:bill.bill_date,total_amount:Number(bill.total_amount),credit_days:bill.credit_days,items:(linesByBill.get(bill.id)??[]).map((line)=>({name:line.item_name,quantity:Number(line.quantity),unit:line.unit,unit_price:Number(line.unit_price),line_total:Number(line.line_total)}))}));
  const transactions=(transactionsResult.data??[]).map((row)=>({id:row.id,ts:row.occurred_at,customer_name:row.customer_name,amount:Number(row.amount),mode:row.mode,status:row.status})) as MerchantTransaction[];
  return {bills,transactions,aliases:aliasesResult.data??[],khata:(khataResult.data??[]).map((entry)=>({...entry,amount:Number(entry.amount),paid_amount:Number(entry.paid_amount)}))};
}

export function createMerchantDataTools(merchantId: string) {
  return [
    tool(async ({customer_name,from_date,to_date})=>{
      const {transactions,aliases}=await loadData(merchantId);
      const matches=findPaymentsFrom(customer_name,transactions,aliases,from_date,to_date);
      return JSON.stringify({customer_name,transaction_count:matches.length,payments:matches.slice(0,20).map(({ts,amount,mode,status})=>({ts,amount,mode,status}))});
    },{name:"find_payments_from",description:"Look up successful recorded payments from a named person. Use the exact customer name and merchant aliases, and return only rows present in this merchant workspace.",schema:z.object({customer_name:z.string().trim().min(1).max(120),from_date:isoDate.optional(),to_date:isoDate.optional()}).strict()}),
    tool(async ({days})=>{
      const {transactions}=await loadData(merchantId); const end=new Date().toISOString().slice(0,10); const start=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
      const subset=transactions.filter((tx)=>tx.ts.slice(0,10)>=start&&tx.ts.slice(0,10)<=end);
      const result=projectCashFlow(0,0,subset,end);
      return JSON.stringify({days,successful_transactions:result.transaction_count,digital_collections:result.digital_collections_28d,average_daily_digital_collections:result.average_daily_digital_collections,caveat:"Digital collections only; cash sales are not visible. Other expenses are not included."});
    },{name:"get_cashflow_summary",description:"Summarize recorded successful digital collections in a recent window. State that cash sales are invisible and this is not a bank balance.",schema:z.object({days:z.number().int().min(1).max(365).default(28)}).strict()}),
    tool(async ({supplier_name})=>{
      const {bills}=await loadData(merchantId); const filter=supplier_name?.trim().toLocaleLowerCase(); const matching=bills.filter((bill)=>!filter||bill.supplier_name.toLocaleLowerCase().includes(filter));
      return JSON.stringify({bill_count:matching.length,bills:matching.slice(-50).reverse().map((bill)=>({supplier_name:bill.supplier_name,bill_number:bill.bill_number,bill_date:bill.bill_date,total_amount:bill.total_amount,items:bill.items}))});
    },{name:"get_purchase_history",description:"Read supplier purchase invoice history with product names, quantities, rates and dates. This is not an on-hand stock ledger.",schema:z.object({supplier_name:z.string().trim().max(120).optional()}).strict()}),
    tool(async ({supplier_name})=>{
      const {bills}=await loadData(merchantId); const forecast=buildPurchaseForecast(bills); const lines=supplier_name?forecast.lines.filter((line)=>line.supplier_name.toLocaleLowerCase().includes(supplier_name.toLocaleLowerCase())):forecast.lines;
      return JSON.stringify({lines,needs_one_more_bill:forecast.needs_one_more_bill,not_reordered_last_cycle:forecast.not_reordered_last_cycle});
    },{name:"forecast_next_orders",description:"Use deterministic supplier bill cycles to answer what to order next, estimated quantities, next order dates and cost. If history is insufficient, say another bill is needed.",schema:z.object({supplier_name:z.string().trim().max(120).optional()}).strict()}),
    tool(async ({as_of_date})=>{
      const {transactions,aliases}=await loadData(merchantId); const customers=customerFrequency(transactions,aliases,as_of_date??new Date().toISOString().slice(0,10));
      return JSON.stringify({customers:customers.slice(0,100)});
    },{name:"get_customer_frequency",description:"Summarize payment frequency for named customers, using unique successful payment dates and median gaps. The risk flag is only a prompt to review.",schema:z.object({as_of_date:isoDate.optional()}).strict()}),
    tool(async ({status})=>{
      const {khata}=await loadData(merchantId); const entries=khata.filter((entry)=>!status||entry.status===status);
      return JSON.stringify({entries:entries.map(({customer_name,amount,paid_amount,due_date,auto_match,status,created_at})=>({customer_name,amount,paid_amount,outstanding:amount-paid_amount,due_date,auto_match,status,created_at}))});
    },{name:"get_khata_summary",description:"Read open, partially paid, or closed merchant Khata reminders and outstanding balances.",schema:z.object({status:z.enum(["open","partially_paid","closed"]).optional()}).strict()}),
  ];
}
