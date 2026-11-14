"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NarrationPlayer } from "@/components/narration-player";
import { createClient } from "@/lib/supabase/client";
import type { PurchaseBill, PurchaseForecastResult } from "@/lib/merchant/purchase-forecast";
import type { CustomerFrequency, KhataEntry, MerchantTransaction } from "@/lib/merchant/financials";

type CashFlow = ReturnType<typeof import("@/lib/merchant/financials").projectCashFlow>;
type OrderLine = { item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
type Order = { id: string; supplier_name: string; supplier_phone: string | null; order_date: string | null; status: string; order_total: number; call_status: string | null; seller_confirmation: string | null; created_at: string; lines: OrderLine[] };
type Audit = { id: number; created_at: string; actor: string; tool: string; decision: string; outcome: string | null; facts: unknown };
type Props = { merchantName: string; schemaReady: boolean; role: string; purchaseBills: PurchaseBill[]; forecast: PurchaseForecastResult; transactions: MerchantTransaction[]; cashFlow: CashFlow; khata: KhataEntry[]; orders: Order[]; customers: CustomerFrequency[]; audit: Audit[] };
type EditableBill = PurchaseBill & { source: "csv" | "sarvam_vision" | "openrouter_vision"; source_file_name?: string; validationErrors?: string[] };

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "The request failed. Try again.");
  return data as T;
}

