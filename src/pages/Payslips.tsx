import { AlertTriangle, CarFront, CheckCircle2, Download, Eye, ExternalLink, FileUp, ListChecks, ShieldCheck, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { addDays, formatDate, mondayOf } from "../lib/date";
import { jobMiles } from "../lib/analytics";
import { tariffForMiles } from "../lib/rates";
import { extractPdfText, hashPdfFile, parsePayslipText } from "../lib/payslipPdf";
import { deletePayslipPdf, getPayslipPdf, savePayslipPdf } from "../lib/pdfStore";
import type { Payslip } from "../types";

const companyTotal = (payslip: Payslip) => (payslip.deliveriesPaid ?? 0) + payslip.rewardPaid + payslip.expensesPaid + payslip.bonusPaid - payslip.deductions - payslip.adminFee;

export function PayslipsPage() {
  const { data, language, savePayslip, removePayslip } = useData();
  const t = tFor(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState("");
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);
  const payslips = useMemo(() => [...data.payslips].sort((a,b) => b.weekStart.localeCompare(a.weekStart)), [data.payslips]);
  const selectedPayslip = payslips.find(payslip => payslip.id === selected) ?? payslips[0];

  const upload = async (fileList: FileList | null) => {
    const files = [...(fileList ?? [])];
    if (!files.length) return;
    setBusy(true); setError(""); setNotice("");
    const knownHashes = new Set(data.payslips.map(payslip => payslip.fileHash).filter((value): value is string => Boolean(value)));
    const knownWeeks = new Set(data.payslips.map(payslip => payslip.weekStart));
    let imported = 0;
    let duplicates = 0;
    let importedCars = 0;
    let importedMiles = 0;
    const failures: string[] = [];
    let lastId = "";
    try {
      for (const file of files) {
        try {
          const fileHash = await hashPdfFile(file);
          if (knownHashes.has(fileHash)) { duplicates += 1; continue; }
          const text = await extractPdfText(file);
          const parsed = { ...parsePayslipText(text, file.name), fileHash };
          if (knownWeeks.has(parsed.weekStart)) { duplicates += 1; continue; }
          await savePayslipPdf(parsed.id, file);
          savePayslip(parsed);
          knownHashes.add(fileHash);
          knownWeeks.add(parsed.weekStart);
          imported += 1;
          importedCars += parsed.pdfJobs?.length ?? 0;
          importedMiles += (parsed.pdfJobs ?? []).reduce((total, row) => total + row.miles, 0);
          lastId = parsed.id;
        } catch (uploadError) {
          failures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        }
      }
      if (lastId) setSelected(lastId);
      if (imported || duplicates) setNotice(language === "ro"
        ? `${imported} PDF-uri importate, ${duplicates} duplicate blocate. Am găsit ${importedCars} mașini și ${number(importedMiles)} mile.`
        : `${imported} PDFs imported, ${duplicates} duplicates blocked. Found ${importedCars} cars and ${number(importedMiles)} miles.`);
      if (failures.length) setError(failures.join(" | "));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : String(uploadError));
    } finally { setBusy(false); }
  };

  const viewPdf = async (payslip: Payslip) => {
    setError("");
    const file = await getPayslipPdf(payslip.id);
    if (!file) {
      setError(language === "ro" ? "PDF-ul original nu este salvat în acest browser. Încarcă-l din nou pentru a-l vizualiza aici." : "The original PDF is not saved in this browser. Upload it again to view it here.");
      return;
    }
    setViewer({ url: URL.createObjectURL(file), name: payslip.sourceFiles[0] || "payslip.pdf" });
  };

  const closeViewer = () => {
    if (viewer) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  };

  return <>
    <PageHeader title={language === "ro" ? "Verificare fluturași" : "Payslip checker"} subtitle={language === "ro" ? "Selectează unul sau mai multe PDF-uri. Fișierele și săptămânile duplicate sunt blocate automat." : "Select one or more PDFs. Duplicate files and weeks are blocked automatically."} action={<label className="primary-button upload-button"><FileUp size={18}/>{busy ? (language === "ro" ? "Se citesc…" : "Reading…") : (language === "ro" ? "Încarcă PDF-uri" : "Upload PDFs")}<input type="file" accept="application/pdf" multiple onChange={event => { void upload(event.target.files); event.currentTarget.value = ""; }}/></label>}/>
    {error && <div className="alert red"><AlertTriangle/>{error}</div>}
    {notice && <div className="alert green"><CheckCircle2/>{notice}<span className="alert-links"><Link to="/reports">{language === "ro" ? "Vezi rapoartele" : "View reports"}</Link><Link to="/tax">{language === "ro" ? "Vezi VAT" : "View VAT"}</Link></span></div>}
    <div className="notice-card"><ShieldCheck/><div><strong>{language === "ro" ? "Control transparent al plății" : "Transparent payment check"}</strong><p>{language === "ro" ? "Săptămânile incomplete nu afișează pierderi. Confirmă săptămâna după ce ai introdus toate Job Ref-urile." : "Incomplete weeks do not show losses. Confirm the week after entering every Job Ref."}</p></div></div>
    <div className="payslip-layout">
      <aside className="payslip-list">{payslips.map(payslip => {
        const complete = (data.completedWeeks ?? []).includes(payslip.weekStart);
        const identityDifference = payslip.totalPaid - companyTotal(payslip);
        return <button className={selectedPayslip?.id === payslip.id ? "active" : ""} key={payslip.id} onClick={() => setSelected(payslip.id)}><span>{t("weekOf")} {formatDate(payslip.weekStart, language)}</span><strong>{money(payslip.totalPaid)}</strong><small className={!complete ? "warn-text" : Math.abs(identityDifference) > 0.02 ? "bad" : "good"}>{!complete ? (language === "ro" ? "INCOMPLETĂ" : "INCOMPLETE") : Math.abs(identityDifference) <= 0.02 ? "PDF ✓" : `${money(identityDifference)} PDF`}</small></button>;
      })}</aside>
      {selectedPayslip ? <PayslipDetail payslip={selectedPayslip} onView={() => viewPdf(selectedPayslip)} onDelete={() => { void deletePayslipPdf(selectedPayslip.id); removePayslip(selectedPayslip.id); }} language={language}/> : <div className="empty">{language === "ro" ? "Încarcă primul fluturaș PDF." : "Upload your first payslip PDF."}</div>}
    </div>
    {viewer && <div className="pdf-modal" role="dialog" aria-modal="true" aria-label={viewer.name}>
      <div className="pdf-modal-panel">
        <header><div><strong>{viewer.name}</strong><small>{language === "ro" ? "Vizualizare PDF în aplicație" : "PDF viewer inside the app"}</small></div><nav><a className="secondary-button" href={viewer.url} target="_blank" rel="noreferrer"><ExternalLink size={17}/>{language === "ro" ? "Deschide separat" : "Open separately"}</a><a className="secondary-button" href={viewer.url} download={viewer.name}><Download size={17}/>{language === "ro" ? "Descarcă" : "Download"}</a><button className="icon-button" type="button" onClick={closeViewer} aria-label={language === "ro" ? "Închide" : "Close"}><X/></button></nav></header>
        <iframe src={viewer.url} title={viewer.name}/>
      </div>
    </div>}
  </>;
}

