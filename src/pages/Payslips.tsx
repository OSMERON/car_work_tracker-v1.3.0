import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, ExternalLink, FileUp, ShieldCheck, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatDate, mondayOf } from "../lib/date";
import { jobMiles } from "../lib/analytics";
import { jobRegistrations, parseRegistrationInput } from "../lib/jobProtocols";
import { tariffForMiles } from "../lib/rates";
import { extractPdfText, hashPdfFile, parsePayslipText } from "../lib/payslipPdf";
import { deletePayslipPdf, getPayslipPdf, savePayslipPdf } from "../lib/pdfStore";
import { isCompanyFuelPdfRow } from "../lib/expenseRules";
import type { AppData, Expense, Job, Payslip, PayslipExpense, PayslipJob, ReimbursementStatus } from "../types";

const statusFor = (expense: Expense): ReimbursementStatus => expense.reimbursementOverride ?? expense.reimbursementStatus ?? (expense.approved + .01 >= (expense.claimed || expense.actualCost) && expense.approved > 0 ? "full" : expense.approved > 0 ? "partial" : "review");
const statusLabel = (value: ReimbursementStatus, language: "ro" | "en") => ({ full: language === "ro" ? "Rambursat complet" : "Fully reimbursed", partial: language === "ro" ? "Parțial" : "Partial", unpaid: language === "ro" ? "Neplătit" : "Unpaid", review: language === "ro" ? "De verificat" : "Needs review" }[value]);
const companyTotal = (payslip: Payslip) => (payslip.deliveriesPaid ?? 0) + payslip.rewardPaid + payslip.expensesPaid + payslip.bonusPaid - payslip.deductions - payslip.adminFee;
const key = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const expenseReason = (row: PayslipExpense) => row.actionNote?.trim() || "—";

type Audit = ReturnType<typeof calculateAudit>;

function calculateAudit(item: Payslip, data: AppData) {
  const weekJobs = data.jobs.filter(job => job.status === "delivered" && (job.weekStart === item.weekStart || (job.deliveryDate && mondayOf(job.deliveryDate) === item.weekStart)));
  const expenses = data.expenses.filter(row => row.weekStart === item.weekStart && row.source === "manual");
  const pdfRows = [...(item.pdfJobs ?? [])].sort((a, b) => (b.date || item.weekStart).localeCompare(a.date || item.weekStart) || b.jobRef.localeCompare(a.jobRef));
  const pdfMiles = pdfRows.reduce((sum, row) => sum + row.miles, 0);
  const appMiles = weekJobs.reduce((sum, job) => sum + jobMiles(job), 0);
  const jobBase = weekJobs.reduce((sum, job) => sum + tariffForMiles(jobMiles(job)), 0);
  const waiting = weekJobs.reduce((sum, job) => sum + (job.waitingPaid ?? job.waitingEstimated ?? 0), 0);
  const claimed = expenses.reduce((sum, expense) => sum + expense.claimed, 0);
  const workedDays = new Set(weekJobs.map(job => job.deliveryDate).filter(Boolean)).size;
  const onTimeDays = new Set(weekJobs.filter(job => job.firstDeliveryBefore9).map(job => job.deliveryDate).filter(Boolean)).size;
  const ratio = workedDays ? onTimeDays / workedDays : 0;
  const rewardPercent = weekJobs.some(job => job.firstDeliveryBefore9 !== null) ? ratio >= 1 ? 20 : ratio >= .75 ? 15 : ratio >= .5 ? 10 : 0 : item.rewardPercent;
  const expectedReward = (jobBase + waiting) * rewardPercent / 100;
  const expectedTotal = jobBase + waiting + expectedReward + claimed + item.bonusPaid - item.deductions - item.adminFee;
  const difference = item.totalPaid - expectedTotal;
  const internalDifference = item.totalPaid - companyTotal(item);
  const statuses = expenses.map(statusFor);
  const verdict: ReimbursementStatus = !expenses.length ? (Math.abs(difference) <= .02 ? "full" : "review") : statuses.every(value => value === "full") && Math.abs(difference) <= .02 ? "full" : statuses.some(value => value === "unpaid") || difference < -10 ? "unpaid" : statuses.some(value => value === "partial") || Math.abs(difference) > .02 ? "partial" : "review";
  return { weekJobs, expenses, pdfRows, pdfMiles, appMiles, jobBase, waiting, claimed, rewardPercent, expectedReward, expectedTotal, difference, internalDifference, verdict };
}

