import { Activity, AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, Coins, Gauge, MapPinned, Medal, Route, Save, ShieldCheck, Sparkles, Target, TimerReset, WalletCards } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, number } from "../components/Ui";
import { SourceMatrix } from "../components/SourceMatrix";
import { useData } from "../store/DataContext";
import { addDays, formatDate, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { performanceRecords, performanceSnapshot, routePerformance, weekdayPerformance } from "../lib/performance";
import { calculateSourceTotals } from "../lib/sourceTotals";
import type { DailyLog, DayWorkStatus } from "../types";

type View = "command" | "performance" | "week";

const minutesLabel = (value: number) => `${Math.floor(value / 60)}h ${String(value % 60).padStart(2, "0")}m`;
const weekdayLabel = (value: string, language: "ro" | "en") => new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", { weekday: "short" }).format(new Date(`${value}T12:00:00`));
const statusLabels: Record<DayWorkStatus, { ro: string; en: string }> = {
  worked: { ro: "Am lucrat", en: "Worked" },
  "not-worked": { ro: "Nu am lucrat", en: "Did not work" },
  unavailable: { ro: "Indisponibil", en: "Unavailable" },
  "day-off": { ro: "Zi liberă", en: "Day off" },
  holiday: { ro: "Concediu", en: "Holiday" },
  sick: { ro: "Boală", en: "Sick" },
  "no-jobs": { ro: "Nu am primit lucrări", en: "No jobs assigned" }
};

export function PerformancePage() {
  const { data, language, saveDailyLog, savePerformanceSettings } = useData();
  const latestWeek = [...data.payslips].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]?.weekStart ?? mondayOf(todayIso());
  const [weekStart, setWeekStart] = useState(latestWeek);
  const [view, setView] = useState<View>("command");
  const [analysisRange, setAnalysisRange] = useState("90");
  const [editingDate, setEditingDate] = useState(weekStart);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const end = addDays(weekStart, 6);
  const snapshot = useMemo(() => performanceSnapshot(data, weekStart, end), [data, weekStart, end]);
  const sourceTotals = useMemo(() => calculateSourceTotals(data, weekStart, end), [data, weekStart, end]);
  const previous = useMemo(() => performanceSnapshot(data, addDays(weekStart, -7), addDays(weekStart, -1)), [data, weekStart]);
  const rangeStart = analysisRange === "week" ? weekStart : analysisRange === "30" ? addDays(end, -29) : analysisRange === "all" ? "2000-01-01" : addDays(end, -89);
  const rangeSnapshot = useMemo(() => performanceSnapshot(data, rangeStart, end), [data, rangeStart, end]);
  const weekdays = useMemo(() => weekdayPerformance(data, rangeStart, end), [data, rangeStart, end]);
  const routes = useMemo(() => routePerformance(data, rangeStart, end).slice(0, 8), [data, rangeStart, end]);
  const records = useMemo(() => performanceRecords(data), [data]);
  const chartData = snapshot.days.map(day => ({ name: formatShortDate(day.date, language), profit: day.realProfit, hours: day.minutesAway / 60 }));
  const workedDays = snapshot.days.filter(day => day.jobs > 0);
  const morningKnown = workedDays.filter(day => day.morningEligible !== null);
  const morningHit = morningKnown.filter(day => day.morningEligible).length;
  const morningPercent = morningKnown.length ? morningHit / morningKnown.length * 100 : 0;
  const rewardTier = morningPercent >= 100 ? 20 : morningPercent >= 75 ? 15 : morningPercent >= 50 ? 10 : 0;
  const currentLog = (data.dailyLogs ?? []).find(log => log.date === editingDate);
  const settings = data.performanceSettings!;
  const [form, setForm] = useState(() => logForm(currentLog, editingDate));
  const [settingsForm, setSettingsForm] = useState(settings);

  const selectDay = (date: string) => {
    setEditingDate(date);
    setForm(logForm((data.dailyLogs ?? []).find(log => log.date === date), date));
  };

  const saveDay = (event: FormEvent) => {
    event.preventDefault();
    saveDailyLog({
      id: currentLog?.id ?? crypto.randomUUID(),
      date: form.date,
      status: form.status,
      leftHomeTime: form.status === "worked" ? form.leftHomeTime : "",
      returnedHomeTime: form.status === "worked" ? form.returnedHomeTime : "",
      productiveMinutes: form.status === "worked" ? Number(form.productiveMinutes) || 0 : 0,
      waitingMinutes: form.status === "worked" ? Number(form.waitingMinutes) || 0 : 0,
      publicTransportMinutes: form.status === "worked" ? Number(form.publicTransportMinutes) || 0 : 0,
      reason: form.reason,
      notes: form.notes,
      updatedAt: new Date().toISOString()
    });
  };

  const chooseWeek = (value: string) => {
    const next = mondayOf(value);
    setWeekStart(next);
    selectDay(next);
  };

  return <div className="aris-page">
    <header className="aris-topbar">
      <div><span className="aris-eyebrow">A.R.I.S. · DRIVER INTELLIGENCE</span><h1>{view === "command" ? (language === "ro" ? <>Bună, <em>Bogdan</em></> : <>Hello, <em>Bogdan</em></>) : view === "performance" ? (language === "ro" ? <>Analiza de <em>performanță</em></> : <>Performance <em>analysis</em></>) : (language === "ro" ? <>Săptămâna ta de <em>lucru</em></> : <>Your <em>work week</em></>)}</h1></div>
      <div className="aris-top-actions"><label>{language === "ro" ? "Săptămâna" : "Week"}<input type="date" value={weekStart} onChange={event => chooseWeek(event.target.value)}/></label><span className={`aris-data-state ${snapshot.dataQuality >= 85 ? "ok" : "warn"}`}>{snapshot.dataQuality >= 85 ? <CheckCircle2/> : <AlertTriangle/>}{snapshot.dataQuality}% {language === "ro" ? "date" : "data"}</span></div>
    </header>

    <nav className="aris-view-tabs">
      <button className={view === "command" ? "active" : ""} onClick={() => setView("command")}><Gauge/>01 <span>{language === "ro" ? "Centru de comandă" : "Command centre"}</span></button>
      <button className={view === "performance" ? "active" : ""} onClick={() => setView("performance")}><BarChart3/>02 <span>{language === "ro" ? "Performanță" : "Performance"}</span></button>
      <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}><CalendarDays/>03 <span>{language === "ro" ? "Săptămâna mea" : "My week"}</span></button>
    </nav>

    {view === "command" && <>
      <SourceMatrix totals={sourceTotals} compact/>
      <section className="aris-kpi-grid">
        <ArisKpi label={language === "ro" ? "Câștig real pe oră" : "True hourly earnings"} value={snapshot.awayMinutes ? `${money(snapshot.realHourly)}/h` : "Adaugă orele"} detail={`${language === "ro" ? "Obiectiv" : "Target"} ${money(settings.hourlyTarget)}`} progress={snapshot.awayMinutes ? snapshot.realHourly / settings.hourlyTarget * 100 : 0}/>
        <ArisKpi label={language === "ro" ? "Profit real săptămânal" : "Real weekly profit"} value={money(snapshot.realProfit)} detail={`${language === "ro" ? "Țintă" : "Target"} ${money(settings.weeklyProfitTarget)}`} progress={snapshot.realProfit / settings.weeklyProfitTarget * 100}/>
        <ArisKpi label={language === "ro" ? "Trebuia să primesc" : "Expected payment"} value={snapshot.paymentComparisonReady ? money(snapshot.expectedPay) : (language === "ro" ? "Săptămână incompletă" : "Incomplete week")} detail={snapshot.paymentComparisonReady ? `${language === "ro" ? "Plătit" : "Paid"} ${money(snapshot.paid)}` : (language === "ro" ? "Diferența este ascunsă" : "Difference is hidden")} delta={snapshot.paymentComparisonReady ? snapshot.payDifference : undefined}/>
        <ArisKpi label={language === "ro" ? "Cheltuieli recuperate" : "Expenses recovered"} value={`${number(snapshot.expenseRecovery)}%`} detail={`${money(snapshot.approvedExpenses)} / ${money(snapshot.claimedExpenses)}`} progress={snapshot.expenseRecovery}/>
      </section>

      <section className="aris-command-grid">
        <article className="aris-panel aris-score-panel"><div className="aris-score-ring" style={{ "--score": `${snapshot.score ?? 0}%` } as CSSProperties}><div><strong>{snapshot.score ?? "?"}</strong><span>{language === "ro" ? "Scor performanță" : "Performance score"}</span></div></div><h2>{scoreLabel(snapshot.score, language)}</h2><p>{language === "ro" ? "Scorul combină profitul pe oră, numărul de mașini, recuperarea cheltuielilor, timpul productiv și bonusul de dimineață." : "The score combines hourly profit, cars, expense recovery, productive time and morning bonus."}</p></article>
        <article className="aris-panel aris-chart-panel"><div className="aris-panel-head"><div><h2>{language === "ro" ? "Evoluția săptămânii" : "Weekly evolution"}</h2><p>{language === "ro" ? "Profit real și ore totale" : "Real profit and total hours"}</p></div><span>{snapshot.jobs} {language === "ro" ? "mașini" : "cars"}</span></div><ResponsiveContainer width="100%" height={250}><AreaChart data={chartData}><defs><linearGradient id="arisProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#50ecff" stopOpacity={.3}/><stop offset="95%" stopColor="#50ecff" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(80,236,255,.08)" vertical={false}/><XAxis dataKey="name" stroke="#6f94a7" fontSize={10}/><YAxis stroke="#6f94a7" fontSize={10}/><Tooltip contentStyle={{ background: "#071725", border: "1px solid rgba(80,236,255,.25)", borderRadius: 10 }}/><Area type="monotone" dataKey="profit" stroke="#50ecff" fill="url(#arisProfit)" strokeWidth={3}/></AreaChart></ResponsiveContainer><div className="aris-chart-facts"><span><strong>{number(snapshot.miles)}</strong>{language === "ro" ? "mile" : "miles"}</span><span><strong>{minutesLabel(snapshot.awayMinutes)}</strong>{language === "ro" ? "timp total" : "total time"}</span><span><strong>{number(snapshot.productivePercent)}%</strong>{language === "ro" ? "productiv" : "productive"}</span><span><strong>{money(snapshot.profitPerCar)}</strong>{language === "ro" ? "profit/mașină" : "profit/car"}</span></div></article>
      </section>

      <section className="aris-mini-grid">
        <ArisMini icon={<ShieldCheck/>} title={language === "ro" ? "Rezervă TVA" : "VAT reserve"} value={money(snapshot.vatReserve)} detail={language === "ro" ? "Standard VAT inclus în plățile RAS" : "Standard VAT included in RAS payments"}/>
        <ArisMini icon={<WalletCards/>} title={language === "ro" ? "Rezervă Income Tax" : "Income Tax reserve"} value={money(snapshot.incomeTaxReserve)} detail={`${settings.incomeTaxReservePercent}% ${language === "ro" ? "din profitul estimat" : "of estimated profit"}`}/>
        <ArisMini icon={<Target/>} title={language === "ro" ? "Bonus înainte de 09:00" : "Before 09:00 bonus"} value={`${rewardTier}%`} detail={`${morningHit}/${morningKnown.length} ${language === "ro" ? "zile eligibile" : "eligible days"}`}/>
        <ArisMini icon={<Sparkles/>} title={language === "ro" ? "Față de săptămâna trecută" : "Vs previous week"} value={money(snapshot.realProfit - previous.realProfit)} detail={`${money(previous.realProfit)} → ${money(snapshot.realProfit)}`}/>
      </section>
    </>}

    {view === "performance" && <>
      <div className="aris-filter-row"><label>{language === "ro" ? "Perioada analizei" : "Analysis period"}<select value={analysisRange} onChange={event => setAnalysisRange(event.target.value)}><option value="week">{language === "ro" ? "Săptămâna selectată" : "Selected week"}</option><option value="30">30 {language === "ro" ? "zile" : "days"}</option><option value="90">90 {language === "ro" ? "zile" : "days"}</option><option value="all">{language === "ro" ? "Toate datele" : "All data"}</option></select></label><button className="aris-secondary" onClick={() => setSettingsOpen(!settingsOpen)}><Target/>{language === "ro" ? "Obiective și rezerve" : "Targets and reserves"}</button></div>
      {settingsOpen && <form className="aris-panel aris-settings-strip" onSubmit={event => { event.preventDefault(); savePerformanceSettings(settingsForm); setSettingsOpen(false); }}><label>{language === "ro" ? "Țintă £/oră" : "Hourly target"}<input type="number" step="0.5" value={settingsForm.hourlyTarget} onChange={event => setSettingsForm({ ...settingsForm, hourlyTarget: Number(event.target.value) })}/></label><label>{language === "ro" ? "Țintă profit/săptămână" : "Weekly profit target"}<input type="number" step="10" value={settingsForm.weeklyProfitTarget} onChange={event => setSettingsForm({ ...settingsForm, weeklyProfitTarget: Number(event.target.value) })}/></label><label>{language === "ro" ? "Rezervă Income Tax %" : "Income Tax reserve %"}<input type="number" step="1" value={settingsForm.incomeTaxReservePercent} onChange={event => setSettingsForm({ ...settingsForm, incomeTaxReservePercent: Number(event.target.value) })}/></label><label>{language === "ro" ? "Zi lungă după ore" : "Long day after hours"}<input type="number" step="0.5" value={settingsForm.longDayHours} onChange={event => setSettingsForm({ ...settingsForm, longDayHours: Number(event.target.value) })}/></label><button className="aris-primary"><Save/>{language === "ro" ? "Salvează" : "Save"}</button></form>}
      <section className="aris-metric-grid">
        <Metric code="01" title={language === "ro" ? "Câștig real pe oră" : "True hourly earnings"} value={rangeSnapshot.awayMinutes ? `${money(rangeSnapshot.realHourly)}/h` : "-"}/>
        <Metric code="02" title={language === "ro" ? "Profit pe mașină" : "Profit per car"} value={money(rangeSnapshot.profitPerCar)}/>
        <Metric code="06" title={language === "ro" ? "Câștig brut pe mașină" : "Gross earnings per car"} value={money(rangeSnapshot.grossPerCar)}/>
        <Metric code="07" title={language === "ro" ? "Câștig pe milă" : "Earnings per mile"} value={money(rangeSnapshot.earningsPerMile)}/>
        <Metric code="09" title={language === "ro" ? "Timp productiv" : "Productive time"} value={`${number(rangeSnapshot.productivePercent)}%`}/>
        <Metric code="05" title={language === "ro" ? "Cheltuieli recuperate" : "Expenses recovered"} value={`${number(rangeSnapshot.expenseRecovery)}%`}/>
        <Metric code="03" title={language === "ro" ? "Diferența de plată" : "Payment difference"} value={rangeSnapshot.paymentComparisonReady ? money(rangeSnapshot.payDifference) : (language === "ro" ? "Perioadă incompletă" : "Incomplete period")} tone={rangeSnapshot.paymentComparisonReady ? (rangeSnapshot.payDifference < 0 ? "red" : "green") : undefined}/>
        <Metric code="20" title={language === "ro" ? "Calitatea datelor" : "Data quality"} value={`${rangeSnapshot.dataQuality}%`}/>
      </section>
      <section className="aris-analysis-grid">
        <article className="aris-panel"><div className="aris-panel-head"><div><h2>{language === "ro" ? "Performanță după zi" : "Performance by weekday"}</h2><p>{language === "ro" ? "Profit real pe oră" : "Real hourly profit"}</p></div><Activity/></div><div className="aris-bars">{weekdays.map(day => <div key={day.name}><span>{day.name}</span><i><b style={{ width: `${Math.min(100, day.hourly / Math.max(settings.hourlyTarget, 1) * 100)}%` }}/></i><strong>{money(day.hourly)}/h</strong></div>)}</div><div className="aris-week-compare"><div><span>{language === "ro" ? "Săptămâna trecută" : "Previous week"}</span><strong>{money(previous.realProfit)}</strong></div><em>VS</em><div><span>{language === "ro" ? "Săptămâna selectată" : "Selected week"}</span><strong>{money(snapshot.realProfit)}</strong></div></div></article>
        <article className="aris-panel"><div className="aris-panel-head"><div><h2>{language === "ro" ? "Rute și postcoduri profitabile" : "Profitable routes and postcodes"}</h2><p>{language === "ro" ? "Profit după costuri și TVA" : "Profit after costs and VAT"}</p></div><MapPinned/></div><div className="aris-route-table"><div className="head"><span>{language === "ro" ? "Rută" : "Route"}</span><span>{language === "ro" ? "Mașini" : "Cars"}</span><span>Profit</span><span>£/mi</span><span>{language === "ro" ? "Scor" : "Score"}</span></div>{routes.length ? routes.map(route => <div key={route.route}><span>{route.route}</span><span>{route.jobs}</span><span>{money(route.profit)}</span><span>{money(route.perMile)}</span><span><b>{route.score}</b></span></div>) : <p>{language === "ro" ? "Adaugă localitățile sau postcodurile pentru a compara rutele." : "Add towns or postcodes to compare routes."}</p>}</div></article>
      </section>
      <section className="aris-panel aris-records"><div className="aris-panel-head"><div><h2>{language === "ro" ? "Recorduri personale" : "Personal records"}</h2><p>{language === "ro" ? "Cele mai bune rezultate din toate datele" : "Best results across all data"}</p></div><Medal/></div><div><Record label={language === "ro" ? "Cea mai bună zi" : "Best day"} value={records.bestProfit ? money(records.bestProfit.realProfit) : "-"} date={records.bestProfit?.date}/><Record label={language === "ro" ? "Cele mai multe mașini" : "Most cars"} value={String(records.mostCars?.jobs ?? "-")} date={records.mostCars?.date}/><Record label={language === "ro" ? "Record £/oră" : "Hourly record"} value={records.bestHourly ? `${money(records.bestHourly.realHourly)}/h` : "-"} date={records.bestHourly?.date}/></div></section>
    </>}

    {view === "week" && <>
      <section className="aris-panel aris-week-panel"><div className="aris-panel-head"><div><h2>{formatDate(weekStart, language)} - {formatDate(end, language)}</h2><p>{language === "ro" ? "Fiecare zi, fiecare mașină și motivul zilelor fără activitate" : "Every day, every car and reasons for no activity"}</p></div><CalendarDays/></div><div className="aris-day-grid">{snapshot.days.map(day => <button key={day.date} className={`${editingDate === day.date ? "selected" : ""} ${day.status !== "worked" ? "off" : ""}`} onClick={() => selectDay(day.date)}><header><span>{weekdayLabel(day.date, language)}</span><strong>{day.date.slice(-2)}</strong></header>{day.status === "worked" ? <><div className="aris-day-score">{day.score ?? "?"}<small>/100</small></div><dl><div><dt>{language === "ro" ? "Mașini" : "Cars"}</dt><dd>{day.jobs}</dd></div><div><dt>Profit</dt><dd>{money(day.realProfit)}</dd></div><div><dt>{language === "ro" ? "Ore" : "Hours"}</dt><dd>{day.minutesAway ? minutesLabel(day.minutesAway) : "-"}</dd></div><div><dt>£/h</dt><dd>{day.minutesAway ? money(day.realHourly) : "-"}</dd></div></dl></> : <div className="aris-off-state"><strong>{day.status === "unconfirmed" ? (language === "ro" ? "Fără date" : "No data") : (language === "ro" ? "Nu ai lucrat" : "Did not work")}</strong><span>{day.reason || (language === "ro" ? "Motiv nespecificat" : "Reason not specified")}</span></div>}</button>)}</div></section>
      <section className="aris-week-detail-grid">
        <form className="aris-panel aris-day-form" onSubmit={saveDay}><div className="aris-panel-head"><div><h2>{language === "ro" ? "Actualizează ziua" : "Update day"}</h2><p>{formatDate(editingDate, language)}</p></div><Clock3/></div><div className="aris-form-grid"><label>{language === "ro" ? "Stare" : "Status"}<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as DayWorkStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label[language]}</option>)}</select></label>{form.status === "worked" && <><label>{language === "ro" ? "Plecat de acasă" : "Left home"}<input type="time" value={form.leftHomeTime} onChange={event => setForm({ ...form, leftHomeTime: event.target.value })}/></label><label>{language === "ro" ? "Ajuns acasă" : "Returned home"}<input type="time" value={form.returnedHomeTime} onChange={event => setForm({ ...form, returnedHomeTime: event.target.value })}/></label><label>{language === "ro" ? "Minute productive" : "Productive minutes"}<input type="number" min="0" value={form.productiveMinutes} onChange={event => setForm({ ...form, productiveMinutes: event.target.value })}/></label><label>{language === "ro" ? "Minute așteptare" : "Waiting minutes"}<input type="number" min="0" value={form.waitingMinutes} onChange={event => setForm({ ...form, waitingMinutes: event.target.value })}/></label><label>{language === "ro" ? "Minute transport public" : "Public transport minutes"}<input type="number" min="0" value={form.publicTransportMinutes} onChange={event => setForm({ ...form, publicTransportMinutes: event.target.value })}/></label></>}<label>{language === "ro" ? "Motiv sau explicație" : "Reason or explanation"}<input value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })}/></label><label className="wide">{language === "ro" ? "Notițe" : "Notes"}<textarea rows={2} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })}/></label></div><button className="aris-primary"><Save/>{language === "ro" ? "Salvează ziua" : "Save day"}</button></form>
        <article className="aris-panel aris-fatigue"><div className="aris-panel-head"><div><h2>{language === "ro" ? "Timp productiv și oboseală" : "Productive time and fatigue"}</h2><p>{language === "ro" ? "De la plecare până acasă" : "From leaving home until return"}</p></div><TimerReset/></div><TimeBar label={language === "ro" ? "Productiv" : "Productive"} value={snapshot.productiveMinutes} total={snapshot.awayMinutes}/><TimeBar label={language === "ro" ? "Așteptare" : "Waiting"} value={snapshot.days.reduce((sum, day) => sum + day.waitingMinutes, 0)} total={snapshot.awayMinutes} tone="amber"/><TimeBar label={language === "ro" ? "Transport" : "Transport"} value={snapshot.days.reduce((sum, day) => sum + day.publicTransportMinutes, 0)} total={snapshot.awayMinutes}/><div className="aris-alert-list">{snapshot.days.filter(day => day.longDay || (day.restHours !== null && day.restHours < settings.minimumRestHours)).map(day => <div key={day.date}><AlertTriangle/><span><strong>{formatDate(day.date, language)}</strong>{day.longDay ? (language === "ro" ? `Zi lungă: ${minutesLabel(day.minutesAway)}` : `Long day: ${minutesLabel(day.minutesAway)}`) : (language === "ro" ? `Odihnă: ${number(day.restHours ?? 0)} ore` : `Rest: ${number(day.restHours ?? 0)} hours`)}</span></div>)}{!snapshot.days.some(day => day.longDay || (day.restHours !== null && day.restHours < settings.minimumRestHours)) && <div className="ok"><CheckCircle2/><span><strong>{language === "ro" ? "Nu există alerte" : "No alerts"}</strong>{language === "ro" ? "Completează orele pentru analiza oboselii." : "Complete the times for fatigue analysis."}</span></div>}</div></article>
      </section>
    </>}
  </div>;
}