function PayslipDetail({ payslip, onView, onDelete, language }: { payslip: Payslip; onView: () => void; onDelete: () => void; language: "ro" | "en" }) {
  const { data } = useData();
  const end = addDays(payslip.weekStart, 6);
  const complete = (data.completedWeeks ?? []).includes(payslip.weekStart);
  const jobs = data.jobs.filter(job => job.status === "delivered" && mondayOf(job.deliveryDate) === payslip.weekStart);
  const expenses = data.expenses.filter(expense => expense.weekStart === payslip.weekStart);
  const baseExpected = jobs.reduce((sum, job) => sum + tariffForMiles(jobMiles(job)), 0) + jobs.reduce((sum, job) => sum + (job.waitingEstimated ?? job.waitingPaid ?? 0), 0);
  const claimed = expenses.reduce((sum, expense) => sum + expense.claimed, 0);
  const timedJobs = jobs.filter(job => job.firstDeliveryBefore9 !== null);
  const workedDays = new Set(jobs.map(job => job.deliveryDate)).size;
  const onTimeDays = new Set(timedJobs.filter(job => job.firstDeliveryBefore9).map(job => job.deliveryDate)).size;
  const ratio = workedDays ? onTimeDays / workedDays : 0;
  const ownRewardPercent = timedJobs.length ? ratio >= 1 ? 20 : ratio >= .75 ? 15 : ratio >= .5 ? 10 : 0 : payslip.rewardPercent;
  const expectedReward = baseExpected * ownRewardPercent / 100;
  const personalTotal = baseExpected + expectedReward + claimed + payslip.bonusPaid - payslip.deductions - payslip.adminFee;
  const paidDifference = payslip.totalPaid - personalTotal;
  const pdfTotal = companyTotal(payslip);
  const pdfDifference = payslip.totalPaid - pdfTotal;
  const pdfRows = payslip.pdfJobs ?? [];
  const pdfMiles = pdfRows.reduce((total, row) => total + row.miles, 0);
  const pdfJobPayments = pdfRows.reduce((total, row) => total + row.paid, 0);
  const duplicateRefs = [...new Set(pdfRows.filter((row, index) => pdfRows.findIndex(candidate => candidate.jobRef === row.jobRef) !== index).map(row => row.jobRef))];
  const missingJobRefs = pdfRows.filter(row => !row.jobRef.trim()).length;
  const missingRegistrations = pdfRows.filter(row => !row.registration.trim()).length;
  const missingMiles = pdfRows.filter(row => !row.miles).length;
  const issues = (payslip.pdfJobs ?? []).map(row => {
    const own = jobs.find(job => job.jobRef === row.jobRef || (job.registration && job.registration === row.registration));
    const expected = own ? tariffForMiles(jobMiles(own)) : null;
    return { ...row, expected, difference: expected === null ? null : row.paid - expected };
  }).filter(row => row.expected === null || Math.abs(row.difference ?? 0) > 0.01);

  return <section className="payslip-detail">
    <div className="section-title"><div><span className="eyebrow">{formatDate(payslip.weekStart, language)} to {formatDate(end, language)}</span><h2>{payslip.sourceFiles.join(", ")}</h2></div><div className="payslip-actions"><button className="secondary-button" type="button" onClick={onView}><Eye size={17}/>{language === "ro" ? "Vezi PDF" : "View PDF"}</button><button className="icon-button danger" onClick={() => { if (confirm(language === "ro" ? "Ștergi acest fluturaș?" : "Delete this payslip?")) onDelete(); }}><Trash2 size={18}/></button></div></div>
    <div className="pdf-import-audit">
      <div className="pdf-audit-title"><ListChecks/><div><strong>{language === "ro" ? "Verificarea completă a PDF-ului" : "Complete PDF verification"}</strong><span>{Math.abs(pdfDifference) <= 0.02 ? (language === "ro" ? "Totalul intern al PDF-ului este corect" : "The PDF internal total is correct") : (language === "ro" ? `Diferență internă: ${money(pdfDifference)}` : `Internal difference: ${money(pdfDifference)}`)}</span></div></div>
      <div className="pdf-audit-grid"><div><CarFront/><span>{language === "ro" ? "Mașini" : "Cars"}</span><strong>{pdfRows.length}</strong></div><div><span>{language === "ro" ? "Mile directe" : "Direct miles"}</span><strong>{number(pdfMiles)}</strong></div><div><span>{language === "ro" ? "Plată joburi" : "Job payments"}</span><strong>{money(pdfJobPayments || (payslip.deliveriesPaid ?? 0))}</strong></div><div><span>{language === "ro" ? "Total primit" : "Total received"}</span><strong>{money(payslip.totalPaid)}</strong></div></div>
      <div className="pdf-audit-flags"><span className={duplicateRefs.length || missingJobRefs || missingMiles ? "warn" : "good"}>{duplicateRefs.length ? `${language === "ro" ? "Job Ref duplicate" : "Duplicate Job Ref"}: ${duplicateRefs.join(", ")}` : missingJobRefs ? `${missingJobRefs} ${language === "ro" ? "joburi fără Job Ref" : "jobs without Job Ref"}` : missingMiles ? `${missingMiles} ${language === "ro" ? "joburi fără mile" : "jobs without miles"}` : (language === "ro" ? "Job Ref și mile verificate" : "Job Ref and miles checked")}</span>{missingRegistrations > 0 && <span className="warn">{missingRegistrations} {language === "ro" ? "mașini fără înmatriculare în PDF" : "cars without registration in PDF"}</span>}
      </div>
    </div>
    {!complete ? <div className="verdict warn"><AlertTriangle/><div><strong>{language === "ro" ? "Săptămână incompletă. Diferența și pierderea sunt ascunse." : "Incomplete week. Difference and loss are hidden."}</strong><span>{language === "ro" ? "Adaugă toate joburile și confirmă săptămâna completă." : "Add every job and confirm the week is complete."}</span></div><Link className="secondary-button" to="/catch-up">{language === "ro" ? "Adaugă joburi" : "Add jobs"}</Link></div> : <>
      <div className={`verdict ${Math.abs(paidDifference) > 10 ? "bad" : Math.abs(paidDifference) > 0.02 ? "warn" : "good"}`}>{Math.abs(paidDifference) > 10 ? <AlertTriangle/> : <CheckCircle2/>}<div><strong>{Math.abs(paidDifference) <= 0.02 ? (language === "ro" ? "Plata corespunde calculelor tale" : "Payment matches your calculation") : paidDifference < 0 ? (language === "ro" ? `Posibil lipsesc ${money(Math.abs(paidDifference))}` : `Possible underpayment of ${money(Math.abs(paidDifference))}`) : (language === "ro" ? `Compania a plătit cu ${money(paidDifference)} mai mult` : `Company paid ${money(paidDifference)} more`)}</strong><span>{language === "ro" ? "Prag alertă: £10" : "Alert threshold: £10"}</span></div></div>
      <div className="compare-grid"><div><span>{language === "ro" ? "Calculul tău" : "Your calculation"}</span><strong>{money(personalTotal)}</strong></div><div><span>{language === "ro" ? "Plata PDF" : "PDF payment"}</span><strong>{money(payslip.totalPaid)}</strong></div><div><span>{language === "ro" ? "Diferență" : "Difference"}</span><strong className={Math.abs(paidDifference) > 10 ? "bad" : ""}>{money(paidDifference)}</strong></div></div>
      <div className="formula-card"><h3>{language === "ro" ? "Comparația cu datele tale" : "Comparison with your data"}</h3><Formula label={language === "ro" ? `Tarife ${jobs.length} joburi și waiting` : `Rates for ${jobs.length} jobs and waiting`} mine={baseExpected} company={payslip.deliveriesPaid ?? 0}/><Formula label={`Reward ${ownRewardPercent}% / PDF ${payslip.rewardPercent}%`} mine={expectedReward} company={payslip.rewardPaid}/><Formula label={language === "ro" ? `Cheltuieli cerute (${expenses.length})` : `Claimed expenses (${expenses.length})`} mine={claimed} company={payslip.expensesPaid}/></div>
      {issues.length > 0 && <div className="issues"><h3>{language === "ro" ? "Diferențe job cu job" : "Job-by-job differences"}</h3>{issues.slice(0,15).map(row => <div key={`${row.jobRef}-${row.registration}`}><span><strong>{row.jobRef}</strong> · {row.registration || (language === "ro" ? "fără înmatriculare" : "no registration")} · {row.miles} mi</span><span>{row.expected === null ? (language === "ro" ? "Nu există în aplicație" : "Missing in app") : `${money(row.expected)} → ${money(row.paid)} (${money(row.difference ?? 0)})`}</span></div>)}</div>}
    </>}
    <div className="pdf-car-list"><div className="section-title"><div><h3>{language === "ro" ? "Toate mașinile din PDF" : "All cars from the PDF"}</h3><p>{language === "ro" ? "Aceste joburi au fost adăugate automat în Istoric și pot fi editate." : "These jobs were added to History automatically and can be edited."}</p></div><Link className="secondary-button" to="/history">{language === "ro" ? "Editează mașinile" : "Edit cars"}</Link></div>{pdfRows.length ? <div className="pdf-car-table"><div className="head"><span>{language === "ro" ? "Data" : "Date"}</span><span>Job Ref</span><span>{language === "ro" ? "Înmatriculare" : "Registration"}</span><span>{language === "ro" ? "Rută / descriere" : "Route / description"}</span><span>{language === "ro" ? "Mile" : "Miles"}</span><span>{language === "ro" ? "Plătit" : "Paid"}</span></div>{pdfRows.map((row, index) => <div key={`${row.jobRef}-${row.date}-${index}`}><span>{formatDate(row.date, language)}</span><strong>{row.jobRef || "—"}</strong><span className={row.registration ? "reg-mini" : "warn-text"}>{row.registration || (language === "ro" ? "Lipsește" : "Missing")}</span><span>{row.description || "—"}</span><span>{number(row.miles)} mi</span><strong>{money(row.paid)}</strong></div>)}</div> : <div className="empty">{language === "ro" ? "PDF-ul nu conține rânduri de job recunoscute." : "The PDF contains no recognised job rows."}</div>}</div>
    <div className="formula-card pdf-check"><h3>{language === "ro" ? "Verificarea internă a PDF-ului" : "PDF internal calculation"}</h3><div className="pdf-line"><span>{language === "ro" ? "Livrări" : "Deliveries"}</span><strong>{money(payslip.deliveriesPaid ?? 0)}</strong></div><div className="pdf-line"><span>Reward</span><strong>{money(payslip.rewardPaid)}</strong></div><div className="pdf-line"><span>{language === "ro" ? "Cheltuieli" : "Expenses"}</span><strong>{money(payslip.expensesPaid)}</strong></div><div className="pdf-line"><span>{language === "ro" ? "Bonus, deduceri și administrare" : "Bonus, deductions and administration"}</span><strong>{money(payslip.bonusPaid - payslip.deductions - payslip.adminFee)}</strong></div><div className="formula-total"><span>Total</span><strong className={Math.abs(pdfDifference) > 0.02 ? "bad" : "good"}>{money(pdfTotal)} → {money(payslip.totalPaid)} {Math.abs(pdfDifference) <= 0.02 ? "✓" : `(${money(pdfDifference)})`}</strong></div></div>
    <div className="payslip-facts"><span>{payslip.deliveriesReported} {language === "ro" ? "livrări în PDF" : "PDF deliveries"}</span><span>{number(jobs.reduce((sum, job) => sum + jobMiles(job), 0))} {language === "ro" ? "mile introduse" : "entered miles"}</span><span>{payslip.onTimeReported ?? "—"} {language === "ro" ? "la timp raportate" : "reported on time"}</span><span>{payslip.adminDays} {language === "ro" ? "zile lucrate" : "days worked"}</span></div>
  </section>;
}

function Formula({ label, mine, company }: { label: string; mine: number; company: number }) {
  const difference = company - mine;
  return <div className="formula-row"><span>{label}</span><span>{money(mine)}</span><span>{money(company)}</span><strong className={Math.abs(difference) > 0.02 ? "bad" : "good"}>{money(difference)}</strong></div>;
}
