"use client";

import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CashFlowProjection } from "@/lib/disha/types";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 0 });

const copy = {
  en: {
    eyebrow: "PHASE 2 EVALUATION", title: "Plan cash with a steadier view", subtitle: "Thirty-day weekday averages from the trailing eight weeks, with an uncertainty band.",
    projected: "30-day projected net", inventory: "After synthetic inventory costs", average: "Average projected day", weekday: "Same-weekday mean",
    error: "7-day hold-out error", target: "Target ≤ 10% · sandbox result", withinTarget: "Within target", overTarget: "Above target", netByDay: "NET CASH BY DAY", nextDays: "Next 30 days", band: "Mean ± 1.28 standard deviations",
    mean: "Weekday mean", uncertainty: "±1.28 standard deviations", method: "Net receipts minus inventory cost · synthetic ledger",
    backtest: "BACKTEST", holdoutTitle: "Seven-day hold-out", holdoutDescription: "Each held-out day is estimated from the eight weeks before it, using only the matching weekday.",
    actual: "Actual cumulative net", forecast: "Forecast cumulative net", absoluteError: "Absolute percentage error", tableCaption: "Daily 30-day cash-flow forecast and 80% uncertainty range",
    date: "Date", expected: "Expected net", lower: "Lower band", upper: "Upper band", disclaimer: "Sandbox evaluation only. No live bank, UPI, or payment-provider data is connected.",
    expectedNet: "Expected net", rangeWidth: "80% range width",
  },
  te: {
    eyebrow: "దశ 2 మూల్యాంకనం", title: "నగదు ప్రవాహాన్ని స్థిరంగా ప్రణాళిక చేయండి", subtitle: "గత ఎనిమిది వారాల వారపు రోజుల సగటుతో 30 రోజుల అంచనా; అనిశ్చితి పరిధితో.",
    projected: "30 రోజుల అంచనా నికర మొత్తం", inventory: "డెమో సరుకు ఖర్చుల తర్వాత", average: "రోజు సగటు అంచనా", weekday: "అదే వారపు రోజు సగటు",
    error: "7 రోజుల పరీక్ష లోపం", target: "లక్ష్యం ≤ 10% · డెమో ఫలితం", withinTarget: "లక్ష్యంలో ఉంది", overTarget: "లక్ష్యాన్ని మించింది", netByDay: "రోజువారీ నికర నగదు", nextDays: "తదుపరి 30 రోజులు", band: "సగటు ± 1.28 ప్రామాణిక విచలనాలు",
    mean: "వారపు రోజు సగటు", uncertainty: "±1.28 ప్రామాణిక విచలనాలు", method: "నికర రాబడి నుంచి సరుకు ఖర్చు తీసివేత · డెమో లెడ్జర్",
    backtest: "పునఃపరీక్ష", holdoutTitle: "7 రోజుల పరీక్ష", holdoutDescription: "ప్రతి పరీక్షా రోజును దానికి ముందు ఎనిమిది వారాల అదే వారపు రోజు ఆధారంగా అంచనా వేస్తాం.",
    actual: "వాస్తవ నికర మొత్తం", forecast: "అంచనా నికర మొత్తం", absoluteError: "శాతం లోపం", tableCaption: "రోజువారీ 30 రోజుల నగదు అంచనా, 80% అనిశ్చితి పరిధి",
    date: "తేదీ", expected: "అంచనా నికరం", lower: "కనిష్ఠ పరిధి", upper: "గరిష్ఠ పరిధి", disclaimer: "డెమో మూల్యాంకనం మాత్రమే. ప్రత్యక్ష బ్యాంక్, UPI లేదా చెల్లింపు డేటా అనుసంధానించలేదు.",
    expectedNet: "అంచనా నికరం", rangeWidth: "80% పరిధి వెడల్పు",
  },
};