export function MerchantWorkspace(props: Props) {
  const { merchantName, schemaReady, role, purchaseBills, forecast, transactions, cashFlow, khata, orders, customers, audit } = props;
  const router = useRouter();
  const [tab, setTab] = useState("Orders");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewBills, setReviewBills] = useState<EditableBill[]>([]);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [answer, setAnswer] = useState<{ answer: string; usedTools: string[]; fallbackUsed: boolean } | null>(null);
  const [khataForm, setKhataForm] = useState({ customer_name: "", amount: "", due_date: "", auto_match: true, note: "" });
  const canEdit = role === "owner" || role === "manager";
  const today = new Date().toISOString().slice(0, 10);

  function fail(cause: unknown) { setError(cause instanceof Error ? cause.message : "Something went wrong. Try again."); }
  async function previewCsv(file?: File) {
    if (!file) return;
    setBusy("bill"); setError(""); setNotice("");
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/purchase-bills/preview-csv", { method: "POST", body: form }); const data = await readResponse<{ bills: EditableBill[] }>(response); setReviewBills(data.bills); setNotice(`Review ${data.bills.length} supplier invoice${data.bills.length === 1 ? "" : "s"}. Nothing is saved yet.`); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function parsePhoto(file?: File) {
    if (!file) return;
    setBusy("bill"); setError(""); setNotice("");
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/purchase-bills/ocr", { method: "POST", body: form }); const data = await readResponse<{ bill: EditableBill; validationErrors: string[] }>(response); setReviewBills([{ ...data.bill, validationErrors: data.validationErrors }]); setNotice("Invoice read. Review every field and arithmetic check before saving."); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function confirmBills() {
    if (!reviewBills.length) return;
    setBusy("confirm-bills"); setError(""); setNotice("");
    try { const response = await fetch("/api/purchase-bills/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bills: reviewBills.map((bill) => Object.fromEntries(Object.entries(bill).filter(([key]) => key !== "validationErrors"))) }) }); const data = await readResponse<{ saved: number }>(response); setReviewBills([]); setNotice(`Saved ${data.saved} confirmed invoice${data.saved === 1 ? "" : "s"}.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function importTransactions(file?: File) {
    if (!file) return;
    setBusy("transactions"); setError(""); setNotice("");
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/transactions/import", { method: "POST", body: form }); const data = await readResponse<{ imported: number }>(response); setNotice(`Imported ${data.imported} transaction rows. Matching IDs update existing rows safely.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function saveOrder(supplier: string, lines: OrderLine[]) {
    setBusy("order"); setError(""); setNotice("");
    try { const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_name: supplier, supplier_phone: supplierPhone || null, order_date: today, lines }) }); await readResponse(response); setNotice(`Draft order for ${supplier} saved. Review and print it below.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function createKhata(event: React.FormEvent) {
    event.preventDefault(); setBusy("khata"); setError(""); setNotice("");
    try { await readResponse(await fetch("/api/khata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...khataForm, amount: Number(khataForm.amount), due_date: khataForm.due_date || null, note: khataForm.note || null }) })); setKhataForm({ customer_name: "", amount: "", due_date: "", auto_match: true, note: "" }); setNotice("Khata reminder saved."); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function settleKhata(entry: KhataEntry) {
    const outstanding = Number(entry.amount) - Number(entry.paid_amount);
    const amountText = window.prompt(`Outstanding ₹${outstanding.toLocaleString("en-IN")}. Enter the amount collected; leave blank to close the full balance.`);
    if (amountText === null) return;
    const amount = amountText.trim() ? Number(amountText) : null;
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) { setError("Enter a positive payment amount."); return; }
    setBusy("khata"); setError("");
    try { await readResponse(await fetch("/api/khata/settle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_id: entry.id, amount }) })); setNotice("Khata payment recorded."); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault(); if (!question.trim()) return;
    setBusy("ask"); setError(""); setAnswer(null);
    try { setAnswer(await readResponse(await fetch("/api/assistant/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), language }) }))); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/auth"); router.refresh(); }

  const tabs = ["Orders", "Invoices", "Cash flow", "Transactions", "Khata", "Customers", "Ask Disha", "Activity"];
  const totals = forecast.lines.reduce((sum, line) => sum + line.estimated_order_value, 0);
  const groupedForecast = new Map<string, typeof forecast.lines>();
  forecast.lines.forEach((line) => groupedForecast.set(line.supplier_name, [...(groupedForecast.get(line.supplier_name) ?? []), line]));

  return <main className="merchant-workspace">
    <header className="merchant-topbar"><Link className="merchant-brand" href="/">Disha<span>Merchant workspace</span></Link><div className="merchant-account"><span className="live-dot"/>Private store <span className="merchant-role">{role}</span><button type="button" className="merchant-signout" onClick={() => void signOut()}>Sign out</button></div></header>
    <div className="merchant-content">
      <section className="merchant-welcome"><div><p className="merchant-eyebrow">MERCHANT GROWTH</p><h1>{merchantName}</h1><p>Supplier bills become next-order plans. Payment history powers cash flow, Khata and customer insights.</p></div><span className="private-badge">Your data only</span></section>
      {!schemaReady && <section className="merchant-panel schema-warning"><h2>Finish Supabase setup</h2><p>Apply <code>20261115_live_inventory_inputs.sql</code> and <code>20261116_merchant_growth.sql</code> from <code>web/supabase/migrations</code>, then reload.</p></section>}
      {error && <p className="merchant-alert" role="alert">{error}</p>}{notice && <p className="merchant-notice" role="status">{notice}</p>}
      <nav className="merchant-tabs" aria-label="Disha sections">{tabs.map((name) => <button type="button" key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>

      {tab === "Orders" && <>
        <section className="merchant-metrics"><article><span>Invoice history</span><strong>{purchaseBills.length}</strong><small>Supplier bills analyzed</small></article><article><span>Next order estimate</span><strong>₹{totals.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><small>Forecast from completed bill cycles</small></article><article><span>Needs one more bill</span><strong>{forecast.needs_one_more_bill.length}</strong><small>Not enough purchase cycles yet</small></article><article><span>Open order drafts</span><strong>{orders.filter((order) => ["draft","approved","calling","needs_review"].includes(order.status)).length}</strong><small>Merchant reviewed</small></article></section>
        <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PURCHASE HISTORY</p><h2>Predicted next bulk order</h2></div><span className="step-pill">DETERMINISTIC</span></div><p>Forecasts use purchase quantities and dates from confirmed supplier bills. Disha does not infer SKU units from payment amounts or estimate on-hand stock.</p>
          {!forecast.lines.length ? <p className="empty-copy">Add at least two bills for a product to calculate its purchase run rate.</p> : [...groupedForecast.entries()].map(([supplier, lines]) => <div className="forecast-group" key={supplier}><h3>{supplier}</h3><div className="bill-table-wrap"><table><thead><tr><th>Item</th><th>Run rate/day</th><th>Suggested qty</th><th>Est. value</th><th>Order date</th></tr></thead><tbody>{lines.map((line) => <tr key={`${supplier}-${line.item_name}`}><td>{line.item_name}</td><td>{line.run_rate_per_day.toFixed(2)} {line.unit}</td><td>{line.predicted_quantity} {line.unit}</td><td>₹{line.estimated_order_value.toLocaleString("en-IN")}</td><td>{line.next_order_date}</td></tr>)}</tbody></table></div><div className="order-actions"><label>Supplier phone (E.164)<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="+91…" /></label><button className="merchant-primary" type="button" disabled={!canEdit || busy === "order"} onClick={() => void saveOrder(supplier, lines.map((line) => ({ item_name: line.item_name, quantity: line.predicted_quantity, unit: line.unit, unit_price: line.unit_price, line_total: line.estimated_order_value })))}>{busy === "order" ? "Saving…" : "Save order draft"}</button><button className="merchant-secondary" type="button" onClick={() => window.print()}>Print order list</button></div></div>)}
          {!!forecast.needs_one_more_bill.length && <p className="review-note">Needs one more bill: {forecast.needs_one_more_bill.map((item) => `${item.item_name} (${item.supplier_name})`).join(", ")}</p>}{!!forecast.not_reordered_last_cycle.length && <p className="review-note">Not reordered in the latest supplier cycle: {forecast.not_reordered_last_cycle.map((item) => item.item_name).join(", ")}</p>}
        </section>
        <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">DRAFTS</p><h2>Order sheets</h2></div></div>{!orders.length ? <p className="empty-copy">No order drafts yet. Save a supplier forecast to create one.</p> : orders.map((order) => <article className="order-card" key={order.id}><div><strong>{order.supplier_name}</strong><span>{order.status} · {order.order_date ?? "Date not set"}</span></div><b>₹{order.order_total.toLocaleString("en-IN")}</b><button type="button" className="merchant-secondary" onClick={() => window.print()}>Print</button><ul>{order.lines.map((line,index)=><li key={`${line.item_name}-${index}`}>{line.item_name}: {line.quantity} {line.unit} · ₹{line.line_total}</li>)}</ul>{order.seller_confirmation && <p>{order.seller_confirmation}</p>}</article>)}</section>
      </>}

      {tab === "Invoices" && <>
        <div className="merchant-grid"><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">OCR</p><h2>Photograph a supplier bill</h2></div><span className="step-pill">SARVAM VISION</span></div><p>Image or PDF extraction is only a draft. Confirm the supplier, lines and bill total before saving.</p><label className="merchant-upload"><span>{busy === "bill" ? "Reading invoice…" : "Choose invoice photo or PDF"}</span><input type="file" accept="image/png,image/jpeg,application/pdf" capture="environment" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void parsePhoto(event.target.files?.[0])}/></label></section><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">BATCH IMPORT</p><h2>Upload past invoices</h2></div><span className="step-pill">CSV</span></div><p>Import the merchant’s last 2–3 months of supplier bills at once.</p><a className="merchant-template" href="/purchase-bills-template.csv" download>Download supplier invoice CSV template</a><label className="merchant-upload"><span>{busy === "bill" ? "Reading invoice file…" : "Choose supplier CSV"}</span><input type="file" accept=".csv,text/csv" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void previewCsv(event.target.files?.[0])}/></label></section></div>
        {!!reviewBills.length && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">MERCHANT CONFIRMATION</p><h2>Review before saving</h2></div><span className="step-pill">{reviewBills.length} invoices</span></div>{reviewBills.map((bill,index)=><div className="review-bill" key={`${bill.bill_number}-${index}`}><h3>{bill.supplier_name} · {bill.bill_number} · {bill.bill_date}</h3><div className="bill-table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Line total</th></tr></thead><tbody>{bill.items.map((line,i)=><tr key={`${line.name}-${i}`}><td>{line.name}</td><td>{line.quantity}</td><td>{line.unit}</td><td>₹{line.unit_price}</td><td>₹{line.line_total}</td></tr>)}</tbody><tfoot><tr><th colSpan={4}>Bill total</th><th>₹{bill.total_amount}</th></tr></tfoot></table></div>{bill.validationErrors?.length ? <p className="merchant-alert">{bill.validationErrors.join(" ")}</p> : <p className="merchant-notice">Arithmetic checks pass.</p>}</div>)}<button className="merchant-primary" type="button" disabled={!canEdit || Boolean(busy) || reviewBills.some((bill)=>bill.validationErrors?.length)} onClick={()=>void confirmBills()}>{busy === "confirm-bills" ? "Saving confirmed bills…" : "Confirm and save invoices"}</button></section>}
      </>}

      {tab === "Transactions" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">YOUR RECORDS</p><h2>Import transaction history</h2></div><span className="step-pill">CSV</span></div><p>Use your own Paytm/UPI export for now; Disha does not connect to Paytm yet. Names and amounts stay within your merchant workspace.</p><a className="merchant-template" href="/transactions-template.csv" download>Download transaction CSV template</a><label className="merchant-upload"><span>{busy === "transactions" ? "Importing…" : "Choose transaction CSV"}</span><input type="file" accept=".csv,text/csv" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void importTransactions(event.target.files?.[0])}/></label><h3>Recent transactions</h3>{transactions.length ? <div className="bill-table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead><tbody>{transactions.slice(0,100).map((tx)=><tr key={tx.id}><td>{new Date(tx.ts).toLocaleString("en-IN")}</td><td>{tx.customer_name}</td><td>₹{tx.amount.toLocaleString("en-IN")}</td><td>{tx.mode}</td><td>{tx.status}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No merchant transaction records yet.</p>}</section>}

      {tab === "Cash flow" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PURCHASE TIMING</p><h2>Can the next order fit?</h2></div><span className="step-pill">DIGITAL ONLY</span></div><div className="merchant-metrics"><article><span>Digital collections · 28 days</span><strong>₹{cashFlow.digital_collections_28d.toLocaleString("en-IN")}</strong></article><article><span>Average per day</span><strong>₹{cashFlow.average_daily_digital_collections.toLocaleString("en-IN")}</strong></article><article><span>Expected by due date</span><strong>₹{cashFlow.expected_digital_collections.toLocaleString("en-IN")}</strong></article><article><span>Possible cash gap</span><strong>{cashFlow.possible_gap == null ? "—" : `₹${cashFlow.possible_gap.toLocaleString("en-IN")}`}</strong></article></div><p className="review-note">{cashFlow.caveat} This is a conservative timing estimate, not a cash balance or guarantee.</p><p>Estimated next bulk order: ₹{cashFlow.order_total.toLocaleString("en-IN")} · modeled credit period: {cashFlow.credit_days} days.</p></section>}

      {tab === "Khata" && <><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">RECEIVABLES TODO</p><h2>Add a Khata reminder</h2></div><span className="step-pill">OPTIONAL AUTO-MATCH</span></div><form className="khata-form" onSubmit={(event)=>void createKhata(event)}><label>Customer name<input required maxLength={120} value={khataForm.customer_name} onChange={(event)=>setKhataForm({...khataForm,customer_name:event.target.value})} placeholder="Ramesh"/></label><label>Amount owed (₹)<input required type="number" min="0.01" step="0.01" value={khataForm.amount} onChange={(event)=>setKhataForm({...khataForm,amount:event.target.value})} placeholder="500"/></label><label>Due date<input type="date" value={khataForm.due_date} onChange={(event)=>setKhataForm({...khataForm,due_date:event.target.value})}/></label><label>Note<input maxLength={300} value={khataForm.note} onChange={(event)=>setKhataForm({...khataForm,note:event.target.value})} placeholder="Groceries on credit"/></label><label className="checkbox-label"><input type="checkbox" checked={khataForm.auto_match} onChange={(event)=>setKhataForm({...khataForm,auto_match:event.target.checked})}/> Auto-match later successful transactions</label><button className="merchant-primary" disabled={!schemaReady || !canEdit || Boolean(busy)}>{busy === "khata" ? "Saving…" : "Add to Khata"}</button></form><p className="review-note">Auto-match uses exact customer names and successful transactions recorded after the Khata entry is created. If disabled, no transaction is matched automatically.</p></section><section className="merchant-panel"><h2>Open Khata</h2>{khata.filter((entry)=>entry.status!=="closed").length ? khata.filter((entry)=>entry.status!=="closed").map((entry)=><article className="khata-row" key={entry.id}><div><strong>{entry.customer_name}</strong><span>Due {entry.due_date ?? "date not set"} · {entry.status}{entry.auto_match ? " · auto-match on" : ""}</span>{entry.note&&<small>{entry.note}</small>}</div><b>₹{(entry.amount-entry.paid_amount).toLocaleString("en-IN")} remaining</b><button className="merchant-secondary" type="button" disabled={!canEdit||Boolean(busy)} onClick={()=>void settleKhata(entry)}>Record payment</button></article>) : <p className="empty-copy">No open Khata reminders.</p>}</section><section className="merchant-panel"><h2>Closed Khata</h2>{khata.filter((entry)=>entry.status==="closed").length ? khata.filter((entry)=>entry.status==="closed").map((entry)=><article className="khata-row" key={entry.id}><div><strong>{entry.customer_name}</strong><span>Closed {entry.closed_at ? new Date(entry.closed_at).toLocaleDateString("en-IN") : ""}</span></div><b>₹{entry.amount.toLocaleString("en-IN")}</b></article>) : <p className="empty-copy">Closed entries will be kept here for maintenance.</p>}</section></>}

      {tab === "Customers" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PAYMENT FREQUENCY</p><h2>Customer rhythm</h2></div><span className="step-pill">INFERRED</span></div><p>Frequency uses distinct dates with successful transactions. A 1.5× median-gap flag is a prompt to review, not a claim that the customer is lost.</p>{customers.length ? <div className="bill-table-wrap"><table><thead><tr><th>Customer</th><th>Payment days</th><th>Typical gap</th><th>Last payment</th><th>Elapsed / typical</th><th>Signal</th></tr></thead><tbody>{customers.map((customer)=><tr key={customer.customer_name}><td>{customer.customer_name}</td><td>{customer.payment_days}</td><td>{customer.median_gap_days} days</td><td>{customer.last_payment_date}</td><td>{customer.ratio_to_typical_gap.toFixed(2)}×</td><td>{customer.potentially_at_risk ? "Review" : "Usual range"}</td></tr>)}</tbody></table></div> : <p className="empty-copy">Add transaction history with at least three payment dates per customer to see frequency.</p>}</section>}

      {tab === "Ask Disha" && <section className="merchant-panel ask-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">VOICE AND DATA ASSISTANT</p><h2>Ask about your records</h2></div><span className="step-pill">OPENROUTER TOOLS</span></div><p>Try “Did Ramesh pay me?”, “What should I order next month?”, “What are my collections?” or “Who is paying less often?”</p><form className="merchant-ask-form" onSubmit={(event)=>void ask(event)}><input value={question} onChange={(event)=>setQuestion(event.target.value)} maxLength={600} placeholder={language==="te"?"మీ చెల్లింపుల గురించి అడగండి":"Ask about payment or supplier purchase records"}/><select aria-label="Answer language" value={language} onChange={(event)=>setLanguage(event.target.value as "en"|"te")}><option value="en">English</option><option value="te">తెలుగు</option></select><button className="merchant-primary" disabled={!schemaReady||!question.trim()||Boolean(busy)}>{busy==="ask"?"Checking records…":"Ask Disha"}</button></form>{answer&&<div className="assistant-answer"><p>{answer.answer}</p><small>Tools used: {answer.usedTools.join(", ")||"none"}{answer.fallbackUsed?" · verified fallback":""}</small><NarrationPlayer text={answer.answer} language={language}/></div>}<p className="review-note">Voice input and spoken responses use Sarvam when configured. Typed questions remain available if speech services are unavailable.</p></section>}

      {tab === "Activity" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">WORKSPACE HISTORY</p><h2>Recent activity</h2></div><span className="step-pill">AUDIT LOG</span></div>{audit.length ? <div className="bill-table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Decision</th><th>Outcome</th></tr></thead><tbody>{audit.map((event)=><tr key={event.id}><td>{new Date(event.created_at).toLocaleString("en-IN")}</td><td>{event.tool}</td><td>{event.decision}</td><td>{event.outcome??"—"}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No workspace activity has been recorded yet.</p>}</section>}
    </div>
  </main>;
}