const logForm = (log: DailyLog | undefined, date: string) => ({ date, status: log?.status ?? "worked" as DayWorkStatus, leftHomeTime: log?.leftHomeTime ?? "", returnedHomeTime: log?.returnedHomeTime ?? "", productiveMinutes: String(log?.productiveMinutes || ""), waitingMinutes: String(log?.waitingMinutes || ""), publicTransportMinutes: String(log?.publicTransportMinutes || ""), reason: log?.reason ?? "", notes: log?.notes ?? "" });

function ArisKpi({ label, value, detail, progress, delta }: { label: string; value: string; detail: string; progress?: number; delta?: number }) { return <article className="aris-kpi"><span>{label}</span><strong>{value}</strong>{progress !== undefined && <i><b style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}/></i>}<small>{detail}{delta !== undefined && <em className={delta < 0 ? "red" : "green"}>{delta >= 0 ? "+" : ""}{money(delta)}</em>}</small></article>; }
function ArisMini({ icon, title, value, detail }: { icon: ReactNode; title: string; value: string; detail: string }) { return <article className="aris-panel aris-mini"><div>{icon}<span>{title}</span></div><strong>{value}</strong><p>{detail}</p></article>; }
function Metric({ code, title, value, tone }: { code: string; title: string; value: string; tone?: string }) { return <article className="aris-panel aris-metric"><span>METRIC {code}</span><h3>{title}</h3><strong className={tone}>{value}</strong></article>; }
function Record({ label, value, date }: { label: string; value: string; date?: string }) { return <article><Medal/><span>{label}</span><strong>{value}</strong><small>{date ?? "-"}</small></article>; }
function TimeBar({ label, value, total, tone = "cyan" }: { label: string; value: number; total: number; tone?: string }) { return <div className="aris-timebar"><span>{label}</span><i><b className={tone} style={{ width: `${total ? Math.min(100, value / total * 100) : 0}%` }}/></i><strong>{minutesLabel(value)}</strong></div>; }
function scoreLabel(score: number | null, language: "ro" | "en") { if (score === null) return language === "ro" ? "Completează orele" : "Complete your hours"; if (score >= 85) return language === "ro" ? "Performanță ridicată" : "High performance"; if (score >= 65) return language === "ro" ? "Performanță bună" : "Good performance"; return language === "ro" ? "Poți îmbunătăți" : "Room to improve"; }