function formatDay(value: string, language: "en" | "te") {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(language === "te" ? "te-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function CashFlowPanel({ projection, language }: { projection: CashFlowProjection; language: "en" | "te" }) {
  const labels = copy[language];
  const forecastTotal = projection.series.reduce((total, point) => total + point.forecast, 0);
  const averageDaily = forecastTotal / projection.days;

  return (
    <section className="detail-page cashflow-page" aria-labelledby="cashflow-title">
      <div className="page-heading">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1 id="cashflow-title">{labels.title}</h1>
        <p>{labels.subtitle}</p>
      </div>
      <div className="cashflow-metrics" aria-label={language === "te" ? "నగదు ప్రవాహ సారాంశం" : "Cash flow summary"}>
        <article className="cashflow-metric panel"><span>{labels.projected}</span><strong>{currency.format(forecastTotal)}</strong><small>{labels.inventory}</small></article>
        <article className="cashflow-metric panel"><span>{labels.average}</span><strong>{currency.format(averageDaily)}</strong><small>{labels.weekday}</small></article>
        <article className="cashflow-metric panel"><span>{labels.error}</span><strong>{projection.holdout.errorPercent.toFixed(1)}%</strong><small>{labels.target}</small><small>{projection.holdout.errorPercent <= 10 ? labels.withinTarget : labels.overTarget}</small></article>
      </div>
      <section className="cashflow-chart-panel panel" aria-label={language === "te" ? "30 రోజుల అంచనా చార్ట్" : "Thirty-day forecast chart"}>
        <div className="catalog-heading">
          <div><p className="eyebrow">{labels.netByDay}</p><h2>{labels.nextDays}</h2></div>
          <span>{labels.band}</span>
        </div>
        <div className="cashflow-chart" role="img" aria-label={`${labels.netByDay}. ${labels.error}: ${projection.holdout.errorPercent.toFixed(1)}%.`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projection.series} margin={{ top: 12, right: 8, bottom: 0, left: 4 }} accessibilityLayer>
              <CartesianGrid stroke="#ece9df" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(value: string) => formatDay(value, language)} interval={4} tick={{ fill: "#858d84", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value: number) => compactCurrency.format(value)} tick={{ fill: "#858d84", fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip
                labelFormatter={(value) => formatDay(String(value), language)}
                formatter={(value, name) => [currency.format(Number(value)), name === "forecast" ? labels.expectedNet : name === "bandWidth" ? labels.rangeWidth : String(name)]}
                contentStyle={{ border: "1px solid #e9e7df", borderRadius: 10, fontSize: 12 }}
              />
              <Area dataKey="low" stackId="uncertainty" fill="transparent" stroke="none" name={labels.lower} />
              <Area dataKey="bandWidth" stackId="uncertainty" fill="#d09a42" fillOpacity={0.18} stroke="none" name={labels.uncertainty} />
              <Line dataKey="forecast" type="monotone" stroke="#28543e" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "#28543e" }} name="forecast" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="cashflow-legend"><span><i className="legend-line" />{labels.mean}</span><span><i className="legend-band" />{labels.uncertainty}</span><span>{labels.method}</span></div>
      </section>
      <section className="cashflow-check panel" aria-labelledby="holdout-title">
        <div><p className="eyebrow">{labels.backtest}</p><h2 id="holdout-title">{labels.holdoutTitle}</h2><p>{labels.holdoutDescription}</p></div>
        <dl><div><dt>{labels.actual}</dt><dd>{currency.format(projection.holdout.actual)}</dd></div><div><dt>{labels.forecast}</dt><dd>{currency.format(projection.holdout.forecast)}</dd></div><div><dt>{labels.absoluteError}</dt><dd>{projection.holdout.errorPercent.toFixed(1)}%</dd></div></dl>
      </section>
      <div className="cashflow-table-wrap panel">
        <table className="catalog-table cashflow-table">
          <caption>{labels.tableCaption}</caption>
          <thead><tr><th scope="col">{labels.date}</th><th scope="col">{labels.expected}</th><th scope="col">{labels.lower}</th><th scope="col">{labels.upper}</th></tr></thead>
          <tbody>{projection.series.map((point) => <tr key={point.date}><th scope="row">{formatDay(point.date, language)}</th><td>{currency.format(point.forecast)}</td><td>{currency.format(point.low)}</td><td>{currency.format(point.high)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="cashflow-disclaimer">{labels.disclaimer}</p>
    </section>
  );
}
