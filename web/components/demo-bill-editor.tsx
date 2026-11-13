"use client";

type BillDraft = { total: number; inventoryCost: number; gheeQty: number };

const copy = {
  en: { eyebrow: "DEMO MODE", title: "Add a synthetic bill", summary: "Updates sales, stock, and the forecast", total: "Bill total (₹)", cost: "Inventory cost (₹)", ghee: "Ghee sold (jars)", note: "The bill is added to the synthetic ledger and saved in the audit trail.", saving: "Saving…", add: "Add bill" },
  te: { eyebrow: "డెమో మోడ్", title: "డెమో బిల్లు జోడించండి", summary: "అమ్మకాలు, స్టాక్, అంచనా మారతాయి", total: "బిల్లు మొత్తం (₹)", cost: "సరుకు ఖర్చు (₹)", ghee: "అమ్మిన నెయ్యి (జార్లు)", note: "బిల్లు డెమో లెడ్జర్‌లో చేరి ఆడిట్‌లో నమోదు అవుతుంది.", saving: "భద్రపరుస్తోంది…", add: "బిల్లు జోడించండి" },
};

export function DemoBillEditor({ saving, language, onAdd }: { saving: boolean; language: "en" | "te"; onAdd: (bill: BillDraft) => void }) {
  const labels = copy[language];
  return (
    <form className="demo-bill-editor panel" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      onAdd({ total: Number(form.get("total")), inventoryCost: Number(form.get("inventoryCost")), gheeQty: Number(form.get("gheeQty")) });
    }}>
      <div className="catalog-heading">
        <div><p className="eyebrow">{labels.eyebrow}</p><h2>{labels.title}</h2></div>
        <span>{labels.summary}</span>
      </div>
      <div className="demo-bill-fields">
        <label>{labels.total}<input name="total" type="number" min="1" max="1000000" step="1" defaultValue="250" required /></label>
        <label>{labels.cost}<input name="inventoryCost" type="number" min="0" max="1000000" step="1" defaultValue="180" required /></label>
        <label>{labels.ghee}<input name="gheeQty" type="number" min="0" max="100" step="1" defaultValue="1" required /></label>
      </div>
      <div className="demo-bill-footer"><p>{labels.note}</p><button className="primary-action" type="submit" disabled={saving} aria-busy={saving}>{saving ? labels.saving : labels.add}</button></div>
    </form>
  );
}
