"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NarrationPlayer } from "@/components/narration-player";
import { createClient } from "@/lib/supabase/client";
import { suggestSuppliers, validatePurchaseBill, type PurchaseBill, type PurchaseForecastResult } from "@/lib/merchant/purchase-forecast";
import type { CustomerFrequency, KhataEntry, MerchantTransaction } from "@/lib/merchant/financials";

type CashFlow = ReturnType<typeof import("@/lib/merchant/financials").projectCashFlow>;
type OrderLine = { item_name: string; quantity: number; unit: string; unit_price: number; line_total: number };
type Order = { id: string; supplier_name: string; supplier_phone: string | null; order_date: string | null; status: string; order_total: number; call_status: string | null; seller_confirmation: string | null; created_at: string; lines: OrderLine[] };
type Audit = { id: number; created_at: string; actor: string; tool: string; decision: string; outcome: string | null; facts: unknown };
type GstObligation = { id:string; tax_period:string; amount:number; paid_amount:number; due_date:string; payment_reference:string|null; note:string|null; status:"due"|"partially_paid"|"paid"; created_at:string; paid_at:string|null };
type Props = { merchantName: string; schemaReady: boolean; gstReady:boolean; gstObligations:GstObligation[]; demoData: boolean; initialTab?: string; role: string; supplierCallMode: "live" | "stub"; purchaseBills: PurchaseBill[]; forecast: PurchaseForecastResult; transactions: MerchantTransaction[]; cashFlow: CashFlow; khata: KhataEntry[]; orders: Order[]; customers: CustomerFrequency[]; aliases: Array<{customer_name:string;alias:string}>; audit: Audit[] };
type EditableBill = PurchaseBill & { source: "csv" | "sarvam_vision" | "openrouter_vision"; source_file_name?: string; validationErrors?: string[] };

async function encodeWav16k(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.ceil(decoded.duration * 16000);
    const offline = new OfflineAudioContext(1, frames, 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const audio = await offline.startRendering();
    const pcm = audio.getChannelData(0);
    const buffer = new ArrayBuffer(44 + pcm.length * 2); const view = new DataView(buffer);
    const write = (offset:number,value:string)=>Array.from(value).forEach((char,index)=>view.setUint8(offset+index,char.charCodeAt(0)));
    write(0,"RIFF");view.setUint32(4,36+pcm.length*2,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,16000,true);view.setUint32(28,32000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,pcm.length*2,true);
    for(let i=0;i<pcm.length;i+=1){const sample=Math.max(-1,Math.min(1,pcm[i]!));view.setInt16(44+i*2,sample<0?sample*0x8000:sample*0x7fff,true);}
    return new Blob([buffer],{type:"audio/wav"});
  } finally { await context.close(); }
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "The request failed. Try again.");
  return data as T;
}

