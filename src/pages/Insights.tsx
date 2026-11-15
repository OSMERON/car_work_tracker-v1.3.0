import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Banknote, BarChart3, BrainCircuit, CalendarDays, CarFront, Clock3, Fuel, Gauge, Hourglass, Route, Save, TimerReset } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { calculateSourceTotals, type SourceTotals } from "../lib/sourceTotals";
import { isCompanyFuelPdfRow } from "../lib/expenseRules";
import { jobMiles } from "../lib/analytics";
import { tariffForMiles } from "../lib/rates";
import { routePerformance } from "../lib/performance";
import type { DailyLog, Job, Language, PayslipJob } from "../types";

type Scope = "week" | "month" | "all";
type SourceChoice = keyof SourceTotals;
type DailyRow = { date: string; label: string; jobs: number; miles: number; jobIncome: number; waitingIncome: number; totalIncome: number; workHours: number; hourly: number; startHour: number | null };

const sourceKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const timeMinutes = (value: string) => { if (!/^\d{2}:\d{2}$/.test(value)) return null; const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; };
const durationMinutes = (start: string, end: string, date: string) => {
  const startMinutes = timeMinutes(start);
  let endMinutes = timeMinutes(end);
  if (startMinutes === null) return 0;
  if (endMinutes === null && date === todayIso()) { const now = new Date(); endMinutes = now.getHours() * 60 + now.getMinutes(); }
  if (endMinutes === null) return 0;
  return endMinutes >= startMinutes ? endMinutes - startMinutes : 1440 - startMinutes + endMinutes;
};
const decimalTime = (value: string) => { const minutes = timeMinutes(value); return minutes === null ? null : round2(minutes / 60); };
const timeLabel = (value: number | null) => { if (value === null) return "—"; const hours = Math.floor(value); const minutes = Math.round((value - hours) * 60); return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`; };
const periodRange = (scope: Scope, anchor: string, earliest: string, latest: string) => {
  if (scope === "week") { const start = mondayOf(anchor); return { start, end: addDays(start, 6) }; }
  if (scope === "month") { const start = `${anchor.slice(0, 7)}-01`; const next = new Date(`${start}T12:00:00`); next.setMonth(next.getMonth() + 1); return { start, end: addDays(next.toISOString().slice(0, 10), -1) }; }
  return { start: earliest, end: latest };
};
const daysBetween = (start: string, end: string) => { const rows: string[] = []; let date = start; while (date <= end && rows.length < 370) { rows.push(date); date = addDays(date, 1); } return rows; };
const sourceLabel = (source: SourceChoice, language: Language) => source === "manual" ? (language === "ro" ? "Datele mele" : "My data") : source === "pdf" ? "PDF" : (language === "ro" ? "Combinat fără dubluri" : "Combined without duplicates");

export function InsightsPage() {
  const { data, language, saveDailyLog } = useData();
  const allDates = useMemo(() => {
    const dates = [...data.jobs.flatMap(job => [job.collectionDate, job.deliveryDate]), ...data.payslips.map(payslip => payslip.weekStart), ...(data.dailyLogs ?? []).map(log => log.date)].filter(Boolean).sort();
    const today = todayIso();
    return { earliest: dates[0] ?? mondayOf(today), latest: dates.at(-1) ?? today };
  }, [data]);
  const [scope, setScope] = useState<Scope>("week");
  const [anchor, setAnchor] = useState(todayIso());
  const [source, setSource] = useState<SourceChoice>("combined");
  const [workDate, setWorkDate] = useState(todayIso());
  const initialLog = (data.dailyLogs ?? []).find(log => log.date === todayIso());
  const [startTime, setStartTime] = useState(initialLog?.leftHomeTime ?? "");
  const [endTime, setEndTime] = useState(initialLog?.returnedHomeTime ?? "");
  const [saved, setSaved] = useState(false);
  const range = useMemo(() => periodRange(scope, anchor, allDates.earliest, allDates.latest), [scope, anchor, allDates]);
  const totals = useMemo(() => calculateSourceTotals(data, range.start, range.end), [data, range]);
  const selected = totals[source];

  const chooseWorkDate = (date: string) => {
    const log = (data.dailyLogs ?? []).find(item => item.date === date);
    setWorkDate(date); setStartTime(log?.leftHomeTime ?? ""); setEndTime(log?.returnedHomeTime ?? ""); setSaved(false);
  };
  const saveWorkTime = (event: FormEvent) => {
    event.preventDefault(); if (!startTime) return;
    const current = (data.dailyLogs ?? []).find(log => log.date === workDate);
    saveDailyLog({ id: current?.id ?? crypto.randomUUID(), date: workDate, status: "worked", leftHomeTime: startTime, returnedHomeTime: endTime, productiveMinutes: current?.productiveMinutes ?? 0, waitingMinutes: current?.waitingMinutes ?? 0, publicTransportMinutes: current?.publicTransportMinutes ?? 0, reason: current?.reason ?? "", notes: current?.notes ?? "", updatedAt: new Date().toISOString() });
    setSaved(true);
  };

  const manualJobs = useMemo(() => data.jobs.filter(job => job.status === "delivered" && (job.deliveryDate || job.collectionDate) >= range.start && (job.deliveryDate || job.collectionDate) <= range.end), [data.jobs, range]);
  const pdfJobs = useMemo(() => data.payslips.flatMap(payslip => (payslip.pdfJobs ?? []).filter(job => (job.date || payslip.weekStart) >= range.start && (job.date || payslip.weekStart) <= range.end)), [data.payslips, range]);
  const dailyData = useMemo(() => buildDailyRows(daysBetween(range.start, range.end), manualJobs, pdfJobs, data.dailyLogs ?? [], source, language), [range, manualJobs, pdfJobs, data.dailyLogs, source, language]);
  const waitingExpected = manualJobs.reduce((sum, job) => sum + (job.waitingEstimated ?? 0), 0);
  const waitingPaid = manualJobs.reduce((sum, job) => sum + (job.waitingPaid ?? job.waitingEstimated ?? 0), 0);
  const totalHours = dailyData.reduce((sum, day) => sum + day.workHours, 0);
  const grossHourly = totalHours ? selected.income / totalHours : 0;

  const fuelData = useMemo(() => {
    const fuelRows = data.payslips.flatMap(payslip => (payslip.pdfExpenses ?? []).filter(row => { const date = row.date || payslip.weekStart; return isCompanyFuelPdfRow(row) && date >= range.start && date <= range.end; }));
    const grouped = new Map<string, { jobRef: string; car: string; registration: string; fuel: number; miles: number; perMile: number }>();
    fuelRows.forEach(row => {
      const job = data.jobs.find(item => sourceKey(item.jobRef) === sourceKey(row.jobRef));
      const pdf = data.payslips.flatMap(item => item.pdfJobs ?? []).find(item => sourceKey(item.jobRef) === sourceKey(row.jobRef));
      const current = grouped.get(row.jobRef) ?? { jobRef: row.jobRef, car: job?.makeModel || pdf?.description || (language === "ro" ? "Mașină neidentificată" : "Unidentified car"), registration: job?.registration || job?.payslipRegistration || pdf?.registration || row.jobRef, fuel: 0, miles: job?.payslipMiles ?? job?.estimatedMiles ?? pdf?.miles ?? 0, perMile: 0 };
      current.fuel += row.uploaded; current.perMile = current.miles ? current.fuel / current.miles : 0; grouped.set(row.jobRef, current);
    });
    return [...grouped.values()].sort((a, b) => b.fuel - a.fuel);
  }, [data.jobs, data.payslips, range, language]);

  const sourceData = (["manual", "pdf", "combined"] as SourceChoice[]).map(key => ({ name: sourceLabel(key, language), venit: totals[key].income, costuri: totals[key].costs, net: totals[key].net }));
  const expenseRows = data.expenses.filter(expense => expense.date >= range.start && expense.date <= range.end);
  const expenseData = [
    { name: language === "ro" ? "Plătit de mine" : "Paid by me", value: expenseRows.reduce((sum, row) => sum + row.actualCost, 0) },
    { name: language === "ro" ? "Cerut" : "Claimed", value: expenseRows.reduce((sum, row) => sum + row.claimed, 0) },
    { name: language === "ro" ? "Rambursat" : "Reimbursed", value: expenseRows.reduce((sum, row) => sum + row.approved, 0) }
  ];
  const routes = useMemo(() => routePerformance(data, range.start, range.end).slice(0, 8), [data, range]);
  const fuelTotal = fuelData.reduce((sum, row) => sum + row.fuel, 0);

  return <div className="intel-only-page">
    <header className="intel-titlebar"><div><span><BrainCircuit/> A.R.I.S. INTELLIGENCE</span><h1>{language === "ro" ? "Grafice și calcule" : "Charts and calculations"}</h1><p>{language === "ro" ? "Această pagină conține exclusiv analiza datelor tale de lucru." : "This page contains only your work data analysis."}</p></div><BarChart3/></header>

    <form className="intel-start-question" onSubmit={saveWorkTime}>
      <div><Clock3/><span><small>{language === "ro" ? "ÎNREGISTRARE ZILNICĂ" : "DAILY RECORD"}</small><strong>{language === "ro" ? "La ce oră ai început munca?" : "What time did you start work?"}</strong></span></div>
      <label><span>{language === "ro" ? "Data" : "Date"}</span><input type="date" value={workDate} onChange={event => chooseWorkDate(event.target.value)}/></label>
      <label className="primary-time"><span>{language === "ro" ? "Ora începutului" : "Start time"}</span><input required type="time" value={startTime} onChange={event => { setStartTime(event.target.value); setSaved(false); }}/></label>
      <label><span>{language === "ro" ? "Ora sfârșitului, opțional" : "Finish time, optional"}</span><input type="time" value={endTime} onChange={event => { setEndTime(event.target.value); setSaved(false); }}/></label>
      <button type="submit"><Save/>{saved ? (language === "ro" ? "Salvat" : "Saved") : (language === "ro" ? "Salvează ora" : "Save time")}</button>
    </form>

    <section className="intel-controls">
      <label><CalendarDays/><span>{language === "ro" ? "Perioada" : "Period"}</span><div>{(["week", "month", "all"] as Scope[]).map(value => <button type="button" key={value} className={scope === value ? "active" : ""} onClick={() => setScope(value)}>{value === "week" ? (language === "ro" ? "Săptămână" : "Week") : value === "month" ? (language === "ro" ? "Lună" : "Month") : (language === "ro" ? "Tot" : "All")}</button>)}</div></label>
      <label><span>{language === "ro" ? "Data analizei" : "Analysis date"}</span><input type="date" value={anchor} onChange={event => setAnchor(event.target.value)}/></label>
      <label><span>{language === "ro" ? "Sursa" : "Source"}</span><select value={source} onChange={event => setSource(event.target.value as SourceChoice)}><option value="combined">{sourceLabel("combined", language)}</option><option value="manual">{sourceLabel("manual", language)}</option><option value="pdf">PDF</option></select></label>
    </section>

    <section className="intel-calculation-strip">
      <Calculation icon={<Banknote/>} label={language === "ro" ? "Venit total" : "Total income"} value={money(selected.income)}/>
      <Calculation icon={<Hourglass/>} label={language === "ro" ? "Waiting plătit" : "Paid waiting"} value={money(waitingPaid)}/>
      <Calculation icon={<TimerReset/>} label={language === "ro" ? "Câștig brut pe oră" : "Gross earnings per hour"} value={totalHours ? `${money(grossHourly)}/h` : "—"}/>
      <Calculation icon={<CarFront/>} label={language === "ro" ? "Mașini livrate" : "Delivered cars"} value={String(selected.jobs)}/>
      <Calculation icon={<Route/>} label={language === "ro" ? "Mile plătibile" : "Payable miles"} value={number(selected.miles)}/>
      <Calculation icon={<Fuel/>} label={language === "ro" ? "Combustibil, card companie" : "Fuel, company card"} value={money(fuelTotal)}/>
    </section>

    <section className="intel-chart-grid">
      <ChartPanel title={language === "ro" ? "Venit zilnic" : "Daily income"} text={language === "ro" ? "Plata joburilor plus waiting plătit către tine." : "Job payments plus waiting paid to you."}><ResponsiveContainer width="100%" height={270}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar stackId="income" dataKey="jobIncome" name={language === "ro" ? "Plată joburi" : "Job pay"} fill="#43d7ff"/><Bar stackId="income" dataKey="waitingIncome" name={language === "ro" ? "Waiting plătit" : "Paid waiting"} fill="#ffb84d" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Câștig pe oră" : "Earnings per hour"} text={language === "ro" ? "Folosește ora de început și ora de sfârșit. Pentru ziua curentă calculează până acum." : "Uses start and finish time. For today it calculates up to now."}><ResponsiveContainer width="100%" height={270}><AreaChart data={dailyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(value: number) => `${money(value)}/h`}/><Area type="monotone" dataKey="hourly" name={language === "ro" ? "£ pe oră" : "£ per hour"} stroke="#23e6a8" fill="#23e6a833" strokeWidth={3}/></AreaChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Ora începerii" : "Work start time"} text={language === "ro" ? "Arată ora salvată pentru fiecare zi lucrată." : "Shows the saved start time for every worked day."}><ResponsiveContainer width="100%" height={270}><LineChart data={dailyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis domain={[0,24]} tickFormatter={value => timeLabel(Number(value))}/><Tooltip formatter={(value: number) => timeLabel(value)}/><Line connectNulls type="monotone" dataKey="startHour" name={language === "ro" ? "Ora începutului" : "Start time"} stroke="#8c7cff" strokeWidth={3}/></LineChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Waiting, venit plătit" : "Waiting, paid income"} text={language === "ro" ? "Waiting este venit către tine. Nu apare în cheltuieli." : "Waiting is income paid to you. It is not treated as an expense."}><div className="intel-waiting-total"><Hourglass/><span><small>{language === "ro" ? "WAITING ESTIMAT" : "ESTIMATED WAITING"}</small><strong>{money(waitingExpected)}</strong></span><span><small>{language === "ro" ? "WAITING PLĂTIT" : "PAID WAITING"}</small><strong>{money(waitingPaid)}</strong></span></div><ResponsiveContainer width="100%" height={190}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="waitingIncome" name={language === "ro" ? "Waiting plătit" : "Paid waiting"} fill="#ffb84d" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel wide title={language === "ro" ? "Combustibil pe mașină" : "Fuel per car"} text={language === "ro" ? "Informativ din PDF. Este plătit cu cardul companiei și nu intră în cheltuielile tale." : "Information from the PDF. It is paid with the company card and excluded from your expenses."}>{fuelData.length ? <><ResponsiveContainer width="100%" height={280}><BarChart data={fuelData.slice(0,12)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="registration"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="fuel" name={language === "ro" ? "Combustibil £" : "Fuel £"} fill="#f3b64a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer><div className="intel-fuel-table"><div><span>{language === "ro" ? "Mașină" : "Car"}</span><span>Job Ref</span><span>{language === "ro" ? "Mile" : "Miles"}</span><span>{language === "ro" ? "Combustibil" : "Fuel"}</span><span>£/mi</span></div>{fuelData.slice(0,10).map(row => <div key={row.jobRef}><span><strong>{row.registration}</strong><small>{row.car}</small></span><span>{row.jobRef}</span><span>{number(row.miles)}</span><span>{money(row.fuel)}</span><span>{row.miles ? money(row.perMile) : "—"}</span></div>)}</div></> : <Empty language={language}/>}</ChartPanel>
      <ChartPanel title={language === "ro" ? "Mașini și mile" : "Cars and miles"} text={language === "ro" ? "Volumul de lucru pentru fiecare zi." : "Daily work volume."}><ResponsiveContainer width="100%" height={270}><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip/><Legend/><Bar dataKey="jobs" name={language === "ro" ? "Mașini" : "Cars"} fill="#23e6a8"/><Bar dataKey="miles" name={language === "ro" ? "Mile" : "Miles"} fill="#43d7ff" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Datele mele, PDF și combinat" : "My data, PDF and combined"} text={language === "ro" ? "Compară venitul, costurile și rezultatul fără dubluri." : "Compares income, costs and the deduplicated result."}><ResponsiveContainer width="100%" height={270}><BarChart data={sourceData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="venit" fill="#43d7ff"/><Bar dataKey="costuri" fill="#ff5c85"/><Bar dataKey="net" fill="#23e6a8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Costuri și rambursări" : "Costs and reimbursements"} text={language === "ro" ? "Combustibilul companiei este exclus din acest calcul." : "Company fuel is excluded from this calculation."}><ResponsiveContainer width="100%" height={270}><BarChart data={expenseData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="value" name="£" fill="#ff5c85" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title={language === "ro" ? "Rute după £ pe milă" : "Routes by £ per mile"} text={language === "ro" ? "Compară eficiența rutelor livrate." : "Compares delivered route efficiency."}>{routes.length ? <ResponsiveContainer width="100%" height={270}><BarChart layout="vertical" data={routes}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="route" width={120}/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="perMile" name="£/mi" fill="#8c7cff" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <Empty language={language}/>}</ChartPanel>
    </section>
  </div>;
}

function buildDailyRows(dates: string[], manualJobs: Job[], pdfJobs: PayslipJob[], logs: DailyLog[], source: SourceChoice, language: Language): DailyRow[] {
  return dates.map(date => {
    const manualMap = new Map(manualJobs.filter(job => (job.deliveryDate || job.collectionDate) === date).map(job => [sourceKey(job.jobRef), job]));
    const pdfMap = new Map(pdfJobs.filter(job => job.date === date).map(job => [sourceKey(job.jobRef), job]));
    const refs = source === "manual" ? [...manualMap.keys()] : source === "pdf" ? [...pdfMap.keys()] : [...new Set([...manualMap.keys(), ...pdfMap.keys()])];
    let miles = 0; let jobIncome = 0; let waitingIncome = 0;
    refs.forEach(ref => {
      const own = manualMap.get(ref); const statement = pdfMap.get(ref);
      if (source === "manual") { miles += own ? jobMiles(own) : 0; jobIncome += own ? own.tariffPaid ?? tariffForMiles(jobMiles(own)) : 0; waitingIncome += own?.waitingPaid ?? own?.waitingEstimated ?? 0; }
      else if (source === "pdf") { miles += statement?.miles ?? 0; jobIncome += statement?.paid ?? 0; }
      else { miles += statement?.miles ?? (own ? jobMiles(own) : 0); jobIncome += statement?.paid ?? (own ? own.tariffPaid ?? tariffForMiles(jobMiles(own)) : 0); waitingIncome += own?.waitingPaid ?? own?.waitingEstimated ?? 0; }
    });
    const log = logs.find(item => item.date === date); const workMinutes = durationMinutes(log?.leftHomeTime ?? "", log?.returnedHomeTime ?? "", date); const totalIncome = jobIncome + waitingIncome;
    return { date, label: formatShortDate(date, language), jobs: refs.length, miles: round2(miles), jobIncome: round2(jobIncome), waitingIncome: round2(waitingIncome), totalIncome: round2(totalIncome), workHours: round2(workMinutes / 60), hourly: workMinutes ? round2(totalIncome / (workMinutes / 60)) : 0, startHour: decimalTime(log?.leftHomeTime ?? "") };
  });
}

function Calculation({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <article>{icon}<span><small>{label}</small><strong>{value}</strong></span></article>; }
function ChartPanel({ title, text, children, wide = false }: { title: string; text: string; children: ReactNode; wide?: boolean }) { return <article className={`intel-chart-panel ${wide ? "wide" : ""}`}><header><div><h2>{title}</h2><p>{text}</p></div><Gauge/></header>{children}</article>; }
function Empty({ language }: { language: Language }) { return <div className="intel-empty">{language === "ro" ? "Nu există date pentru perioada selectată." : "No data for the selected period."}</div>; }
