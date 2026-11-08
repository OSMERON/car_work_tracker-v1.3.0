import { AlertTriangle, Calculator, CheckCircle2, Download, ExternalLink, FileText, Plus, Printer, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Field, PageHeader, money } from "../components/Ui";
import { useData } from "../store/DataContext";
import { calculateIncomeTaxSummary, calculateVatDraft } from "../lib/tax";
import type { TaxAdjustmentType, TaxSettings } from "../types";

const defaultSettings: TaxSettings = {
  businessName: "",
  vatNumber: "",
  scheme: "flat-rate",
  flatRatePercent: null,
  salesVatRate: 20,
  accountingBasis: "cash",
  vatIncomeTreatment: "unknown",
  reimbursementVatTreatment: "unknown"
};

const previousQuarter = () => {
  const now = new Date();
  const currentQuarterStart = Math.floor(now.getMonth() / 3) * 3;
  const end = new Date(now.getFullYear(), currentQuarterStart, 0, 12);
  const start = new Date(end.getFullYear(), end.getMonth() - 2, 1, 12);
  return { start: start.toLocaleDateString("en-CA"), end: end.toLocaleDateString("en-CA") };
};

const taxYearStart = (end: string) => {
  const year = Number(end.slice(0, 4));
  return `${end.slice(5) >= "04-06" ? year : year - 1}-04-06`;
};

const download = (name: string, content: string, type: string) => {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
};

const adjustmentLabels: Record<TaxAdjustmentType, { ro: string; en: string }> = {
  "other-sales-gross": { ro: "Alte vânzări, total cu VAT", en: "Other sales, VAT-inclusive total" },
  "other-output-vat": { ro: "Alte sume VAT pentru Box 1", en: "Other output VAT for Box 1" },
  box2: { ro: "VAT achiziții NI din UE, Box 2", en: "NI acquisitions VAT, Box 2" },
  "input-vat": { ro: "VAT eligibil de recuperat, Box 4", en: "Eligible VAT reclaim, Box 4" },
  "capital-purchase": { ro: "Bun de capital eligibil, Box 7", en: "Eligible capital purchase, Box 7" },
  box8: { ro: "Livrări bunuri NI către UE, Box 8", en: "NI goods supplied to EU, Box 8" },
  box9: { ro: "Achiziții bunuri UE în NI, Box 9", en: "EU goods acquired into NI, Box 9" },
  "allowable-expense": { ro: "Cheltuială permisă doar pentru Income Tax", en: "Income Tax allowable expense only" }
};