export function MerchantWorkspace(props: Props) {
  const { merchantName, schemaReady, gstReady, gstObligations, demoData, role, supplierCallMode, purchaseBills, forecast, transactions, cashFlow, khata, orders, customers, aliases, audit } = props;
  const router = useRouter();
  const [tab, setTab] = useState(props.initialTab ?? "Orders");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewBills, setReviewBills] = useState<EditableBill[]>([]);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState<"en" | "te">("en");
  const [answer, setAnswer] = useState<{ answer: string; usedTools: string[]; fallbackUsed: boolean } | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [khataForm, setKhataForm] = useState({ customer_name: "", amount: "", due_date: "", contact_phone: "", auto_match: true, note: "" });
  const [aliasForm,setAliasForm]=useState({customer_name:"",alias:""});
  const [gstForm,setGstForm]=useState({tax_period:"",amount:"",due_date:"",note:""});
  const [editQuantities,setEditQuantities]=useState<Record<string,string>>({});
  const canEdit = role === "owner" || role === "manager";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const supplierRecommendations = suggestSuppliers(purchaseBills, forecast);

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
  function editInvoice(index:number,patch:Partial<EditableBill>){setReviewBills((current)=>current.map((bill,i)=>{if(i!==index)return bill;const next={...bill,...patch};delete next.validationErrors;return {...next,validationErrors:validatePurchaseBill(next)};}));}
  function editInvoiceLine(billIndex:number,lineIndex:number,field:"name"|"quantity"|"unit"|"unit_price"|"line_total",value:string){setReviewBills((current)=>current.map((bill,index)=>{if(index!==billIndex)return bill;const items=bill.items.map((line,i)=>{if(i!==lineIndex)return line;const updated={...line,[field]:field==="name"||field==="unit"?value:Number(value)};if(field==="quantity"||field==="unit_price")updated.line_total=Math.round(updated.quantity*updated.unit_price*100)/100;return updated;});const next={...bill,items,total_amount:Math.round(items.reduce((sum,line)=>sum+line.line_total,0)*100)/100};delete next.validationErrors;return {...next,validationErrors:validatePurchaseBill(next)};}));}
  async function importTransactions(file?: File) {
    if (!file) return;
    setBusy("transactions"); setError(""); setNotice("");
    try { const form = new FormData(); form.set("file", file); const response = await fetch("/api/transactions/import", { method: "POST", body: form }); const data = await readResponse<{ imported: number }>(response); setNotice(`Imported ${data.imported} transaction rows. Matching IDs update existing rows safely.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function saveOrder(supplier: string, lines: OrderLine[]) {
    setBusy("order"); setError(""); setNotice("");
    try { const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier_name: supplier, supplier_phone: supplierPhone || null, order_date: today, lines:lines.map((line)=>Object.fromEntries(Object.entries(line).filter(([key])=>key!=="line_total"))) }) }); await readResponse(response); setNotice(`Draft order for ${supplier} saved. Review and print it below.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function approveOrder(id: string) {
    setBusy("order"); setError(""); setNotice("");
    try { await readResponse(await fetch(`/api/orders/${id}/approve`, { method: "POST" })); setNotice("Order approved. Disha will call only after you choose Call supplier."); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function callSupplier(id: string) {
    const prompt = supplierCallMode === "stub"
      ? "Run the supplier-call demo stub? No call will be placed and no supplier will be contacted."
      : "Call the supplier now and read this approved order?";
    if (!window.confirm(prompt)) return;
    setBusy("order"); setError(""); setNotice("");
    try {
      const result = await readResponse<{status:string}>(await fetch(`/api/orders/${id}/call`, { method: "POST" }));
      setNotice(result.status === "demo_stub" ? "Demo call attempt recorded. No supplier was contacted; the order remains approved." : "Supplier call started. Listen to the result and record the seller’s exact confirmation below.");
      router.refresh();
    }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function recordCallResult(id: string, result: "placed" | "needs_review" | "cancelled") {
    const confirmation = window.prompt("What did the seller say? Include any changed quantity or price so you can review it.");
    if (confirmation === null) return;
    if (result !== "cancelled" && !confirmation.trim()) {
      setError("Enter the seller’s confirmation before recording this outcome.");
      return;
    }
    setBusy("order"); setError("");
    try { await readResponse(await fetch(`/api/orders/${id}/result`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ result, confirmation }) })); setNotice(result === "placed" ? "Seller-confirmed order marked placed." : `Order marked ${result.replaceAll("_", " ")}.`); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function createKhata(event: React.FormEvent) {
    event.preventDefault(); setBusy("khata"); setError(""); setNotice("");
    try { await readResponse(await fetch("/api/khata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...khataForm, amount: Number(khataForm.amount), due_date: khataForm.due_date || null, contact_phone: khataForm.contact_phone || null, note: khataForm.note || null }) })); setKhataForm({ customer_name: "", amount: "", due_date: "", contact_phone: "", auto_match: true, note: "" }); setNotice("Khata reminder saved."); router.refresh(); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function saveAlias(event:React.FormEvent){event.preventDefault();setBusy("alias");setError("");setNotice("");try{await readResponse(await fetch("/api/customers/aliases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(aliasForm)}));setAliasForm({customer_name:"",alias:""});setNotice("Customer name alias saved for matching transaction records.");router.refresh();}catch(cause){fail(cause);}finally{setBusy("");}}
  async function createGstObligation(event:React.FormEvent){event.preventDefault();setBusy("gst");setError("");setNotice("");try{await readResponse(await fetch("/api/gst",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tax_period:gstForm.tax_period,amount:Number(gstForm.amount),due_date:gstForm.due_date,note:gstForm.note||null})}));setGstForm({tax_period:"",amount:"",due_date:"",note:""});setNotice("GST due saved. Disha will show the due date in this tracker.");router.refresh();}catch(cause){fail(cause);}finally{setBusy("");}}
  async function recordGstPayment(item:GstObligation){const remaining=item.amount-item.paid_amount;const raw=window.prompt(`Record a GST payment against ${item.tax_period}. Remaining ₹${remaining.toLocaleString("en-IN")}. Enter amount paid, or leave blank to mark the balance paid.`);if(raw===null)return;const amount=raw.trim()?Number(raw):null;if(amount!==null&&(!Number.isFinite(amount)||amount<=0||amount>remaining)){setError("Enter an amount up to the remaining GST balance.");return;}const reference=window.prompt("Optional bank / challan reference (Disha does not submit payment):")??"";setBusy("gst");setError("");try{await readResponse(await fetch("/api/gst/payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,amount,reference:reference||null})}));setNotice("GST payment record updated. Verify the payment in your bank or tax portal.");router.refresh();}catch(cause){fail(cause);}finally{setBusy("");}}
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
  function reminderText(entry: KhataEntry) {
    const outstanding = Number(entry.amount) - Number(entry.paid_amount);
    return `Namaste ${entry.customer_name}, this is a friendly reminder from ${merchantName} about your Khata balance of ₹${outstanding.toLocaleString("en-IN")}${entry.due_date ? `, due on ${entry.due_date}` : ""}. Please let us know when convenient. Thank you.`;
  }
  async function copyReminder(entry: KhataEntry) {
    try { await navigator.clipboard.writeText(reminderText(entry)); setNotice(`Reminder for ${entry.customer_name} copied. Review it before sending.`); }
    catch { setError("Could not copy the reminder. Select and copy the message shown on the Khata entry."); }
  }
  function renderKhataEntry(entry: KhataEntry) {
    const overdue = Boolean(entry.due_date && entry.due_date < today);
    const message = reminderText(entry);
    return <article className="khata-row" key={entry.id}>
      <div><strong>{entry.customer_name} {overdue && <span className="khata-overdue">OVERDUE</span>}</strong><span>Due {entry.due_date ?? "date not set"} · {entry.status}{entry.auto_match ? " · auto-match on" : ""}{entry.contact_phone ? ` · ${entry.contact_phone}` : " · no phone saved"}</span>{entry.note&&<small>{entry.note}</small>}{overdue&&<small className="khata-reminder-copy">{message}</small>}</div>
      <b>₹{(entry.amount-entry.paid_amount).toLocaleString("en-IN")} remaining</b>
      <div className="khata-actions"><button className="merchant-secondary" type="button" disabled={!canEdit||Boolean(busy)} onClick={()=>void settleKhata(entry)}>Record payment</button>{overdue&&canEdit&&(entry.contact_phone ? <a className="merchant-primary" href={`https://wa.me/${entry.contact_phone.replace(/\D/g,"")}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Review WhatsApp reminder</a> : <button className="merchant-secondary" type="button" onClick={()=>void copyReminder(entry)}>Copy reminder</button>)}</div>
    </article>;
  }
  async function ask(event: React.FormEvent) {
    event.preventDefault(); if (!question.trim()) return;
    setBusy("ask"); setError(""); setAnswer(null);
    try { setAnswer(await readResponse(await fetch("/api/assistant/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), language }) }))); }
    catch (cause) { fail(cause); } finally { setBusy(""); }
  }
  async function startRecording() {
    setError(""); setNotice("");
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);const chunks:BlobPart[]=[];mediaRef.current=recorder;
      recorder.ondataavailable=(event)=>{if(event.data.size)chunks.push(event.data);};
      recorder.onerror=()=>{stream.getTracks().forEach((track)=>track.stop());setRecording(false);setError("The microphone recording failed. Type your question instead.");};
      recorder.onstop=async()=>{
        stream.getTracks().forEach((track)=>track.stop());setRecording(false);setTranscribing(true);
        try{const wav=await encodeWav16k(new Blob(chunks,{type:recorder.mimeType}));const form=new FormData();form.set("file",wav,"question.wav");const result=await readResponse<{transcript:string;languageCode:string|null}>(await fetch("/api/voice/stt",{method:"POST",body:form}));setQuestion(result.transcript);if(result.languageCode?.startsWith("te"))setLanguage("te");setNotice("Voice question transcribed. Review the text, then ask Disha.");}
        catch(cause){fail(cause);}finally{setTranscribing(false);}
      };
      recorder.start();setRecording(true);window.setTimeout(()=>{if(recorder.state==="recording")recorder.stop();},30000);
    }catch(cause){fail(cause);}
  }
  function stopRecording(){if(mediaRef.current?.state==="recording")mediaRef.current.stop();}
  async function signOut() { const supabase = createClient(); await supabase.auth.signOut(); router.replace("/auth"); router.refresh(); }

  const tabs = ["Orders", "Invoices", "Cash flow", "Transactions", "Khata", "GST", "Customers", "Ask Disha", "Activity"];
  const totals = forecast.lines.reduce((sum, line) => sum + line.estimated_order_value, 0);
  const groupedForecast = new Map<string, typeof forecast.lines>();
  forecast.lines.forEach((line) => groupedForecast.set(line.supplier_name, [...(groupedForecast.get(line.supplier_name) ?? []), line]));

  return <main className="merchant-workspace">
    <header className="merchant-topbar"><Link className="merchant-brand" href="/">Disha<span>Merchant workspace</span></Link><div className="merchant-account"><span className="live-dot"/>Private store <span className="merchant-role">{role}</span><button type="button" className="merchant-signout" onClick={() => void signOut()}>Sign out</button></div></header>
    {demoData && <div className="demo-data-banner"><strong>DEMO DATA</strong><span>Illustrative sample records are loaded in this workspace. They are not your business data. Remove demo rows before using this workspace for real bookkeeping.</span></div>}
    <div className="merchant-content">
      <section className="merchant-welcome"><div><p className="merchant-eyebrow">MERCHANT GROWTH</p><h1>{merchantName}</h1><p>Supplier bills become next-order plans. Payment history powers cash flow, Khata and customer insights.</p></div><span className="private-badge">Your data only</span></section>
      {!schemaReady && <section className="merchant-panel schema-warning"><h2>Finish Supabase setup</h2><p>Apply <code>20261115_live_inventory_inputs.sql</code> and <code>20261116_merchant_growth.sql</code> from <code>web/supabase/migrations</code>, then reload.</p></section>}
      {error && <p className="merchant-alert" role="alert">{error}</p>}{notice && <p className="merchant-notice" role="status">{notice}</p>}
      <nav className="merchant-tabs" aria-label="Disha sections">{tabs.map((name) => <button type="button" key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>)}</nav>

      {tab === "Orders" && <>
        <section className="merchant-metrics"><article><span>Invoice history</span><strong>{purchaseBills.length}</strong><small>Supplier bills analyzed</small></article><article><span>Next order estimate</span><strong>₹{totals.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong><small>Forecast from completed bill cycles</small></article><article><span>Needs one more bill</span><strong>{forecast.needs_one_more_bill.length}</strong><small>Not enough purchase cycles yet</small></article><article><span>Open order drafts</span><strong>{orders.filter((order) => ["draft","approved","calling","needs_review"].includes(order.status)).length}</strong><small>Merchant reviewed</small></article></section>
        <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">SUPPLIER CALLING</p><h2>{supplierCallMode === "stub" ? "Demo call stub" : "Live supplier calls"}</h2></div><span className="step-pill">{supplierCallMode === "stub" ? "NO CALL PLACED" : "LIVEKIT"}</span></div><p>{supplierCallMode === "stub" ? "The demo records an approved call attempt only. It does not dial or contact your supplier, and it leaves the order approved." : "Disha calls only after approval. Seller changes require your review before the order can be placed."}</p></section>
        <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PURCHASE HISTORY</p><h2>Predicted next bulk order</h2></div><span className="step-pill">DETERMINISTIC</span></div><p>Forecasts use purchase quantities and dates from confirmed supplier bills. Disha does not infer SKU units from payment amounts or estimate on-hand stock.</p>
          {!!supplierRecommendations.length && <div className="supplier-recommendations"><h3>Supplier suggestions from your bills</h3><p>Recent prices from suppliers you have already used. These are price-history suggestions, not live quotes or availability checks.</p><div className="supplier-suggestion-list">{supplierRecommendations.map((suggestion)=><article key={`${suggestion.item_name}-${suggestion.unit}`}><strong>{suggestion.item_name}</strong><span>{suggestion.supplier_name} · ₹{suggestion.latest_rate.toLocaleString("en-IN")}/{suggestion.unit}</span><small>Last seen {suggestion.bill_date} · {suggestion.suppliers_compared} supplier{suggestion.suppliers_compared===1?"":"s"} compared</small></article>)}</div></div>}
          {!forecast.lines.length ? <p className="empty-copy">Add at least two bills for a product to calculate its purchase run rate.</p> : [...groupedForecast.entries()].map(([supplier, lines]) => <div className="forecast-group" key={supplier}><h3>{supplier}</h3><div className="bill-table-wrap"><table><thead><tr><th>Item</th><th>Run rate/day</th><th>Suggested qty (editable)</th><th>Est. value</th><th>Order date</th></tr></thead><tbody>{lines.map((line) => {const key=`${supplier}::${line.item_name}`;const quantity=Number(editQuantities[key]??line.predicted_quantity);return <tr key={`${supplier}-${line.item_name}`}><td>{line.item_name}</td><td>{line.run_rate_per_day.toFixed(2)} {line.unit}</td><td><input className="quantity-edit" type="number" min="0.001" step="0.001" value={editQuantities[key]??line.predicted_quantity} disabled={!canEdit} onChange={(event)=>setEditQuantities((current)=>({...current,[key]:event.target.value}))}/>{line.unit}</td><td>₹{(quantity*line.unit_price).toLocaleString("en-IN")}</td><td>{line.next_order_date}</td></tr>;})}</tbody></table></div><div className="order-actions"><label>Supplier phone (E.164)<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="+91…" /></label><button className="merchant-primary" type="button" disabled={!canEdit || busy === "order" || lines.some((line)=>!(Number(editQuantities[`${supplier}::${line.item_name}`]??line.predicted_quantity)>0))} onClick={() => void saveOrder(supplier, lines.map((line) => {const quantity=Number(editQuantities[`${supplier}::${line.item_name}`]??line.predicted_quantity);return { item_name: line.item_name, quantity, unit: line.unit, unit_price: line.unit_price, line_total: Math.round(quantity*line.unit_price*100)/100 };}))}>{busy === "order" ? "Saving…" : "Save order draft"}</button><button className="merchant-secondary" type="button" onClick={() => window.print()}>Print order list</button></div></div>)}
          {!!forecast.needs_one_more_bill.length && <p className="review-note">Needs one more bill: {forecast.needs_one_more_bill.map((item) => `${item.item_name} (${item.supplier_name})`).join(", ")}</p>}{!!forecast.not_reordered_last_cycle.length && <p className="review-note">Not reordered in the latest supplier cycle: {forecast.not_reordered_last_cycle.map((item) => item.item_name).join(", ")}</p>}
        </section>
        <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">DRAFTS</p><h2>Order sheets</h2></div></div>{!orders.length ? <p className="empty-copy">No order drafts yet. Save a supplier forecast to create one.</p> : orders.map((order) => <article className="order-card" key={order.id}><div><strong>{order.supplier_name}</strong><span>{order.status} · {order.order_date ?? "Date not set"} · {order.supplier_phone ?? "No phone"}</span></div><b>₹{order.order_total.toLocaleString("en-IN")}</b><button type="button" className="merchant-secondary" onClick={() => window.print()}>Print</button><ul>{order.lines.map((line,index)=><li key={`${line.item_name}-${index}`}>{line.item_name}: {line.quantity} {line.unit} · ₹{line.line_total}</li>)}</ul>{order.status === "draft" && canEdit && <button type="button" className="merchant-primary" disabled={Boolean(busy)} onClick={()=>void approveOrder(order.id)}>Approve this order</button>}{order.status === "approved" && canEdit && <button type="button" className="merchant-primary" disabled={!order.supplier_phone||Boolean(busy)} onClick={()=>void callSupplier(order.id)}>{supplierCallMode === "stub" ? "Run call demo stub" : "Call supplier"}</button>}{order.status === "calling" && canEdit && <div className="order-actions"><button type="button" className="merchant-primary" disabled={Boolean(busy)} onClick={()=>void recordCallResult(order.id,"placed")}>Seller confirmed · mark placed</button><button type="button" className="merchant-secondary" disabled={Boolean(busy)} onClick={()=>void recordCallResult(order.id,"needs_review")}>Seller changed terms · review</button><button type="button" className="merchant-secondary" disabled={Boolean(busy)} onClick={()=>void recordCallResult(order.id,"cancelled")}>Not placed</button></div>}{order.seller_confirmation && <p>{order.seller_confirmation}</p>}</article>)}</section>
      </>}

      {tab === "Invoices" && <>
        <div className="merchant-grid"><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">OCR</p><h2>Photograph a supplier bill</h2></div><span className="step-pill">SARVAM VISION</span></div><p>Image or PDF extraction is only a draft. Confirm the supplier, lines and bill total before saving.</p><label className="merchant-upload"><span>{busy === "bill" ? "Reading invoice…" : "Choose invoice photo or PDF"}</span><input type="file" accept="image/png,image/jpeg,application/pdf" capture="environment" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void parsePhoto(event.target.files?.[0])}/></label></section><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">BATCH IMPORT</p><h2>Upload past invoices</h2></div><span className="step-pill">CSV</span></div><p>Import the merchant’s last 2–3 months of supplier bills at once.</p><a className="merchant-template" href="/purchase-bills-template.csv" download>Download supplier invoice CSV template</a><label className="merchant-upload"><span>{busy === "bill" ? "Reading invoice file…" : "Choose supplier CSV"}</span><input type="file" accept=".csv,text/csv" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void previewCsv(event.target.files?.[0])}/></label></section></div>
        {!!reviewBills.length && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">MERCHANT CONFIRMATION</p><h2>Review before saving</h2></div><span className="step-pill">{reviewBills.length} invoices</span></div>{reviewBills.map((bill,index)=><div className="review-bill" key={`${bill.bill_number}-${index}`}><div className="invoice-edit-fields"><label>Supplier<input value={bill.supplier_name} onChange={(event)=>editInvoice(index,{supplier_name:event.target.value})}/></label><label>Bill number<input value={bill.bill_number} onChange={(event)=>editInvoice(index,{bill_number:event.target.value})}/></label><label>Date<input type="date" value={bill.bill_date} onChange={(event)=>editInvoice(index,{bill_date:event.target.value})}/></label><label>Credit days<input type="number" min="0" max="365" value={bill.credit_days} onChange={(event)=>editInvoice(index,{credit_days:Number(event.target.value)})}/></label></div><h3>Invoice total ₹{bill.total_amount}</h3><div className="bill-table-wrap"><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Line total</th><th></th></tr></thead><tbody>{bill.items.map((line,i)=><tr key={`${line.name}-${i}`}><td><input value={line.name} onChange={(event)=>editInvoiceLine(index,i,"name",event.target.value)}/></td><td><input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event)=>editInvoiceLine(index,i,"quantity",event.target.value)}/></td><td><input value={line.unit} onChange={(event)=>editInvoiceLine(index,i,"unit",event.target.value)}/></td><td><input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event)=>editInvoiceLine(index,i,"unit_price",event.target.value)}/></td><td><input type="number" min="0" step="0.01" value={line.line_total} onChange={(event)=>editInvoiceLine(index,i,"line_total",event.target.value)}/></td><td><button className="row-remove" type="button" onClick={()=>{const items=bill.items.filter((_,lineIndex)=>lineIndex!==i);editInvoice(index,{items,total_amount:items.reduce((sum,item)=>sum+item.line_total,0)});}}>Remove</button></td></tr>)}</tbody></table></div><button className="merchant-secondary" type="button" onClick={()=>{const items=[...bill.items,{name:"",quantity:1,unit:"unit",unit_price:0,line_total:0}];editInvoice(index,{items});}}>Add invoice line</button>{bill.validationErrors?.length ? <p className="merchant-alert">{bill.validationErrors.join(" ")}</p> : <p className="merchant-notice">Arithmetic checks pass.</p>}</div>)}<button className="merchant-primary" type="button" disabled={!canEdit || Boolean(busy) || reviewBills.some((bill)=>bill.validationErrors?.length)} onClick={()=>void confirmBills()}>{busy === "confirm-bills" ? "Saving confirmed bills…" : "Confirm and save invoices"}</button></section>}
      </>}

      {tab === "Transactions" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">YOUR RECORDS</p><h2>Import transaction history</h2></div><span className="step-pill">CSV</span></div><p>Use your own Paytm/UPI export for now; Disha does not connect to Paytm yet. Names and amounts stay within your merchant workspace.</p><a className="merchant-template" href="/transactions-template.csv" download>Download transaction CSV template</a><label className="merchant-upload"><span>{busy === "transactions" ? "Importing…" : "Choose transaction CSV"}</span><input type="file" accept=".csv,text/csv" disabled={!schemaReady || !canEdit || Boolean(busy)} onChange={(event)=>void importTransactions(event.target.files?.[0])}/></label><h3>Recent transactions</h3>{transactions.length ? <div className="bill-table-wrap"><table><thead><tr><th>When</th><th>Customer</th><th>Amount</th><th>Mode</th><th>Status</th></tr></thead><tbody>{transactions.slice(0,100).map((tx)=><tr key={tx.id}><td>{new Date(tx.ts).toLocaleString("en-IN")}</td><td>{tx.customer_name}</td><td>₹{tx.amount.toLocaleString("en-IN")}</td><td>{tx.mode}</td><td>{tx.status}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No merchant transaction records yet.</p>}</section>}

      {tab === "Cash flow" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PURCHASE TIMING</p><h2>Can the next order fit?</h2></div><span className="step-pill">DIGITAL ONLY</span></div><div className="merchant-metrics"><article><span>Digital collections · 28 days</span><strong>₹{cashFlow.digital_collections_28d.toLocaleString("en-IN")}</strong></article><article><span>Average per day</span><strong>₹{cashFlow.average_daily_digital_collections.toLocaleString("en-IN")}</strong></article><article><span>Expected by due date</span><strong>₹{cashFlow.expected_digital_collections.toLocaleString("en-IN")}</strong></article><article><span>Possible cash gap</span><strong>{cashFlow.possible_gap == null ? "—" : `₹${cashFlow.possible_gap.toLocaleString("en-IN")}`}</strong></article></div><p className="review-note">{cashFlow.caveat} This is a conservative timing estimate, not a cash balance or guarantee.</p><p>Estimated next bulk order: ₹{cashFlow.order_total.toLocaleString("en-IN")} · modeled credit period: {cashFlow.credit_days} days.</p></section>}

      {tab === "Khata" && <><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">RECEIVABLES TODO</p><h2>Add a Khata reminder</h2></div><span className="step-pill">OPTIONAL AUTO-MATCH</span></div><form className="khata-form" onSubmit={(event)=>void createKhata(event)}><label>Customer name<input required maxLength={120} value={khataForm.customer_name} onChange={(event)=>setKhataForm({...khataForm,customer_name:event.target.value})} placeholder="Ramesh"/></label><label>Amount owed (₹)<input required type="number" min="0.01" step="0.01" value={khataForm.amount} onChange={(event)=>setKhataForm({...khataForm,amount:event.target.value})} placeholder="500"/></label><label>Due date<input type="date" value={khataForm.due_date} onChange={(event)=>setKhataForm({...khataForm,due_date:event.target.value})}/></label><label>Contact number (E.164, optional)<input type="tel" pattern="\\+[1-9][0-9]{7,14}" value={khataForm.contact_phone} onChange={(event)=>setKhataForm({...khataForm,contact_phone:event.target.value})} placeholder="+919876543210"/></label><label>Note<input maxLength={300} value={khataForm.note} onChange={(event)=>setKhataForm({...khataForm,note:event.target.value})} placeholder="Groceries on credit"/></label><label className="checkbox-label"><input type="checkbox" checked={khataForm.auto_match} onChange={(event)=>setKhataForm({...khataForm,auto_match:event.target.checked})}/> Auto-match later successful transactions</label><button className="merchant-primary" disabled={!schemaReady || !canEdit || Boolean(busy)}>{busy === "khata" ? "Saving…" : "Add to Khata"}</button></form><p className="review-note">Overdue entries get a prefilled WhatsApp draft when a number is saved, or a copyable message otherwise. Disha never sends it automatically. Auto-match uses exact customer names and successful transactions recorded after the Khata entry is created.</p></section><section className="merchant-panel"><h2>Open Khata</h2>{khata.filter((entry)=>entry.status!=="closed").length ? khata.filter((entry)=>entry.status!=="closed").map((entry)=>renderKhataEntry(entry)) : <p className="empty-copy">No open Khata reminders.</p>}</section><section className="merchant-panel"><h2>Closed Khata</h2>{khata.filter((entry)=>entry.status==="closed").length ? khata.filter((entry)=>entry.status==="closed").map((entry)=><article className="khata-row" key={entry.id}><div><strong>{entry.customer_name}</strong><span>Closed {entry.closed_at ? new Date(entry.closed_at).toLocaleDateString("en-IN") : ""}</span></div><b>₹{entry.amount.toLocaleString("en-IN")}</b></article>) : <p className="empty-copy">Closed entries will be kept here for maintenance.</p>}</section></>}

      {tab === "GST" && <><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">TAX DUE REMINDERS</p><h2>Track a GST payment</h2></div><span className="step-pill">MERCHANT ENTERED</span></div><p>Record the amount and due date from your GST advisor or portal. Disha tracks deadlines and what you mark as paid; it does not calculate GST, file a return or submit a payment.</p>{!gstReady&&<p className="merchant-alert">Apply migration 122 to enable GST tracking.</p>}<form className="khata-form" onSubmit={(event)=>void createGstObligation(event)}><label>Tax period<input required maxLength={32} value={gstForm.tax_period} onChange={(event)=>setGstForm({...gstForm,tax_period:event.target.value})} placeholder="Oct 2026"/></label><label>Amount due (₹)<input required type="number" min="0.01" step="0.01" value={gstForm.amount} onChange={(event)=>setGstForm({...gstForm,amount:event.target.value})} placeholder="5000"/></label><label>Due date<input required type="date" value={gstForm.due_date} onChange={(event)=>setGstForm({...gstForm,due_date:event.target.value})}/></label><label>Note (optional)<input maxLength={300} value={gstForm.note} onChange={(event)=>setGstForm({...gstForm,note:event.target.value})} placeholder="Reference from GST portal"/></label><button className="merchant-primary" disabled={!gstReady||!canEdit||Boolean(busy)}>{busy==="gst"?"Saving…":"Add GST due"}</button></form></section><section className="merchant-panel"><h2>Unpaid GST records</h2>{gstObligations.filter((item)=>item.status!=="paid").length?gstObligations.filter((item)=>item.status!=="paid").map((item)=>{const overdue=item.due_date<today;return <article className="khata-row" key={item.id}><div><strong>{item.tax_period} {overdue&&<span className="khata-overdue">OVERDUE</span>}</strong><span>Due {item.due_date} · {item.status}</span>{item.note&&<small>{item.note}</small>}</div><b>₹{(item.amount-item.paid_amount).toLocaleString("en-IN")} remaining</b><button className="merchant-secondary" type="button" disabled={!canEdit||Boolean(busy)} onClick={()=>void recordGstPayment(item)}>Record payment</button></article>}) : <p className="empty-copy">No unpaid GST entries.</p>}</section><section className="merchant-panel"><h2>Paid GST records</h2>{gstObligations.filter((item)=>item.status==="paid").length?gstObligations.filter((item)=>item.status==="paid").map((item)=><article className="khata-row" key={item.id}><div><strong>{item.tax_period}</strong><span>Paid {item.paid_at?new Date(item.paid_at).toLocaleDateString("en-IN"):""}{item.payment_reference?` · ${item.payment_reference}`:""}</span></div><b>₹{item.amount.toLocaleString("en-IN")}</b></article>) : <p className="empty-copy">Completed GST payment records will appear here.</p>}</section></>}

      {tab === "Customers" && <><section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">PAYMENT FREQUENCY</p><h2>Customer rhythm</h2></div><span className="step-pill">INFERRED</span></div><p>Frequency uses distinct dates with successful transactions. A 1.5× median-gap flag is a prompt to review, not a claim that the customer is lost.</p>{customers.length ? <div className="bill-table-wrap"><table><thead><tr><th>Customer</th><th>Payment days</th><th>Typical gap</th><th>Last payment</th><th>Elapsed / typical</th><th>Signal</th></tr></thead><tbody>{customers.map((customer)=><tr key={customer.customer_name}><td>{customer.customer_name}</td><td>{customer.payment_days}</td><td>{customer.median_gap_days} days</td><td>{customer.last_payment_date}</td><td>{customer.ratio_to_typical_gap.toFixed(2)}×</td><td>{customer.potentially_at_risk ? "Review" : "Usual range"}</td></tr>)}</tbody></table></div> : <p className="empty-copy">Add transaction history with at least three payment dates per customer to see frequency.</p>}</section><section className="merchant-panel"><h2>Customer name aliases</h2><p>Map spelling or local-language names to the same customer. Disha uses these for payment lookup and Khata auto-match.</p><form className="khata-form" onSubmit={(event)=>void saveAlias(event)}><label>Customer’s main name<input required maxLength={120} value={aliasForm.customer_name} onChange={(event)=>setAliasForm({...aliasForm,customer_name:event.target.value})} placeholder="Ramesh Kumar"/></label><label>Name in payment records<input required maxLength={120} value={aliasForm.alias} onChange={(event)=>setAliasForm({...aliasForm,alias:event.target.value})} placeholder="రమేష్"/></label><button className="merchant-primary" disabled={!schemaReady||!canEdit||Boolean(busy)}>{busy==="alias"?"Saving…":"Save alias"}</button></form>{aliases.length>0&&<p className="empty-copy">{aliases.map((item)=>`${item.alias} → ${item.customer_name}`).join(" · ")}</p>}</section></>}

      {tab === "Ask Disha" && <section className="merchant-panel ask-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">VOICE AND DATA ASSISTANT</p><h2>Ask about your records</h2></div><span className="step-pill">OPENROUTER TOOLS</span></div><p>Try “Did Ramesh pay me?”, “What should I order next month?”, “What are my collections?” or “Who is paying less often?”</p><div className="voice-controls"><button className="merchant-secondary" type="button" disabled={transcribing||Boolean(busy)} onClick={()=>recording?stopRecording():void startRecording()}>{recording?"Stop recording":transcribing?"Transcribing…":"🎙 Speak a question"}</button><small>Up to 30 seconds. Sarvam transcribes English or Indian languages.</small></div><form className="merchant-ask-form" onSubmit={(event)=>void ask(event)}><input value={question} onChange={(event)=>setQuestion(event.target.value)} maxLength={600} placeholder={language==="te"?"మీ చెల్లింపుల గురించి అడగండి":"Ask about payment or supplier purchase records"}/><select aria-label="Answer language" value={language} onChange={(event)=>setLanguage(event.target.value as "en"|"te")}><option value="en">English</option><option value="te">తెలుగు</option></select><button className="merchant-primary" disabled={!schemaReady||!question.trim()||Boolean(busy)}>{busy==="ask"?"Checking records…":"Ask Disha"}</button></form>{answer&&<div className="assistant-answer"><p>{answer.answer}</p><small>Tools used: {answer.usedTools.join(", ")||"none"}{answer.fallbackUsed?" · verified fallback":""}</small><NarrationPlayer text={answer.answer} language={language}/></div>}<p className="review-note">Spoken questions use Sarvam STT, answers use OpenRouter tools, and Sarvam TTS narrates the result.</p></section>}

      {tab === "Activity" && <section className="merchant-panel"><div className="merchant-section-heading"><div><p className="merchant-eyebrow">WORKSPACE HISTORY</p><h2>Recent activity</h2></div><span className="step-pill">AUDIT LOG</span></div>{audit.length ? <div className="bill-table-wrap"><table><thead><tr><th>Time</th><th>Action</th><th>Decision</th><th>Outcome</th></tr></thead><tbody>{audit.map((event)=><tr key={event.id}><td>{new Date(event.created_at).toLocaleString("en-IN")}</td><td>{event.tool}</td><td>{event.decision}</td><td>{event.outcome??"—"}</td></tr>)}</tbody></table></div> : <p className="empty-copy">No workspace activity has been recorded yet.</p>}</section>}
    </div>
  </main>;
}
