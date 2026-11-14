import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const source='C:/Users/ssank/Desktop/disha/data/DISHA_Final_Submission-1-3720a5.pptx';
const outDir='C:/Users/ssank/Desktop/disha/.codex-ppt-build';
const p=await PresentationFile.importPptx(await FileBlob.load(source));
const copy={
// 1 — cover and first product glimpse
'sh/65g3298r':'Know your next bulk order from old bills',
'sh/ts7md4r2':'Upload two months of supplier bills. Review, edit and print.',
'sh/hofulsf2':'Supplier bills','sh/4r6dg7et':'Payments','sh/3qxwn2x8':'Customers','sh/1cvuxc7e':'Voice',
'sh/p4bu5s76':'Merchant workspace','sh/432dwn6l':'Good morning',
'sh/uxgjq907':'Your next business decisions',
'sh/i1gje90j':'Next bulk order','sh/j2pkne14':'From two months of bills','sh/43y1gji9':'Review order list →',
'sh/z2xgf6to':'Payment questions','sh/e1oz61c3':'Search by name and amount','sh/14fyhgbe':'Ask Disha →',
'sh/9sfylgbq':'Customer frequency','sh/or6hcvu5':'See who returns often','sh/buh0nqtg':'View suggestions →',
'sh/at8zelcb':'Speak to Disha',
// 2 — merchant problem
'sh/ozy1ofad':'Merchants have bills and payment records. Turning them into decisions takes time',
'sh/w3i1sfa9':'Supplier bills','sh/r65knqtk':'Recent','sh/q5wjelsz':'2 months','sh/9wnqhczy':'Ready for','sh/mtwrmxg7':'OCR','sh/nu58f2hs':'Review',
'sh/xk7qlczu':'Supplier orders by guesswork','sh/ahwrqhgj':'Old bills hold purchase history, but merchants still rebuild the next order by hand.',
'sh/gbmxszmt':'Payment dates','sh/fadgzu58':'Repeat customers',
'sh/p0vy54na':'Customer frequency is hidden','sh/4zmxwzmp':'Payment history can show who buys often and who has gone quiet.',
'sh/je9crql0':'Bill history','sh/ru5cbqd4':'Item quantities',
'sh/tw7ud0va':'Next order is unclear','sh/svedkvup':'Recent supplier bills can estimate what to order next and when.',
'sh/1wzix87i':'Cash position: unclear','sh/zuh0vypc':'Cash flow lives across records','sh/c76hk361':'Names, amounts and dates in one transaction history make cash questions answerable.',
'sh/xgfil8zy':'Language slows things down','sh/wf6hcnyd':'Ask by voice in Telugu or English and hear a spoken answer.',
'sh/ad4zadg7':'Disha turns the records merchants already have into clear next steps.',
// 3 — proposed solution and daily loop
'sh/d0jax03i':'Disha turns recent bills into a reviewable supplier order',
'sh/n2l4fq98':'Supplier order · merchant reviewed',
'sh/943mhgre':'History','sh/83ulovat':'2 months','sh/v6l4jq94':'Bills uploaded',
'sh/ja54na9g':'Batch bill OCR','sh/i9w3u58v':'Extract supplier items','sh/e10f2twf':'Review →',
'sh/6d0fytg3':'Forecast next order','sh/re9g7yxo':'Timing, items and quantities','sh/sfix03y9':'Edit order →',
'sh/l4fi9cza':'Print or save','sh/k3m1g7yp':'Merchant approves the list','sh/z2d07mh4':'Prepare order →',
'sh/byd032h8':'1  CAPTURE BILLS','sh/ax4zax0n':'Upload recent supplier invoices',
'sh/hwzihwzi':'2  EXTRACT ITEMS','sh/wv61obyx':'OCR lines, quantities and prices',
'sh/4nuhs7uh':'3  FORECAST','sh/po3ilcvm':'Estimate the next order from history',
'sh/21szqxcb':'4  ASK OR SPEAK','sh/32l0j2dw':'Telugu or English · text or voice',
'sh/cruhwrud':'5  REVIEW','sh/ds3ipcvy':'Merchant edits before saving or printing',
'sh/qpczuhc7':'6  IMPROVE','sh/rql0nmds':'New bills refine future estimates',
'sh/0ve10ru9':'Bills start the forecast. The merchant owns the final order.',
// 4 — three product features
'sh/0ba143al':'One merchant record. Three useful answers',
'sh/ql8jytsj':'SUPPLIER ORDER','sh/doj29oba':'Merchant-provided bills','sh/5cva1cfq':'CUSTOMER FREQUENCY','sh/i94r6xgz':'Payment history',
'sh/jadsz2xk':'Next bulk order','sh/w72947yt':'Upload two months of supplier bills','sh/a5kr2xg3':'OCR extracts','sh/v6tsv2xo':'Items + qty','sh/h4fa9wfy':'Merchant checks','sh/p0batw72':'Rates + units','sh/3ytsrmpw':'Then create','sh/2xkrih8b':'Order list',
'sh/1wbapc7q':'Review and edit every extracted line, then save or print the order for the supplier.',
'sh/gv29g7q5':'Review bill lines','sh/fu9sn2p0':'Purchase history becomes a plan.',
'sh/et0reh8f':'Ask about a payment','sh/ilwf69kv':'Search Disha transactions','sh/jm5gze1g':'Match by name, amount and date',
'sh/5ony1oj6':'DB','sh/axcf29kj':'merchant transaction records','sh/wzex4z2p':'₹','sh/xknyx4ja':'matched amount and date',
'sh/nulw7u18':'Voice query · Telugu / English','sh/fm5c3q54':'సీత నుంచి చెల్లింపు వచ్చిందా?','sh/elwba54j':'Did I receive a payment from Sita?',
'sh/18nu50nu':'Ask Disha','sh/0netcvm9':'Hear answer',
'sh/rilczq5s':'Answers cite the merchant’s transaction history.',
'sh/qhcb6l47':'Understand customer frequency','sh/sjut8vmd':'Txn','sh/3elcv65w':'payment count','sh/8jq9c72t':'Gap','sh/tkjq5c3e':'days between payments',
'sh/7ih83mlo':'Payment dates reveal purchase rhythm / Disha suggests who may need attention.',
'sh/hoja9w3q':'Customer insights come from transaction history—not a stock ledger.',
'sh/ulsrehkz':'Cash flow uses transaction records stored in Disha today. Paytm data access is a future integration.',
'sh/vm1s7mlk':'View insights','sh/wr694nm1':'Merchant decides what to do next.',
'sh/xsfqxs36':'Illustrative workflow · Merchant-provided records · No Paytm API today · No order is sent automatically',
// 5 — agent tools and audio
'sh/cf2tcr61':'An agent that can answer, calculate and prepare',
'sh/z2tcnm5s':'OpenRouter chooses tools; deterministic code supplies the facts.',
'sh/032tgr6d':'Receive query  Bill, payment, customer or voice request',
'sh/w32dkbuh':'Select tool  Route to OCR, transaction or frequency data',
'sh/v2twb6dw':'Calculate  Forecast and summaries use fixed code',
'sh/i54fmlc7':'Answer  OpenRouter explains the tool results',
'sh/tcfel0vu':'Review  Merchant checks the supplier order',
'sh/fe94nm1w':'Save or print  Approved order is recorded',
'sh/ud0ne10b':'AGENT TOOLS · MERCHANT RECORDS ONLY',
'sh/pkr6tgjy':'extract_supplier_bills(files)',
'sh/4ji5kbid':'forecast_next_order(supplier)',
'sh/3i94r61s':'search_transactions(name, amount)',
'sh/2h0ni107':'summarise_cash_flow(period)',
'sh/5o7mhcju':'get_customer_frequency(name)',
'sh/kny587i9':'answer_voice_query(text)',
'sh/atcjidg7':'prepare_printable_order(supplier)',
'sh/5kn2hszu':'“Did a payment from Sita arrive?”',
'sh/zmlk3yhk':'Search records',
'sh/ehkzepsn':'OpenRouter answers from results',
'sh/1kvi94re':'The response includes the matching transaction date and amount when found.',
'sh/bqx0fe9g':'VOICE · STT + TTS',
'sh/9gfy5o7e':'సీత నుంచి చెల్లింపు వచ్చిందా?',
'sh/mdoza9o3':'“Did I receive a payment from Sita?”',
'sh/0r6h8z6x':'Disha transcribes the question, searches transaction tools, then speaks the grounded answer.',
'sh/lcfy147i':'Sarvam speech · Telugu + English',
'sh/yp4z69or':'Read-only queries need no approval. A supplier order stays a draft until the merchant reviews it.',
// 6 — architecture
'sh/zi98nu94':'Standalone today; Paytm transaction access is a future integration.',
'sh/87ipkzal':'A clear boundary between AI and calculations',
'sh/oryp8fah':'Next.js merchant app',
'sh/pc76hkr2':'Sarvam speech-to-text',
'sh/ydgnit07':'Supplier order forecasting',
'sh/zep4byhs':'Cash-flow summary from Disha DB',
'sh/50bqpcj2':'Merchant bills + transactions in Disha DB',
'sh/4f2pgr2h':'OpenRouter LLM + LangGraph tools',
'sh/va98j210':'Sarvam text-to-speech',
'sh/7exwfehs':'The current product uses merchant-provided records in Disha. Paytm APIs are not connected; transaction integration is a future step subject to access and approval.',
// 7 — USP
'sh/dcbud0ra':'Two months of supplier bills become your next bulk order',
'sh/kzmdova1':'Batch bill OCR',
'sh/l0vuh0rm':'Upload recent supplier invoices together.',
'sh/baxkjqlk':'Merchant edits',
'sh/a9ojq5kz':'Check and correct each extracted line.',
'sh/n6x0fqlo':'Predict next order',
'sh/25ojml43':'Estimate timing and quantities from bill history.',
'sh/f2d0b6lc':'Ready to print',
'sh/eh4jil4r':'Save or print after merchant review.',
'sh/4fm1wb6p':'Supplier bill history  →  deterministic forecast  →  editable order list',
// 8 — benefits and measurement plan
'sh/g72x4zyd':'Plan orders, cash flow and customer follow-up',
'sh/sjix0zy1':'Plan the next order','sh/je9g3ahk':'OCR recent bills; edit and print a forecast order.',
'sh/m5gvmhwn':'See cash flow','sh/n6pwfmd8':'Ask about amounts and payers in Disha records.',
'sh/zipwbmdc':'Understand frequency','sh/kfixwbe1':'See who returns often or may be slipping away.',
'sh/7u5w765k':'Use your voice','sh/6twve1oz':'Speak in Telugu or English; hear a grounded answer.',
'sh/kredcr6t':'What a merchant pilot should measure',
'sh/jq5w365o':'MEASURE IN PILOT',
'sh/x4ne1wni':'Measurement plan only. Results require merchant-provided bills and transaction history.',
// 9 — proposed model and Paytm dependency
'sh/0b65obm9':'Merchant growth insights, with a path to Paytm data',
'sh/9gzml0nq':'FREE  Order planning / Supplier bill OCR and editable order drafts',
'sh/bih4na5w':'PREMIUM  Merchant growth / Cash flow, voice queries and customer frequency',
'sh/oza1gfyh':'FUTURE  Paytm data / Transaction endpoint, subject to access and approval',
'sh/cnu1kzyd':'Supplier order planning',
'sh/do3id4fy':'Bills become a clear, printable next order.',
'sh/lsn2h4fa':'Payment intelligence',
'sh/98ji147e':'Cash-flow and payment search use records stored in Disha today.',
'sh/hcji5o7a':'Customer frequency',
'sh/wba1cjqp':'Use payment history to identify regular and less frequent buyers.',
'sh/va103ep4':'INTEGRATION STATUS · STANDALONE NOW',
'sh/xgzitk76':'Today','sh/cf6h0fql':'Merchant bills and payment records in Disha',
'sh/nmdg3q54':'Future','sh/onmxcv69':'Paytm transaction endpoint, if access is approved',
'sh/apofe5of':'Voice + AI','sh/bqxg7q50':'Telugu and English voice questions route through tools; OpenRouter narrates results grounded in merchant data.',
'sh/cr6xgv6l':'No live Paytm integration is available in this standalone product today.',
// 10 — roadmap / ask
'sh/cbu58j2h':'A standalone merchant product, with Paytm integration later',
'sh/l036l83y':'Standalone MVP',
'sh/725onyl4':'Batch OCR for supplier bills / Edit and print next bulk order / Cash flow from Disha DB transactions / Telugu + English STT and TTS / OpenRouter tool-based queries / Customer frequency from payment history',
'sh/d87uxg3m':'Paytm data integration',
'sh/q5gb21kb':'Future · subject to API access and approval',
'sh/r6pcv6lw':'Connect approved transaction endpoint / Enrich cash-flow and payment search / Validate with merchant consent / Measure query and forecast quality',
'sh/e9gb61k7':'Growth intelligence',
'sh/fapcz6ls':'After merchant pilot validation',
'sh/ozitcv29':'Improve order forecasts / Add supplier catalog links / Expand languages and voice / Explore other approved business data',
'sh/xwnupgvy':'OUR ASK   / Help us validate a standalone supplier-order and merchant cash-flow copilot with real merchant-provided records.',
'sh/wvetgbud':'Disha works from merchant records today. Paytm transaction access can make the cash-flow view richer in a future approved integration.',
'sh/0nut8rul':'Order + cash briefing',
'sh/q9srixs3':'Today with Disha',
'sh/exsrmhsf':'Supplier bills reviewed; order list ready',
'sh/u187adsv':'Cash query answered from Disha records',
'sh/xo7ytkzy':'Customer frequency insight updated',
'sh/jq9gvuh4':'Next focus / Review the next supplier order and customer trends',
'sh/5cryx4za':'Concept product · merchant-provided records'
};
for (const [id,text] of Object.entries(copy)) p.resolve(id).text=text;
const fitFixes={
// Remove wording that does not fit the original two-line card text areas.
'sh/65g3298r':'Supplier bills predict your next bulk order',
'sh/q5wjelsz':'2 mo','sh/9wnqhczy':'OCR','sh/mtwrmxg7':'Edit','sh/nu58f2hs':'Print',
'sh/p0vy54na':'Customer rhythm is unclear',
'sh/4zmxwzmp':'Payment dates show who returns often.',
'sh/ih8ju9sn':'Disha DB records',
'sh/ilwf69kv':'Transaction search',
'sh/jm5gze1g':'Match name · amount · date',
'sh/axcf29kj':'transaction record',
'sh/xknyx4ja':'matched amount / date',
'sh/qhcb6l47':'Customer rhythm',
'sh/sjut8vmd':'N','sh/3elcv65w':'payments',
'sh/8jq9c72t':'Δ','sh/tkjq5c3e':'days between',
'sh/7ih83mlo':'Payment dates show repeat patterns.',
'sh/hoja9w3q':'See who returns often.',
'sh/ulsrehkz':'Disha records today · Paytm API later.',
'sh/kfixwbe1':'See who buys often or less often.',
'sh/jq5w365o':'PILOT MEASURES',
'sh/cf6h0fql':'Merchant bills and payments in Disha',
'sh/onmxcv69':'Paytm endpoint, subject to access',
'sh/725onyl4':'Supplier-bill OCR and order forecast / Review, edit, save or print / Cash flow from Disha records / Telugu + English voice / OpenRouter agent tools / Customer purchase frequency',
// Keep the agent query demonstrably read-only in the phone mockup.
'sh/ji5kf2ho':'Disha DB',
'sh/gjmhgzqt':'Speak answer',
'sh/3md0bu94':'Ask another',
'sh/povid4ra':'✓ Answered from Disha transaction history',
// The USP comparison now describes this bill-led product accurately.
'sh/4fm1wb6p':'Bills in  →  order forecast  →  merchant-edited print list',
'sh/ydgnit07':'Next-order forecasting',
'sh/zep4byhs':'Cash-flow summary from Disha records',
'sh/0fy5k3id':'Supplier-bill OCR',
'sh/lg76d8zy':'Customer frequency',
'sh/j6dcr65c':'LangGraph agent in TypeScript',
'sh/7698f214':'Every AI answer is checked against tool results / If a check fails, use a safe fallback / Deterministic code calculates order and cash figures / Merchant reviews a supplier order before saving or printing / Audit record of every action',
'sh/xcfy90n6':'Voice queries, cash-flow insights and customer frequency',
// Remove sandbox labels from product copy now that data is merchant-provided.
'sh/fu94fe98':'Hackathon concept prototype · Merchant-provided records · Not an official Paytm product',
'sh/xsfqxs36':'Merchant-provided records · No Paytm API today · No order is sent automatically'
};
for (const [id,text] of Object.entries(fitFixes)) p.resolve(id).text=text;
// The imported bar chart visualised on-hand stock. Remove it and use an explicit
// text statement about the customer-frequency signal instead of fabricated values.
p.delete('ch/076l4f25');
const rhythmNote=p.slides.items[3].shapes.add({
 geometry:'textbox',
 position:{left:859,top:412,width:334,height:72},
 fill:'none', line:{style:'solid',fill:'none',width:0}
});
rhythmNote.text='Repeat transaction dates show customer frequency.';
rhythmNote.text.style={fontSize:16,typeface:'Calibri',color:'#667085',alignment:'left'};
const table=p.resolve('tb/rad8jut8');
const rows=[
 ['Measure','How we evaluate','Status'],
 ['Bill OCR','Merchant edits vs extracted lines','Pilot measure'],
 ['Order forecast','Forecast vs next confirmed supplier bill','Pilot measure'],
 ['Cash answers','Match answer to Disha transaction rows','Pilot measure'],
 ['Customer frequency','Check segments against payment dates','Pilot measure'],
 ['Voice queries','Transcribe, answer and speak in Telugu / English','Pilot measure'],
];
for(let r=0;r<rows.length;r++) for(let c=0;c<rows[r].length;c++) table.cells.set(r,c,rows[r][c]);
const notes=[
'Introduce the product through the merchant’s existing records. Disha turns supplier bills into the next reviewable bulk order. The merchant can edit each extracted line before saving or printing.',
'Merchants already have supplier invoices and transaction records. The gap is turning those records into order timing, cash visibility and useful customer follow-up. No stock ledger is required for this product direction.',
'The merchant uploads recent supplier bills together. OCR extracts line items. A deterministic forecast estimates the next supplier order. The merchant reviews and edits the list before saving or printing. New bills refine the estimate.',
'The three features are supplier-order planning, transaction-based cash-flow queries and customer frequency. Cash-flow queries use records stored in Disha now. Paytm API access is a future integration, not a current connection.',
'The agent uses tools for bill extraction, forecasting, transaction search, cash-flow summaries, customer frequency and printable order preparation. OpenRouter handles query routing and narration. Sarvam provides speech input and output. Calculations remain deterministic and grounded in the data returned by tools.',
'The standalone app stores merchant-provided bills and transaction records in Disha. Sarvam handles bill OCR and speech. LangGraph orchestrates typed tools, and OpenRouter provides the language model. The product does not connect to Paytm today.',
'The USP is concrete: upload about two months of supplier bills together, let OCR extract the items, review and edit the list, forecast the next bulk order, then save or print it. Disha estimates purchase needs from bill history; it is not on-hand inventory management.',
'These are pilot measures, not claimed results. Evaluate OCR corrections, order forecast error, grounded transaction answers, customer frequency and voice task completion using records supplied by participating merchants.',
'This is a proposed product model. The standalone version uses supplier bills and transaction records in Disha. Any Paytm endpoint connection depends on future API access, approval and merchant consent.',
'Phase 1 is the standalone product with merchant-provided records. Phase 2 can connect an approved Paytm transaction endpoint. Later phases can improve forecasts and add supplier links. The ask is to validate the merchant problem and usefulness of the order and cash-flow features.'
];
for(let i=0;i<p.slides.items.length;i++) p.slides.items[i].speakerNotes.text=notes[i];
await fs.mkdir(outDir,{recursive:true});
const candidate=await PresentationFile.exportPptx(p); await candidate.save(outDir+'/candidate.pptx');
for(let i=0;i<p.slides.items.length;i++){
 const png=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(`${outDir}/updated-slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await png.arrayBuffer()));
}
const montage=await p.export({format:'webp',montage:true,scale:0.45});
await fs.writeFile(outDir+'/updated-montage.webp',new Uint8Array(await montage.arrayBuffer()));
const check=await p.inspect({kind:'slide,textbox,table,notes',maxChars:250000});
await fs.writeFile(outDir+'/updated-inspect.ndjson',check.ndjson,'utf8');
console.log('edited text shapes',Object.keys(copy).length,'slides',p.slides.items.length,'tables',rows.length);