function findAppJob(row: PayslipJob, jobs: Job[]) {
  const registrations = parseRegistrationInput(row.registration);
  return jobs.find(job => key(job.jobRef) === key(row.jobRef) || registrations.some(registration => jobRegistrations(job, true).includes(registration)));
}

export function PayslipsPage() {
  const { data, language, savePayslip, removePayslip } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [expanded, setExpanded] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(0);
  const [replacement, setReplacement] = useState<{ parsed: Payslip; file: File; existing: Payslip } | null>(null);
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const payslips = useMemo(() => [...data.payslips].sort((a, b) => b.weekStart.localeCompare(a.weekStart)), [data.payslips]);
  const filtered = payslips.filter(item => !month || item.weekStart.startsWith(month));
  const visible = filtered.slice(page * 5, page * 5 + 5);
  const active = payslips.find(item => item.id === selected) ?? visible[0];

  const upload = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    setBusy(true); setError(""); setNotice("");
    let imported = 0, duplicates = 0, cars = 0, miles = 0;
    const failures: string[] = [];
    try {
      for (const file of files) {
        try {
          const hash = await hashPdfFile(file);
          if (data.payslips.some(item => item.fileHash === hash)) { duplicates += 1; continue; }
          const parsed = { ...parsePayslipText(await extractPdfText(file), file.name), fileHash: hash };
          const existing = data.payslips.find(item => item.weekStart === parsed.weekStart);
          if (existing) { setReplacement({ parsed, file, existing }); setSelected(existing.id); continue; }
          await savePayslipPdf(parsed.id, file); savePayslip(parsed); setSelected(parsed.id);
          imported += 1; cars += parsed.pdfJobs?.length ?? 0; miles += (parsed.pdfJobs ?? []).reduce((sum, row) => sum + row.miles, 0);
        } catch (uploadError) { failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`); }
      }
      if (imported || duplicates) setNotice(language === "ro" ? `${imported} PDF-uri importate, ${duplicates} duplicate exacte blocate. ${cars} mașini și ${number(miles)} mile.` : `${imported} PDFs imported, ${duplicates} exact duplicates blocked. ${cars} cars and ${number(miles)} miles.`);
      if (failures.length) setError(failures.join(" | "));
    } finally { setBusy(false); }
  };

  const replacePdf = async () => {
    if (!replacement) return;
    setBusy(true);
    try {
      await savePayslipPdf(replacement.parsed.id, replacement.file); savePayslip(replacement.parsed);
      setSelected(replacement.parsed.id); setExpanded(replacement.parsed.id); setReplacement(null);
      setNotice(language === "ro" ? "PDF-ul corectat a înlocuit versiunea veche." : "The corrected PDF replaced the old version.");
    } catch (value) { setError(value instanceof Error ? value.message : String(value)); }
    finally { setBusy(false); }
  };

  const view = async (item: Payslip) => {
    const file = await getPayslipPdf(item.id);
    if (!file) { setError(language === "ro" ? "PDF-ul original nu este salvat în acest browser." : "The original PDF is not stored in this browser."); return; }
    setViewer({ url: URL.createObjectURL(file), name: item.sourceFiles[0] || "payslip.pdf" });
  };
  const close = () => { if (viewer) URL.revokeObjectURL(viewer.url); setViewer(null); };

  return <>
    <PageHeader title={language === "ro" ? "Verificare fluturași" : "Payslip checker"} subtitle={language === "ro" ? "Rezumat rapid și analiză completă din PDF și datele tale." : "Quick summary and full analysis from the PDF and your data."} action={<label className="primary-button upload-button"><FileUp size={18}/>{busy ? (language === "ro" ? "Se citesc…" : "Reading…") : (language === "ro" ? "Încarcă PDF" : "Upload PDF")}<input type="file" accept="application/pdf" multiple onChange={event => { void upload(event.target.files); event.currentTarget.value = ""; }}/></label>}/>
    {error && <div className="alert red"><AlertTriangle/>{error}</div>}{notice && <div className="alert green"><CheckCircle2/>{notice}</div>}
    {replacement && <ReplacementPreview oldItem={replacement.existing} nextItem={replacement.parsed} language={language} onReplace={() => void replacePdf()} onBack={() => setReplacement(null)}/>} 
    <div className="notice-card"><ShieldCheck/><div><strong>{language === "ro" ? "Controlul rambursărilor" : "Reimbursement control"}</strong><p>{language === "ro" ? "Datele PDF sunt comparate cu joburile și cheltuielile introduse de tine." : "PDF data is compared with your entered jobs and expenses."}</p></div></div>
    <section className="payslip-filter-bar"><label><span>{language === "ro" ? "Lună și an" : "Month and year"}</span><input type="month" value={month} onChange={event => { setMonth(event.target.value); setPage(0); }}/></label><button className="secondary-button" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft size={17}/>{language === "ro" ? "5 anterioare" : "Previous 5"}</button><button className="secondary-button" disabled={(page + 1) * 5 >= filtered.length} onClick={() => setPage(value => value + 1)}>{language === "ro" ? "Următoarele 5" : "Next 5"}<ChevronRight size={17}/></button></section>
    <div className="payslip-tech-shell">
      <aside className="payslip-list-compact">{visible.map(item => { const audit = calculateAudit(item, data); return <button className={active?.id === item.id ? "active" : ""} key={item.id} onClick={() => { setSelected(item.id); setExpanded(""); }}><span>{formatDate(item.weekStart, language)}</span><strong>{money(item.totalPaid)}</strong><small className={audit.verdict === "full" ? "audit-good" : audit.verdict === "unpaid" ? "audit-bad" : "audit-warn"}>{statusLabel(audit.verdict, language)}</small></button>; })}</aside>
      {active ? <div className="payslip-active-panel"><PayslipSummary item={active} data={data} language={language}/><button className="primary-button payslip-more-button" onClick={() => setExpanded(expanded === active.id ? "" : active.id)}>{expanded === active.id ? (language === "ro" ? "Ascunde detaliile" : "Hide details") : (language === "ro" ? "Mai multe detalii" : "More details")}</button>{expanded === active.id && <PayslipDetail item={active} language={language} onView={() => void view(active)} onDelete={() => { void deletePayslipPdf(active.id); removePayslip(active.id); setExpanded(""); }}/>}</div> : <div className="empty">{language === "ro" ? "Nu există PDF-uri în perioada aleasă." : "No PDFs in the selected period."}</div>}
    </div>
    {viewer && <div className="pdf-modal" role="dialog" aria-modal="true"><div className="pdf-modal-panel"><header><strong>{viewer.name}</strong><nav><a className="secondary-button" href={viewer.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{language === "ro" ? "Deschide" : "Open"}</a><a className="secondary-button" href={viewer.url} download={viewer.name}><Download size={17}/>{language === "ro" ? "Descarcă" : "Download"}</a><button className="icon-button" onClick={close}><X/></button></nav></header><iframe src={viewer.url} title={viewer.name}/></div></div>}
  </>;
}

function PayslipSummary({ item, data, language }: { item: Payslip; data: AppData; language: "ro" | "en" }) {
  const audit = calculateAudit(item, data);
  return <section className="payslip-summary-card">
    <div className="payslip-summary-head"><div><span className="eyebrow">{formatDate(item.weekStart, language)} - {formatDate(addDays(item.weekStart, 6), language)}</span><h2>{item.sourceFiles.join(", ")}</h2></div><span className={`payslip-verdict-chip ${audit.verdict}`}>{statusLabel(audit.verdict, language)}</span></div>
    <div className="payslip-summary-grid">
      <div><span>{language === "ro" ? "Total primit" : "Total received"}</span><strong>{money(item.totalPaid)}</strong></div>
      <div><span>{language === "ro" ? "Mașini" : "Cars"}</span><strong>{audit.pdfRows.length}</strong></div>
      <div><span>{language === "ro" ? "Mile PDF" : "PDF miles"}</span><strong>{number(audit.pdfMiles)} mi</strong></div>
      <div><span>{language === "ro" ? "Plata joburilor" : "Job payment"}</span><strong>{money(item.deliveriesPaid ?? 0)}</strong></div>
      <div><span>{language === "ro" ? "Cheltuieli rambursate" : "Expenses reimbursed"}</span><strong>{money(item.expensesPaid)}</strong></div>
      <div><span>{language === "ro" ? "Calculul tău" : "Your calculation"}</span><strong>{money(audit.expectedTotal)}</strong></div>
      <div className={Math.abs(audit.difference) > .02 ? "summary-difference warn" : "summary-difference good"}><span>{language === "ro" ? "Diferență" : "Difference"}</span><strong>{money(audit.difference)}</strong></div>
    </div>
  </section>;
}

function ReplacementPreview({ oldItem, nextItem, language, onReplace, onBack }: { oldItem: Payslip; nextItem: Payslip; language: "ro" | "en"; onReplace: () => void; onBack: () => void }) {
  const oldRows = oldItem.pdfExpenses ?? []; const nextRows = nextItem.pdfExpenses ?? [];
  const added = nextRows.filter(row => !oldRows.some(old => old.jobRef === row.jobRef && old.description === row.description && Math.abs(old.uploaded - row.uploaded) < .01)).length;
  const reimbursed = nextRows.filter(row => !isCompanyFuelPdfRow(row) && row.payable + .01 >= row.uploaded && row.uploaded > 0).length;
  const remaining = nextRows.filter(row => !isCompanyFuelPdfRow(row) && (row.needsCheck || row.payable + .01 < row.uploaded)).length;
  return <section className="replacement-preview"><h2>{language === "ro" ? "PDF corectat detectat" : "Corrected PDF detected"}</h2><p>{language === "ro" ? "Aceeași săptămână, fișier diferit. Verifică diferențele înainte de înlocuire." : "Same week, different file. Review changes before replacement."}</p><div className="replacement-grid"><div><span>{language === "ro" ? "Cheltuieli noi" : "Added expenses"}</span><strong>{added}</strong></div><div><span>{language === "ro" ? "Acum rambursate" : "Now reimbursed"}</span><strong>{reimbursed}</strong></div><div><span>{language === "ro" ? "Diferență total" : "Total difference"}</span><strong>{money(nextItem.totalPaid - oldItem.totalPaid)}</strong></div><div><span>{language === "ro" ? "Probleme rămase" : "Remaining issues"}</span><strong>{remaining}</strong></div></div><div className="form-actions"><button className="primary-button" onClick={onReplace}>{language === "ro" ? "Înlocuiește PDF" : "Replace PDF"}</button><button className="secondary-button" onClick={onBack}>{language === "ro" ? "Înapoi" : "Back"}</button></div></section>;
}

function PayslipDetail({ item, language, onView, onDelete }: { item: Payslip; language: "ro" | "en"; onView: () => void; onDelete: () => void }) {
  const { data, saveExpenses, setWeekComplete } = useData();
  const audit = calculateAudit(item, data);
  const [carPage, setCarPage] = useState(0);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const complete = (data.completedWeeks ?? []).includes(item.weekStart);
  const resolved = audit.expenses.every(row => statusFor(row) !== "review");
  const update = (expense: Expense, patch: Partial<Expense>) => saveExpenses([{ ...expense, ...patch }]);
  const pageRows = audit.pdfRows.slice(carPage * 10, carPage * 10 + 10);
  const grouped = pageRows.reduce<Record<string, PayslipJob[]>>((result, row) => { const date = row.date || item.weekStart; (result[date] ??= []).push(row); return result; }, {});
  const modalRow = modalIndex === null ? null : audit.pdfRows[modalIndex];

  return <section className="payslip-detail">
    <div className="section-title"><div><span className="eyebrow">{formatDate(item.weekStart, language)} - {formatDate(addDays(item.weekStart, 6), language)}</span><h2>{language === "ro" ? "Analiză completă" : "Full analysis"}</h2></div><div className="payslip-actions"><button className="secondary-button" onClick={onView}><Eye size={17}/>{language === "ro" ? "Vezi PDF" : "View PDF"}</button><button className="icon-button danger" onClick={() => { if (confirm(language === "ro" ? "Ștergi acest fluturaș?" : "Delete this payslip?")) onDelete(); }}><Trash2 size={18}/></button></div></div>
    <FinancialBreakdown item={item} audit={audit} language={language}/>
    <section className="payslip-analysis-section"><div className="section-title compact"><div><h3>{language === "ro" ? "Cheltuieli și rambursări" : "Expenses and reimbursements"}</h3><p>{language === "ro" ? "Motivul companiei este afișat exact cum apare în PDF." : "The company reason is shown exactly as written in the PDF."}</p></div></div><PdfExpenseTable rows={item.pdfExpenses ?? []} expenses={audit.expenses} language={language}/></section>
    <section className="payslip-analysis-section"><div className="section-title compact"><div><h3>{language === "ro" ? "Controlul cheltuielilor tale" : "Your expense controls"}</h3><p>{audit.expenses.length} {language === "ro" ? "cheltuieli introduse" : "entered expenses"}</p></div></div>{audit.expenses.length ? <div className="expense-audit-list">{audit.expenses.map(expense => { const current = statusFor(expense); const transport = ["Bus", "Train"].includes(expense.category); return <article className="expense-audit-card" key={expense.id}><div><strong>{expense.category} · {money(expense.actualCost)}</strong><small>{expense.jobRef} · {formatDate(expense.date, language)}</small></div>{expense.category === "Taxi" ? <input placeholder={language === "ro" ? "Cod RAS" : "RAS code"} value={expense.rasCode ?? ""} onChange={event => update(expense, { rasCode: event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() })}/> : <label className="check"><input type="checkbox" checked={transport ? Boolean(expense.hasTicket) : expense.receipt} onChange={event => update(expense, transport ? { hasTicket: event.target.checked } : { receipt: event.target.checked })}/>{transport ? (language === "ro" ? "Am biletul" : "I have the ticket") : (language === "ro" ? "Am chitanța" : "I have the receipt")}</label>}<select value={current} onChange={event => update(expense, { reimbursementOverride: event.target.value as ReimbursementStatus, correctedByUser: true })}><option value="review">{statusLabel("review", language)}</option><option value="full">{statusLabel("full", language)}</option><option value="partial">{statusLabel("partial", language)}</option><option value="unpaid">{statusLabel("unpaid", language)}</option></select><label className="check"><input type="checkbox" checked={Boolean(expense.resubmittedToOffice)} onChange={event => update(expense, { resubmittedToOffice: event.target.checked })}/>{language === "ro" ? "Retrimis la birou" : "Resubmitted to office"}</label>{expense.correctedByUser && <small>{language === "ro" ? "Corectat de utilizator" : "Corrected by user"}</small>}</article>; })}</div> : <div className="empty">{language === "ro" ? "Nu există cheltuieli personale pentru această săptămână." : "No personal expenses for this week."}</div>}</section>
    <section className="payslip-analysis-section"><div className="section-title compact"><div><h3>{language === "ro" ? "Mașinile din Payslip" : "Payslip cars"}</h3><p>{language === "ro" ? "Ultima livrare apare prima. Apasă Detalii pentru comparația completă." : "Latest delivery appears first. Open Details for the full comparison."}</p></div><strong>{audit.pdfRows.length}</strong></div>{audit.pdfRows.length ? <><div className="payslip-car-groups">{Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, rows]) => <div className="payslip-day-group" key={date}><h4>{formatDate(date, language)}</h4>{rows.map(row => { const absoluteIndex = audit.pdfRows.indexOf(row); return <article className="payslip-car-row" key={`${row.jobRef}-${row.registration}-${absoluteIndex}`}><div><strong>{row.jobRef || "—"}</strong><span>{row.registration || "—"}</span></div><div><span>{number(row.miles)} mi</span><strong>{money(row.paid)}</strong></div><button className="secondary-button" onClick={() => setModalIndex(absoluteIndex)}>{language === "ro" ? "Detalii" : "Details"}</button></article>; })}</div>)}</div><div className="payslip-car-pagination"><button className="secondary-button" disabled={carPage === 0} onClick={() => setCarPage(value => Math.max(0, value - 1))}><ChevronLeft size={17}/>{language === "ro" ? "10 anterioare" : "Previous 10"}</button><span>{carPage + 1} / {Math.max(1, Math.ceil(audit.pdfRows.length / 10))}</span><button className="secondary-button" disabled={(carPage + 1) * 10 >= audit.pdfRows.length} onClick={() => setCarPage(value => value + 1)}>{language === "ro" ? "Următoarele 10" : "Next 10"}<ChevronRight size={17}/></button></div></> : <div className="empty">{language === "ro" ? "PDF-ul nu conține mașini recunoscute." : "The PDF contains no recognised cars."}</div>}</section>
    <div className="form-actions"><button className="primary-button" disabled={!resolved && !complete} onClick={() => setWeekComplete(item.weekStart, !complete)}>{complete ? (language === "ro" ? "Redeschide săptămâna" : "Reopen week") : (language === "ro" ? "Confirmă săptămâna" : "Confirm week")}</button>{!resolved && <small className="warn-text">{language === "ro" ? "Rezolvă toate cheltuielile înainte de confirmare." : "Resolve every expense before confirmation."}</small>}</div>
    {modalRow && modalIndex !== null && <CarDetailModal row={modalRow} appJob={findAppJob(modalRow, audit.weekJobs)} expenses={audit.expenses.filter(expense => key(expense.jobRef) === key(modalRow.jobRef))} language={language} position={modalIndex + 1} total={audit.pdfRows.length} onClose={() => setModalIndex(null)} onPrevious={() => setModalIndex(value => value === null ? 0 : Math.max(0, value - 1))} onNext={() => setModalIndex(value => value === null ? 0 : Math.min(audit.pdfRows.length - 1, value + 1))}/>} 
  </section>;
}

function FinancialBreakdown({ item, audit, language }: { item: Payslip; audit: Audit; language: "ro" | "en" }) {
  const lines = [
    [language === "ro" ? "Plată joburi" : "Job payments", audit.jobBase, item.deliveriesPaid ?? 0],
    [language === "ro" ? "Waiting time" : "Waiting time", audit.waiting, audit.weekJobs.reduce((sum, job) => sum + (job.waitingPaid ?? 0), 0)],
    [`Reward ${audit.rewardPercent}% / PDF ${item.rewardPercent}%`, audit.expectedReward, item.rewardPaid],
    [language === "ro" ? "Cheltuieli" : "Expenses", audit.claimed, item.expensesPaid],
    [language === "ro" ? "Bonus" : "Bonus", item.bonusPaid, item.bonusPaid],
    [language === "ro" ? "Deduceri" : "Deductions", -item.deductions, -item.deductions],
    [language === "ro" ? "Taxă administrativă" : "Administration fee", -item.adminFee, -item.adminFee]
  ] as Array<[string, number, number]>;
  return <section className="payslip-analysis-section"><div className="section-title compact"><div><h3>{language === "ro" ? "Totaluri și comparație" : "Totals and comparison"}</h3><p>{language === "ro" ? "Datele tale față de valorile extrase din PDF." : "Your data against values extracted from the PDF."}</p></div></div><div className="payslip-breakdown-head"><span>{language === "ro" ? "Categorie" : "Category"}</span><span>{language === "ro" ? "Datele mele" : "My data"}</span><span>PDF</span><span>{language === "ro" ? "Diferență" : "Difference"}</span></div><div className="payslip-breakdown-list">{lines.map(([label, mine, pdf]) => <div key={label}><span>{label}</span><strong>{money(mine)}</strong><strong>{money(pdf)}</strong><strong className={Math.abs(pdf - mine) > .02 ? "warn-text" : "good"}>{money(pdf - mine)}</strong></div>)}</div><div className="payslip-breakdown-total"><span>Total</span><strong>{money(audit.expectedTotal)}</strong><strong>{money(item.totalPaid)}</strong><strong className={Math.abs(audit.difference) > .02 ? "warn-text" : "good"}>{money(audit.difference)}</strong></div><div className="payslip-data-facts"><span>{language === "ro" ? "Mașini aplicație" : "App cars"}: <strong>{audit.weekJobs.length}</strong></span><span>{language === "ro" ? "Mașini PDF" : "PDF cars"}: <strong>{audit.pdfRows.length}</strong></span><span>{language === "ro" ? "Mile aplicație" : "App miles"}: <strong>{number(audit.appMiles)}</strong></span><span>{language === "ro" ? "Mile PDF" : "PDF miles"}: <strong>{number(audit.pdfMiles)}</strong></span><span>{language === "ro" ? "Control intern PDF" : "PDF internal check"}: <strong>{money(audit.internalDifference)}</strong></span></div></section>;
}

function PdfExpenseTable({ rows, expenses, language }: { rows: PayslipExpense[]; expenses: Expense[]; language: "ro" | "en" }) {
  const visible = rows.filter(row => !isCompanyFuelPdfRow(row));
  if (!visible.length) return <div className="empty">{language === "ro" ? "PDF-ul nu conține cheltuieli personale recunoscute." : "The PDF contains no recognised personal expenses."}</div>;
  return <div className="payslip-expense-list">{visible.map((row, index) => { const matched = expenses.find(expense => key(expense.jobRef) === key(row.jobRef) && Math.abs(expense.actualCost - row.uploaded) < .01); const shortfall = row.uploaded - row.payable; return <article className={shortfall > .01 ? "has-shortfall" : "paid-full"} key={`${row.jobRef}-${row.date}-${index}`}><div><strong>{row.description || (language === "ro" ? "Cheltuială" : "Expense")}</strong><small>{formatDate(row.date, language)} · {row.jobRef || "—"}</small></div><div><span>{language === "ro" ? "Cerut" : "Uploaded"}</span><strong>{money(row.uploaded)}</strong></div><div><span>{language === "ro" ? "Plătit" : "Paid"}</span><strong>{money(row.payable)}</strong></div><div><span>{language === "ro" ? "Lipsă" : "Missing"}</span><strong>{money(Math.max(0, shortfall))}</strong></div><p><span>{language === "ro" ? "Motiv PDF" : "PDF reason"}</span><strong>{expenseReason(row)}</strong></p>{matched && <small className="expense-match">{language === "ro" ? "Potrivit cu cheltuiala introdusă în aplicație" : "Matched with the expense entered in the app"}</small>}</article>; })}</div>;
}

function CarDetailModal({ row, appJob, expenses, language, position, total, onClose, onPrevious, onNext }: { row: PayslipJob; appJob?: Job; expenses: Expense[]; language: "ro" | "en"; position: number; total: number; onClose: () => void; onPrevious: () => void; onNext: () => void }) {
  const appMiles = appJob ? jobMiles(appJob) : null;
  const expected = appJob ? tariffForMiles(appMiles ?? 0) + (appJob.waitingEstimated ?? 0) : null;
  const milesDifference = appMiles === null ? null : row.miles - appMiles;
  const payDifference = expected === null ? null : row.paid - expected;
  return <div className="car-detail-backdrop" role="dialog" aria-modal="true" aria-label={language === "ro" ? "Detalii mașină" : "Car details"} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><section className="car-detail-modal"><header><div><span className="eyebrow">{position} / {total}</span><h2>{row.registration || row.jobRef || (language === "ro" ? "Mașină" : "Car")}</h2><p>{formatDate(row.date, language)} · {row.jobRef || "—"}</p></div><button className="icon-button" onClick={onClose} aria-label={language === "ro" ? "Închide" : "Close"}><X/></button></header><div className="car-detail-columns"><section><h3>{language === "ro" ? "Date din PDF" : "PDF data"}</h3><Detail label="Job Ref" value={row.jobRef || "—"}/><Detail label={language === "ro" ? "Înmatriculare" : "Registration"} value={row.registration || "—"}/><Detail label={language === "ro" ? "Rută sau descriere" : "Route or description"} value={row.description || "—"}/><Detail label={language === "ro" ? "Mile plătite" : "Paid miles"} value={`${number(row.miles)} mi`}/><Detail label={language === "ro" ? "Sumă plătită" : "Paid amount"} value={money(row.paid)}/></section><section><h3>{language === "ro" ? "Datele mele" : "My data"}</h3>{appJob ? <><Detail label={language === "ro" ? "Model" : "Model"} value={appJob.makeModel || "—"}/><Detail label={language === "ro" ? "Rută" : "Route"} value={`${appJob.pickupTown || "?"} → ${appJob.deliveryTown || "?"}`}/><Detail label={language === "ro" ? "Mile reale" : "Actual miles"} value={`${number(appMiles ?? 0)} mi`}/><Detail label={language === "ro" ? "Tarif calculat" : "Calculated tariff"} value={money(expected ?? 0)}/><Detail label={language === "ro" ? "Waiting time" : "Waiting time"} value={money(appJob.waitingEstimated ?? appJob.waitingPaid ?? 0)}/><Detail label={language === "ro" ? "Ora livrării" : "Delivery time"} value={appJob.deliveryTime || "—"}/></> : <div className="empty compact">{language === "ro" ? "Nu există un job corespunzător în aplicație." : "No matching job exists in the app."}</div>}</section></div><div className="car-comparison"><div><span>{language === "ro" ? "Diferență mile" : "Miles difference"}</span><strong>{milesDifference === null ? "—" : `${number(milesDifference)} mi`}</strong></div><div><span>{language === "ro" ? "Diferență plată" : "Payment difference"}</span><strong>{payDifference === null ? "—" : money(payDifference)}</strong></div><div><span>{language === "ro" ? "Cheltuieli asociate" : "Linked expenses"}</span><strong>{money(expenses.reduce((sum, expense) => sum + expense.actualCost, 0))}</strong></div></div>{expenses.length > 0 && <div className="car-linked-expenses"><h3>{language === "ro" ? "Cheltuieli pentru acest Job Ref" : "Expenses for this Job Ref"}</h3>{expenses.map(expense => <div key={expense.id}><span>{expense.category}</span><strong>{money(expense.actualCost)}</strong><small>{statusLabel(statusFor(expense), language)}</small></div>)}</div>}<footer><button className="secondary-button" disabled={position <= 1} onClick={onPrevious}><ChevronLeft size={17}/>{language === "ro" ? "Anterioară" : "Previous"}</button><button className="secondary-button" onClick={onClose}>{language === "ro" ? "Închide" : "Close"}</button><button className="secondary-button" disabled={position >= total} onClick={onNext}>{language === "ro" ? "Următoare" : "Next"}<ChevronRight size={17}/></button></footer></section></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="car-detail-line"><span>{label}</span><strong>{value}</strong></div>; }