export function TaxPage() {
  const { data, language, saveTaxSettings, saveTaxAdjustment, removeTaxAdjustment, setTaxPeriodConfirmed } = useData();
  const [period, setPeriod] = useState(previousQuarter);
  const [settings, setSettings] = useState<TaxSettings>(data.taxSettings ?? defaultSettings);
  const [message, setMessage] = useState("");
  const [adjustment, setAdjustment] = useState({ date: period.end, type: "other-sales-gross" as TaxAdjustmentType, amount: "", vatAmount: "", notes: "" });
  const draft = useMemo(() => calculateVatDraft(data, period.start, period.end, settings), [data, period, settings]);
  const income = useMemo(() => calculateIncomeTaxSummary(data, period.start, period.end, settings), [data, period, settings]);
  const ytd = useMemo(() => calculateIncomeTaxSummary(data, taxYearStart(period.end), period.end, settings), [data, period.end, settings]);
  const periodKey = `${period.start}:${period.end}`;
  const confirmed = (data.confirmedTaxPeriods ?? []).includes(periodKey);
  const adjustments = (data.taxAdjustments ?? []).filter(item => item.date >= period.start && item.date <= period.end).sort((a, b) => a.date.localeCompare(b.date));

  const saveSettings = () => {
    saveTaxSettings(settings);
    setTaxPeriodConfirmed(periodKey, false);
    setMessage(language === "ro" ? "Setările fiscale au fost salvate. Verifică din nou declarația." : "Tax settings saved. Review the return again.");
  };

  const addAdjustment = (event: FormEvent) => {
    event.preventDefault();
    if (!adjustment.date || (!Number(adjustment.amount) && !Number(adjustment.vatAmount))) return;
    saveTaxAdjustment({ id: crypto.randomUUID(), date: adjustment.date, type: adjustment.type, amount: Number(adjustment.amount) || 0, vatAmount: Number(adjustment.vatAmount) || 0, notes: adjustment.notes });
    setTaxPeriodConfirmed(periodKey, false);
    setAdjustment(previous => ({ ...previous, amount: "", vatAmount: "", notes: "" }));
  };

  const exportDraft = () => {
    const payload = {
      status: confirmed && !draft.blockers.length ? "reviewed-draft" : "incomplete-draft",
      periodStart: period.start,
      periodEnd: period.end,
      vatDueSales: draft.boxes[1],
      vatDueAcquisitions: draft.boxes[2],
      totalVatDue: draft.boxes[3],
      vatReclaimedCurrPeriod: draft.boxes[4],
      netVatDue: draft.boxes[5],
      totalValueSalesExVAT: Math.round(draft.boxes[6]),
      totalValuePurchasesExVAT: Math.round(draft.boxes[7]),
      totalValueGoodsSuppliedExVAT: Math.round(draft.boxes[8]),
      totalAcquisitionsExVAT: Math.round(draft.boxes[9]),
      finalised: false,
      calculation: { servicesFromPdfs: draft.servicesFromPdfs, reimbursementsFromPdfs: draft.reimbursementsFromPdfs, flatRateTurnover: draft.flatRateTurnover, flatRatePercent: settings.flatRatePercent }
    };
    download(`vat-draft-${period.start}-${period.end}.json`, JSON.stringify(payload, null, 2), "application/json");
  };

  const blockerText: Record<string, string> = language === "ro" ? {
    flatRatePercent: "Completează procentul efectiv Flat Rate.",
    vatIncomeTreatment: "Confirmă dacă sumele RAS includ VAT.",
    reimbursementVatTreatment: "Confirmă tratamentul VAT al rambursărilor.",
    noPayslips: "Nu există PDF-uri în perioada selectată."
  } : {
    flatRatePercent: "Enter the effective Flat Rate percentage.",
    vatIncomeTreatment: "Confirm whether RAS amounts include VAT.",
    reimbursementVatTreatment: "Confirm the VAT treatment of reimbursements.",
    noPayslips: "No payslip PDFs exist in the selected period."
  };

  return <>
    <PageHeader eyebrow="UK MTD" title={language === "ro" ? "VAT și Income Tax" : "VAT and Income Tax"} subtitle={language === "ro" ? "Declarație VAT cu 9 casete și sumar Income Tax create din evidențele tale digitale." : "Nine-box VAT return and Income Tax summary built from your digital records."}/>
    <section className="tax-status-row">
      <div className={`tax-status ${confirmed && !draft.blockers.length ? "ready" : "draft"}`}>{confirmed && !draft.blockers.length ? <CheckCircle2/> : <AlertTriangle/>}<div><strong>{confirmed && !draft.blockers.length ? (language === "ro" ? "Draft verificat" : "Reviewed draft") : (language === "ro" ? "Draft, nu este pregătit pentru trimitere" : "Draft, not ready to send")}</strong><span>{draft.payslipCount} PDF {language === "ro" ? "în perioada selectată" : "in the selected period"}</span></div></div>
      <div className="period-fields"><label>{language === "ro" ? "De la" : "From"}<input type="date" value={period.start} onChange={event => setPeriod(previous => ({ ...previous, start: event.target.value }))}/></label><label>{language === "ro" ? "Până la" : "To"}<input type="date" value={period.end} onChange={event => setPeriod(previous => ({ ...previous, end: event.target.value }))}/></label></div>
    </section>

    <section className="tax-settings-card">
      <div className="section-title"><div><span className="eyebrow">1</span><h2>{language === "ro" ? "Setări fiscale obligatorii" : "Required tax settings"}</h2></div><ShieldCheck/></div>
      <div className="form-grid">
        <Field label={language === "ro" ? "Numele afacerii" : "Business name"}><input value={settings.businessName} onChange={event => setSettings(previous => ({ ...previous, businessName: event.target.value }))}/></Field>
        <Field label="VAT number"><input value={settings.vatNumber} onChange={event => setSettings(previous => ({ ...previous, vatNumber: event.target.value }))}/></Field>
        <Field label={language === "ro" ? "Procent Flat Rate efectiv" : "Effective Flat Rate percentage"}><input type="number" min="0" max="100" step="0.1" value={settings.flatRatePercent ?? ""} onChange={event => setSettings(previous => ({ ...previous, flatRatePercent: event.target.value ? Number(event.target.value) : null }))} placeholder="Exemplu: 10"/></Field>
        <Field label={language === "ro" ? "Rata VAT pentru sume fără VAT" : "VAT rate for VAT-exclusive amounts"}><input type="number" min="0" max="100" step="0.1" value={settings.salesVatRate} onChange={event => setSettings(previous => ({ ...previous, salesVatRate: Number(event.target.value) || 0 }))}/></Field>
        <Field label={language === "ro" ? "Sumele RAS din PDF" : "RAS PDF amounts"}><select value={settings.vatIncomeTreatment} onChange={event => setSettings(previous => ({ ...previous, vatIncomeTreatment: event.target.value as TaxSettings["vatIncomeTreatment"] }))}><option value="unknown">{language === "ro" ? "Nu este confirmat" : "Not confirmed"}</option><option value="vat-inclusive">{language === "ro" ? "Includ VAT" : "Include VAT"}</option><option value="vat-exclusive">{language === "ro" ? "Nu includ VAT" : "Exclude VAT"}</option></select></Field>
        <Field label={language === "ro" ? "Rambursările pentru tren, taxi și alte costuri" : "Train, taxi and other reimbursements"}><select value={settings.reimbursementVatTreatment} onChange={event => setSettings(previous => ({ ...previous, reimbursementVatTreatment: event.target.value as TaxSettings["reimbursementVatTreatment"] }))}><option value="unknown">{language === "ro" ? "Nu este confirmat" : "Not confirmed"}</option><option value="taxable-recharge">{language === "ro" ? "Costuri refacturate, intră în turnover" : "Taxable recharges, include in turnover"}</option><option value="disbursement">{language === "ro" ? "Disbursements eligibile, exclude" : "Eligible disbursements, exclude"}</option></select></Field>
        <Field label={language === "ro" ? "Metoda evidenței" : "Accounting basis"}><select value={settings.accountingBasis} onChange={event => setSettings(previous => ({ ...previous, accountingBasis: event.target.value as TaxSettings["accountingBasis"] }))}><option value="cash">{language === "ro" ? "Cash basis, după plăți" : "Cash basis, by payments"}</option><option value="invoice">{language === "ro" ? "Invoice basis, după facturi" : "Invoice basis, by invoices"}</option></select></Field>
      </div>
      <button className="primary-button" type="button" onClick={saveSettings}>{language === "ro" ? "Salvează setările fiscale" : "Save tax settings"}</button>
      {message && <p className="success-message">{message}</p>}
    </section>

    {draft.blockers.length > 0 && <div className="tax-blockers"><AlertTriangle/><div><strong>{language === "ro" ? "Date lipsă" : "Missing information"}</strong>{draft.blockers.map(item => <p key={item}>{blockerText[item]}</p>)}</div></div>}

    <section className="tax-source-grid"><div><span>{language === "ro" ? "Servicii din PDF-uri" : "Services from PDFs"}</span><strong>{money(draft.servicesFromPdfs)}</strong></div><div><span>{language === "ro" ? "Rambursări din PDF-uri" : "Reimbursements from PDFs"}</span><strong>{money(draft.reimbursementsFromPdfs)}</strong></div><div><span>{language === "ro" ? "Turnover Flat Rate" : "Flat Rate turnover"}</span><strong>{money(draft.flatRateTurnover)}</strong></div><div><span>{language === "ro" ? "Procent aplicat" : "Applied percentage"}</span><strong>{settings.flatRatePercent ?? "?"}%</strong></div></section>

    <section className="vat-return-card">
      <div className="vat-return-heading"><div><span className="eyebrow">2</span><h2>{language === "ro" ? "Declarație VAT UK, cele 9 casete" : "UK VAT Return, nine boxes"}</h2><p>{period.start} to {period.end}</p></div><Calculator/></div>
      <div className="vat-group-title">{language === "ro" ? "VAT ÎN ACEASTĂ PERIOADĂ" : "VAT IN THIS PERIOD"}</div>
      <VatBox box={1} label={language === "ro" ? "VAT datorat pentru vânzări și alte outputs" : "VAT due on sales and other outputs"} value={draft.boxes[1]} explanation={language === "ro" ? `${money(draft.flatRateTurnover)} × ${settings.flatRatePercent ?? 0}% plus ajustări` : `${money(draft.flatRateTurnover)} × ${settings.flatRatePercent ?? 0}% plus adjustments`}/>
      <VatBox box={2} label={language === "ro" ? "VAT datorat pentru achiziții de bunuri în Northern Ireland din state UE" : "VAT due on acquisitions of goods in Northern Ireland from EU member states"} value={draft.boxes[2]}/>
      <VatBox box={3} label={language === "ro" ? "Total VAT datorat" : "Total VAT due"} value={draft.boxes[3]} calculated/>
      <VatBox box={4} label={language === "ro" ? "VAT recuperat pentru purchases și alte inputs" : "VAT reclaimed on purchases and other inputs"} value={draft.boxes[4]}/>
      <VatBox box={5} label={draft.paymentDirection === "pay" ? (language === "ro" ? "Total VAT de plătit către HMRC" : "Total VAT to pay HMRC") : (language === "ro" ? "Total VAT de recuperat de la HMRC" : "Total VAT to reclaim from HMRC")} value={draft.boxes[5]} calculated/>
      <div className="vat-group-title">{language === "ro" ? "VÂNZĂRI ȘI ACHIZIȚII" : "SALES AND PURCHASES"}</div>
      <VatBox box={6} label={language === "ro" ? "Valoarea totală a vânzărilor și altor outputs" : "Total value of sales and all other outputs"} value={draft.boxes[6]}/>
      <VatBox box={7} label={language === "ro" ? "Valoarea totală a achizițiilor și altor inputs" : "Total value of purchases and all other inputs"} value={draft.boxes[7]}/>
      <div className="vat-group-title">{language === "ro" ? "BUNURI ÎNTRE NORTHERN IRELAND ȘI UE" : "GOODS BETWEEN NORTHERN IRELAND AND THE EU"}</div>
      <VatBox box={8} label={language === "ro" ? "Bunuri și costuri asociate livrate din Northern Ireland către UE" : "Goods and related costs supplied from Northern Ireland to the EU"} value={draft.boxes[8]}/>
      <VatBox box={9} label={language === "ro" ? "Bunuri și costuri asociate achiziționate din UE în Northern Ireland" : "Goods and related costs acquired from the EU into Northern Ireland"} value={draft.boxes[9]}/>
      <div className="vat-actions"><button className="secondary-button" onClick={() => window.print()}><Printer size={17}/>{language === "ro" ? "Printează copia" : "Print copy"}</button><button className="secondary-button" onClick={exportDraft}><Download size={17}/>{language === "ro" ? "Descarcă draft JSON" : "Download JSON draft"}</button><button className="primary-button" disabled={draft.blockers.length > 0} onClick={() => setTaxPeriodConfirmed(periodKey, !confirmed)}>{confirmed ? (language === "ro" ? "Marchează neverificat" : "Mark unreviewed") : (language === "ro" ? "Confirmă evidențele complete" : "Confirm records complete")}</button></div>
    </section>

    <section className="tax-settings-card">
      <div className="section-title"><div><span className="eyebrow">3</span><h2>{language === "ro" ? "Ajustări care nu apar în PDF" : "Adjustments missing from PDFs"}</h2></div><Plus/></div>
      <form className="adjustment-form" onSubmit={addAdjustment}><input type="date" value={adjustment.date} onChange={event => setAdjustment(previous => ({ ...previous, date: event.target.value }))}/><select value={adjustment.type} onChange={event => setAdjustment(previous => ({ ...previous, type: event.target.value as TaxAdjustmentType }))}>{Object.entries(adjustmentLabels).map(([value, label]) => <option key={value} value={value}>{label[language]}</option>)}</select><input type="number" step="0.01" min="0" placeholder={language === "ro" ? "Valoare £" : "Amount £"} value={adjustment.amount} onChange={event => setAdjustment(previous => ({ ...previous, amount: event.target.value }))}/><input type="number" step="0.01" min="0" placeholder="VAT £" value={adjustment.vatAmount} onChange={event => setAdjustment(previous => ({ ...previous, vatAmount: event.target.value }))}/><input placeholder={language === "ro" ? "Explicație" : "Explanation"} value={adjustment.notes} onChange={event => setAdjustment(previous => ({ ...previous, notes: event.target.value }))}/><button className="primary-button" type="submit"><Plus size={17}/>{language === "ro" ? "Adaugă" : "Add"}</button></form>
      {adjustments.length > 0 && <div className="adjustment-list">{adjustments.map(item => <div key={item.id}><span><strong>{adjustmentLabels[item.type][language]}</strong><small>{item.date} · {item.notes || "-"}</small></span><span>{money(item.amount)}{item.vatAmount ? ` · VAT ${money(item.vatAmount)}` : ""}<button className="icon-button danger" onClick={() => { removeTaxAdjustment(item.id); setTaxPeriodConfirmed(periodKey, false); }}><Trash2 size={15}/></button></span></div>)}</div>}
    </section>

    <section className="income-tax-card"><div className="section-title"><div><span className="eyebrow">MTD INCOME TAX</span><h2>{language === "ro" ? "Sumar automat pentru self-employment" : "Automatic self-employment summary"}</h2></div><FileText/></div><div className="income-periods"><IncomeSummary title={language === "ro" ? "Perioada selectată" : "Selected period"} summary={income}/><IncomeSummary title={language === "ro" ? `An fiscal până la ${period.end}` : `Tax year to ${period.end}`} summary={ytd}/></div><p>{language === "ro" ? "Actualizarea trimestrială MTD Income Tax este un sumar al veniturilor și cheltuielilor. Nu este calculul final al taxei." : "An MTD Income Tax quarterly update is a summary of income and expenses. It is not the final tax calculation."}</p></section>

    <div className="official-guidance"><ExternalLink/><div><strong>{language === "ro" ? "Surse oficiale UK" : "Official UK sources"}</strong><p><a href="https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012" target="_blank" rel="noreferrer">VAT Notice 700/12</a> · <a href="https://www.gov.uk/guidance/flat-rate-scheme-for-small-businesses-vat-notice-733--2" target="_blank" rel="noreferrer">VAT Notice 733</a> · <a href="https://www.gov.uk/guidance/use-making-tax-digital-for-income-tax/send-quarterly-updates" target="_blank" rel="noreferrer">MTD Income Tax</a></p></div></div>
  </>;
}

function VatBox({ box, label, value, explanation, calculated = false }: { box: number; label: string; value: number; explanation?: string; calculated?: boolean }) {
  return <div className={`vat-box ${calculated ? "calculated" : ""}`}><div><strong>Box {box}: {label}</strong>{explanation && <small>{explanation}</small>}{calculated && <small>Calculated automatically</small>}</div><output><span>£</span><strong>{value.toFixed(2)}</strong></output></div>;
}

function IncomeSummary({ title, summary }: { title: string; summary: ReturnType<typeof calculateIncomeTaxSummary> }) {
  return <article><h3>{title}</h3><div><span>Gross receipts</span><strong>{money(summary.grossReceipts)}</strong></div><div><span>Flat Rate VAT</span><strong>{money(summary.flatRateVat)}</strong></div><div><span>Turnover for accounts</span><strong>{money(summary.turnoverForAccounts)}</strong></div><div><span>Business expenses</span><strong>{money(summary.expenses)}</strong></div><div className="income-profit"><span>Estimated profit</span><strong>{money(summary.estimatedProfit)}</strong></div></article>;
}
