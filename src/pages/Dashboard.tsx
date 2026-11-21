import { ArrowRight, BrainCircuit, CalendarDays, CalendarRange, Camera, CarFront, CircleDot, FileScan, ListPlus, MapPin, ReceiptPoundSterling, Route, ShieldCheck, Wallet, Zap } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Empty, number, StatusPill } from "../components/Ui";
import { SourceMatrix } from "../components/SourceMatrix";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { addDays, formatDate, mondayOf, todayIso } from "../lib/date";
import { jobMiles } from "../lib/analytics";
import { calculateSourceTotals } from "../lib/sourceTotals";
import { jobRegistrations } from "../lib/jobProtocols";
import { ProtocolBadge } from "../components/ProtocolBadge";
import { VehiclePlate } from "../components/VehiclePlate";

type Scope = "week" | "month" | "all";

export function Dashboard(){
  const { data, language } = useData();
  const t = tFor(language);
  const [date, setDate] = useState(todayIso());
  const [scope, setScope] = useState<Scope>("week");
  const weekStart = mondayOf(date);
  const range = scope === "week"
    ? { start: weekStart, end: addDays(weekStart, 6) }
    : scope === "month"
      ? { start: `${date.slice(0, 7)}-01`, end: `${date.slice(0, 7)}-31` }
      : { start: "2000-01-01", end: "2100-12-31" };
  const totals = useMemo(() => calculateSourceTotals(data, range.start, range.end), [data, range.start, range.end]);
  const dayJobs = data.jobs.filter(job => job.collectionDate === date || job.deliveryDate === date).sort((a,b)=>(a.collectionTime||a.deliveryTime).localeCompare(b.collectionTime||b.deliveryTime));
  const active = data.jobs.filter(job => job.status === "collected").length;
  const pdfCount = data.payslips.filter(payslip => payslip.weekStart >= range.start && payslip.weekStart <= range.end).length;
  const sync = totals.combined.jobs ? Math.min(100, Math.round((totals.pdf.jobs / totals.combined.jobs) * 100)) : 0;

  return <div className="command-dashboard">
    <section className="hud-hero">
      <i className="hud-scanline"/>
      <div className="hud-copy">
        <span className="hud-kicker"><CircleDot/> {language === "ro" ? "INTERFAȚĂ DE COMANDĂ A.R.I.S." : "A.R.I.S. COMMAND INTERFACE"}</span>
        <h1>{language === "ro" ? <>Bun venit, <em>{data.profile?.name}</em></> : <>Welcome, <em>{data.profile?.name}</em></>}</h1>
        <p>{language === "ro" ? "Date operaționale, plăți și performanță, într-un singur sistem." : "Operations, payments and performance in one system."}</p>
        <div className="hud-controls">
          <label><CalendarDays/><span>{language === "ro" ? "Data de control" : "Control date"}</span><input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
          <div className="hud-scope">
            {(["week", "month", "all"] as Scope[]).map(item => <button key={item} className={scope === item ? "active" : ""} onClick={() => setScope(item)}>{item === "week" ? (language === "ro" ? "7 ZILE" : "7 DAYS") : item === "month" ? (language === "ro" ? "LUNĂ" : "MONTH") : (language === "ro" ? "TOTAL" : "ALL")}</button>)}
          </div>
        </div>
      </div>
      <div className="hud-reactor" aria-hidden="true">
        <i className="ring one"/><i className="ring two"/><i className="ring three"/><span><Zap/><b>{totals.combined.jobs}</b><small>{language === "ro" ? "JOBURI" : "JOBS"}</small></span>
      </div>
      <div className="hud-telemetry">
        <div><span>{language === "ro" ? "SISTEM" : "SYSTEM"}</span><strong className="green">ONLINE</strong><i style={{"--level":"100%"} as CSSProperties}/></div>
        <div><span>{language === "ro" ? "SINCRONIZARE PDF" : "PDF SYNC"}</span><strong>{sync}%</strong><i style={{"--level":`${sync}%`} as CSSProperties}/></div>
        <div><span>{language === "ro" ? "MAȘINI ACTIVE" : "ACTIVE CARS"}</span><strong>{active}</strong><i style={{"--level":`${Math.min(100, active * 12)}%`} as CSSProperties}/></div>
        <div><span>{language === "ro" ? "FLUTURAȘI" : "PAYSLIPS"}</span><strong>{pdfCount}</strong><i style={{"--level":`${Math.min(100, pdfCount * 25)}%`} as CSSProperties}/></div>
      </div>
    </section>

    <SourceMatrix totals={totals}/>

    <section className="hud-action-deck">
      <div className="source-matrix-head"><div><span>{language === "ro" ? "COMENZI RAPIDE" : "QUICK COMMANDS"}</span><h2>{language === "ro" ? "Acțiuni rapide" : "Quick actions"}</h2></div><p>{formatDate(range.start, language)} · {formatDate(range.end, language)}</p></div>
      <div className="hud-actions">
        <Link to="/scan-job"><Camera/><span><strong>{language === "ro" ? "Scanează un job" : "Scan a job"}</strong><small>{language === "ro" ? "Cameră sau galerie, procesare locală" : "Camera or gallery, local processing"}</small></span><ArrowRight/></Link>
        <Link to="/collect"><CarFront/><span><strong>{t("newCollection")}</strong><small>{language === "ro" ? "Înregistrează colectarea" : "Record the collection"}</small></span><ArrowRight/></Link>
        <Link to="/deliver"><Route/><span><strong>{t("completeDelivery")}</strong><small>{active} {language === "ro" ? "mașini active" : "active cars"}</small></span><ArrowRight/></Link>
        <Link to="/catch-up"><ListPlus/><span><strong>{t("catchUp")}</strong><small>{language === "ro" ? "Recuperează joburile lipsă" : "Recover missing jobs"}</small></span><ArrowRight/></Link>
        <Link to="/payslips"><FileScan/><span><strong>{language === "ro" ? "Verifică PDF" : "Check PDF"}</strong><small>{language === "ro" ? "Compară plata job cu job" : "Compare payment job by job"}</small></span><ArrowRight/></Link>
        <Link to="/reports"><CalendarRange/><span><strong>{t("reports")}</strong><small>{language === "ro" ? "Zi, săptămână și lună" : "Day, week and month"}</small></span><ArrowRight/></Link>
        <Link to="/tax"><ReceiptPoundSterling/><span><strong>{t("tax")}</strong><small>{language === "ro" ? "TVA și impozit pe venit" : "VAT and Income Tax"}</small></span><ArrowRight/></Link>
        <Link to="/intelligence"><BrainCircuit/><span><strong>A.R.I.S. Intelligence</strong><small>{language === "ro" ? "Panou separat, numai grafice și calcule" : "Separate panel with charts and calculations only"}</small></span><ArrowRight/></Link>
      </div>
    </section>

    <section className="section-block hud-day-panel">
      <div className="section-title"><div><span className="hud-kicker">{language === "ro" ? "OPERAȚIUNI ZILNICE" : "DAILY OPERATIONS"}</span><h2>{formatDate(date,language)}</h2><p>{dayJobs.length} {language === "ro" ? "înregistrări" : "records"}</p></div><div className="hud-date-code"><ShieldCheck/> {weekStart}</div></div>
      {!dayJobs.length ? <Empty>{t("noJobsToday")}</Empty> : <div className="job-list">{dayJobs.map(job => <article className="job-card" key={job.id}><div className="job-main"><VehiclePlate registration={jobRegistrations(job, true).join(" / ")} vehicleType={job.vehicleType}/><div><h3>{[job.makeModel, job.vehicleYear].filter(Boolean).join(" · ")||job.jobRef||"Car"}</h3><p><MapPin size={14}/>{job.protocol === "autorola" && !job.pickupTown ? (language === "ro" ? "Locație clasificată" : "Classified location") : job.pickupTown||"?"} <ArrowRight size={13}/> {job.protocol === "autorola" && !job.deliveryTown ? (language === "ro" ? "Locație clasificată" : "Classified location") : job.deliveryTown||"?"}</p></div></div><div className="job-meta"><ProtocolBadge protocol={job.protocol} language={language} compact/><StatusPill status={job.status}/><strong>{number(jobMiles(job))} mi</strong></div></article>)}</div>}
    </section>

    <Link className="comparison-banner hud-compare" to="/payslips"><Wallet/><div><small>{language === "ro" ? "PROTOCOL DE VERIFICARE FINANCIARĂ" : "FINANCIAL VERIFY PROTOCOL"}</small><strong>{t("currentWeekCompare")}</strong><span>{language === "ro" ? "Încarcă PDF-ul. A.R.I.S. verifică mașinile, milele și plata." : "Upload the PDF. A.R.I.S. checks cars, miles and payment."}</span></div><ArrowRight/></Link>
  </div>;
}
