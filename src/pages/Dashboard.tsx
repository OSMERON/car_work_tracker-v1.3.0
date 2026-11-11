import { ArrowRight, CalendarDays, CalendarRange, CarFront, CircleDot, FileScan, ListPlus, MapPin, ReceiptPoundSterling, Route, ShieldCheck, Wallet, Zap } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Empty, number, StatusPill } from "../components/Ui";
import { SourceMatrix } from "../components/SourceMatrix";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { addDays, formatDate, mondayOf, todayIso } from "../lib/date";
import { jobMiles } from "../lib/analytics";
import { calculateSourceTotals } from "../lib/sourceTotals";

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
        <span className="hud-kicker"><CircleDot/> A.R.I.S. COMMAND INTERFACE</span>
        <h1>{language === "ro" ? <>Bun venit, <em>Bogdan</em></> : <>Welcome, <em>Bogdan</em></>}</h1>
        <p>{language === "ro" ? "Date operaționale, plăți și performanță, într-un singur sistem." : "Operations, payments and performance in one system."}</p>
        <div className="hud-controls">
          <label><CalendarDays/><span>{language === "ro" ? "Data de control" : "Control date"}</span><input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
          <div className="hud-scope">
            {(["week", "month", "all"] as Scope[]).map(item => <button key={item} className={scope === item ? "active" : ""} onClick={() => setScope(item)}>{item === "week" ? "7 ZILE" : item === "month" ? "LUNĂ" : "TOTAL"}</button>)}
          </div>
        </div>
      </div>
      <div className="hud-reactor" aria-hidden="true">
        <i className="ring one"/><i className="ring two"/><i className="ring three"/><span><Zap/><b>{totals.combined.jobs}</b><small>JOBURI</small></span>
      </div>
      <div className="hud-telemetry">
        <div><span>SISTEM</span><strong className="green">ONLINE</strong><i style={{"--level":"100%"} as CSSProperties}/></div>
        <div><span>PDF SYNC</span><strong>{sync}%</strong><i style={{"--level":`${sync}%`} as CSSProperties}/></div>
        <div><span>ACTIVE CARS</span><strong>{active}</strong><i style={{"--level":`${Math.min(100, active * 12)}%`} as CSSProperties}/></div>
        <div><span>PAYSLIPS</span><strong>{pdfCount}</strong><i style={{"--level":`${Math.min(100, pdfCount * 25)}%`} as CSSProperties}/></div>
      </div>
    </section>

    <SourceMatrix totals={totals}/>

    <section className="hud-action-deck">
      <div className="source-matrix-head"><div><span>QUICK COMMANDS</span><h2>Acțiuni rapide</h2></div><p>{formatDate(range.start, language)} · {formatDate(range.end, language)}</p></div>
      <div className="hud-actions">
        <Link to="/collect"><CarFront/><span><strong>{t("newCollection")}</strong><small>Înregistrează colectarea</small></span><ArrowRight/></Link>
        <Link to="/deliver"><Route/><span><strong>{t("completeDelivery")}</strong><small>{active} mașini active</small></span><ArrowRight/></Link>
        <Link to="/catch-up"><ListPlus/><span><strong>{t("catchUp")}</strong><small>Recuperează joburile lipsă</small></span><ArrowRight/></Link>
        <Link to="/payslips"><FileScan/><span><strong>Verifică PDF</strong><small>Compară plata job cu job</small></span><ArrowRight/></Link>
        <Link to="/reports"><CalendarRange/><span><strong>{t("reports")}</strong><small>Zi, săptămână și lună</small></span><ArrowRight/></Link>
        <Link to="/tax"><ReceiptPoundSterling/><span><strong>{t("tax")}</strong><small>VAT și Income Tax</small></span><ArrowRight/></Link>
      </div>
    </section>

    <section className="section-block hud-day-panel">
      <div className="section-title"><div><span className="hud-kicker">DAILY OPERATIONS</span><h2>{formatDate(date,language)}</h2><p>{dayJobs.length} {language === "ro" ? "înregistrări" : "records"}</p></div><div className="hud-date-code"><ShieldCheck/> {weekStart}</div></div>
      {!dayJobs.length ? <Empty>{t("noJobsToday")}</Empty> : <div className="job-list">{dayJobs.map(job => <article className="job-card" key={job.id}><div className="job-main"><span className="reg">{job.registration||"NO REG"}</span><div><h3>{job.makeModel||job.jobRef||"Car"}</h3><p><MapPin size={14}/>{job.pickupTown||"?"} <ArrowRight size={13}/> {job.deliveryTown||"?"}</p></div></div><div className="job-meta"><StatusPill status={job.status}/><strong>{number(jobMiles(job))} mi</strong></div></article>)}</div>}
    </section>

    <Link className="comparison-banner hud-compare" to="/payslips"><Wallet/><div><small>FINANCIAL VERIFY PROTOCOL</small><strong>{t("currentWeekCompare")}</strong><span>{language === "ro" ? "Încarcă PDF-ul. A.R.I.S. verifică mașinile, milele și plata." : "Upload the PDF. A.R.I.S. checks cars, miles and payment."}</span></div><ArrowRight/></Link>
  </div>;
}
