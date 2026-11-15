import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity, ArrowDown, ArrowUp, Banknote, BrainCircuit, CalendarDays, CarFront,
  ChartNoAxesCombined, Clock3, Eye, EyeOff, Fuel, Gauge, Layers3, ListFilter, Route,
  Settings2, ShieldCheck, Sparkles, TriangleAlert, WalletCards
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatDate, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { expenseGroups } from "../lib/analytics";
import { performanceDays, performanceSnapshot, routePerformance } from "../lib/performance";
import { calculateSourceTotals, type SourceTotals } from "../lib/sourceTotals";
import { ProtocolBadge } from "../components/ProtocolBadge";
import { PROTOCOLS } from "../lib/jobProtocols";
import { isCompanyFuelPdfRow } from "../lib/expenseRules";
import type { AppData, JobProtocol, Language } from "../types";

type InsightId = "activity" | "money" | "routes" | "time" | "workStart" | "fuel" | "expenses" | "expenseAudit" | "protocols" | "sources";
type InsightConfig = { id: InsightId; visible: boolean };
type Scope = "day" | "week" | "month" | "all";
type SourceChoice = keyof SourceTotals;
type Focus = "overview" | "operations" | "money" | "time" | "expenses" | "audit" | "all";
type Metric = "income" | "net" | "costs" | "jobs" | "miles";
type ChartStyle = "area" | "bar" | "line";
type TrendRow = { label: string; jobs: number; miles: number; income: number; costs: number; net: number };

const DEFAULT_CONFIG: InsightConfig[] = ["activity", "workStart", "fuel", "money", "sources", "expenseAudit", "protocols", "routes", "time", "expenses"].map(id => ({ id: id as InsightId, visible: true }));
const CONFIG_KEY = "aris-insights-config-v3";
const colors = ["#56d7ff", "#8c7cff", "#23e6a8", "#ffb84d", "#ff5c85", "#42a5f5"];
const sourceKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const lastDayOfMonth = (iso: string) => {
  const [year, month] = iso.slice(0, 7).split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
};
const rangeDays = (start: string, end: string) => Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1);
const normalizeConfig = (value: unknown): InsightConfig[] => {
  const known = new Set(DEFAULT_CONFIG.map(item => item.id));
  const saved = Array.isArray(value)
    ? value.filter((item): item is InsightConfig => Boolean(item && typeof item === "object" && "id" in item && known.has((item as InsightConfig).id))).map(item => ({ id: item.id, visible: item.visible !== false }))
    : [];
  return [...saved, ...DEFAULT_CONFIG.filter(item => !saved.some(savedItem => savedItem.id === item.id))];
};

const periodRange = (scope: Scope, anchor: string, earliest: string, latest: string) => {
  if (scope === "day") return { start: anchor, end: anchor };
  if (scope === "week") { const start = mondayOf(anchor); return { start, end: addDays(start, 6) }; }
  if (scope === "month") return { start: `${anchor.slice(0, 7)}-01`, end: lastDayOfMonth(anchor) };
  return { start: earliest, end: latest };
};

const sourceLabel = (source: SourceChoice, language: Language) => source === "manual"
  ? (language === "ro" ? "Datele mele" : "My records")
  : source === "pdf" ? "PDF" : (language === "ro" ? "Combinat" : "Combined");

const metricLabel = (metric: Metric, language: Language) => ({
  income: language === "ro" ? "Venit" : "Income",
  net: language === "ro" ? "Net după costuri" : "Net after costs",
  costs: language === "ro" ? "Costuri" : "Costs",
  jobs: language === "ro" ? "Mașini" : "Cars",
  miles: language === "ro" ? "Mile plătibile" : "Payable miles"
}[metric]);

const formatMetric = (metric: Metric, value: number) => metric === "income" || metric === "net" || metric === "costs" ? money(value) : number(value);
const timeAsHours = (value: string) => {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
};
const hoursAsTime = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const buildTrend = (data: AppData, start: string, end: string, source: SourceChoice, language: Language): TrendRow[] => {
  const rows: TrendRow[] = [];
  if (rangeDays(start, end) > 62) {
    let cursor = `${start.slice(0, 7)}-01`;
    while (cursor <= end) {
      const periodStart = cursor < start ? start : cursor;
      const monthEnd = lastDayOfMonth(cursor);
      const periodEnd = monthEnd > end ? end : monthEnd;
      const total = calculateSourceTotals(data, periodStart, periodEnd)[source];
      rows.push({ label: new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", { month: "short", year: "2-digit" }).format(new Date(`${cursor}T12:00:00`)), ...total });
      cursor = addDays(monthEnd, 1);
    }
    return rows;
  }
  let cursor = start;
  while (cursor <= end) {
    const total = calculateSourceTotals(data, cursor, cursor)[source];
    rows.push({ label: formatShortDate(cursor, language), ...total });
    cursor = addDays(cursor, 1);
  }
  return rows;
};

export function InsightsPage() {
  const { data, language } = useData();
  const allDates = useMemo(() => {
    const dates = [
      ...data.jobs.flatMap(job => [job.collectionDate, job.deliveryDate]),
      ...data.expenses.map(expense => expense.date),
      ...data.payslips.map(payslip => payslip.weekStart)
    ].filter(Boolean).sort();
    const today = todayIso();
    return { earliest: dates[0] ?? mondayOf(today), latest: dates.at(-1) ?? today };
  }, [data]);
  const [anchor, setAnchor] = useState(todayIso());
  const [scope, setScope] = useState<Scope>("week");
  const [source, setSource] = useState<SourceChoice>("combined");
  const [focus, setFocus] = useState<Focus>("overview");
  const [metric, setMetric] = useState<Metric>("income");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("area");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<InsightConfig[]>(() => {
    try { return normalizeConfig(JSON.parse(localStorage.getItem(CONFIG_KEY) || "null")); } catch { return DEFAULT_CONFIG; }
  });

  const range = useMemo(() => periodRange(scope, anchor, allDates.earliest, allDates.latest), [scope, anchor, allDates]);
  const duration = rangeDays(range.start, range.end);
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(previousEnd, -(duration - 1));
  const totals = useMemo(() => calculateSourceTotals(data, range.start, range.end), [data, range]);
  const previousTotals = useMemo(() => calculateSourceTotals(data, previousStart, previousEnd), [data, previousStart, previousEnd]);
  const selected = totals[source];
  const selectedPrevious = previousTotals[source];
  const snapshot = useMemo(() => performanceSnapshot(data, range.start, range.end), [data, range]);
  const previousSnapshot = useMemo(() => performanceSnapshot(data, previousStart, previousEnd), [data, previousStart, previousEnd]);
  const days = useMemo(() => performanceDays(data, range.start, range.end), [data, range]);
  const routes = useMemo(() => routePerformance(data, range.start, range.end).slice(0, 7), [data, range]);
  const expenses = useMemo(() => expenseGroups(data.expenses, range.start, range.end).slice(0, 7), [data.expenses, range]);
  const trendData = useMemo(() => buildTrend(data, range.start, range.end, source, language), [data, range, source, language]);
  const periodExpenses = useMemo(() => data.expenses.filter(expense => expense.date >= range.start && expense.date <= range.end), [data.expenses, range]);
  const pdfExpenseRows = useMemo(() => data.payslips.flatMap(item => (item.pdfExpenses ?? []).filter(expense => (expense.date || item.weekStart) >= range.start && (expense.date || item.weekStart) <= range.end)), [data.payslips, range]);
  const fuelRows = useMemo(() => pdfExpenseRows.filter(isCompanyFuelPdfRow), [pdfExpenseRows]);
  const fuelData = useMemo(() => {
    const rows = new Map<string, { jobRef: string; label: string; car: string; fuel: number; miles: number; costPerMile: number }>();
    for (const fuel of fuelRows) {
      const job = data.jobs.find(item => sourceKey(item.jobRef) === sourceKey(fuel.jobRef));
      const pdfJob = data.payslips.flatMap(item => item.pdfJobs ?? []).find(item => sourceKey(item.jobRef) === sourceKey(fuel.jobRef));
      const current = rows.get(fuel.jobRef) ?? {
        jobRef: fuel.jobRef,
        label: job?.registration || job?.payslipRegistration || pdfJob?.registration || fuel.jobRef,
        car: job?.makeModel || pdfJob?.description || (language === "ro" ? "Mașină neidentificată" : "Unidentified car"),
        fuel: 0,
        miles: job?.payslipMiles ?? job?.estimatedMiles ?? pdfJob?.miles ?? 0,
        costPerMile: 0
      };
      current.fuel += fuel.uploaded;
      current.costPerMile = current.miles ? current.fuel / current.miles : 0;
      rows.set(fuel.jobRef, current);
    }
    return [...rows.values()].sort((a, b) => b.fuel - a.fuel);
  }, [fuelRows, data.jobs, data.payslips, language]);
  const workStartData = useMemo(() => days.map(day => {
    const log = (data.dailyLogs ?? []).find(item => item.date === day.date);
    const firstJob = data.jobs
      .filter(job => job.collectionDate === day.date || job.deliveryDate === day.date)
      .flatMap(job => [job.collectionTime, job.deliveryTime])
      .filter((value): value is string => /^\d{2}:\d{2}$/.test(value))
      .sort()[0] ?? "";
    return { day: formatShortDate(day.date, language), date: day.date, homeStart: timeAsHours(log?.leftHomeTime ?? ""), firstJob: timeAsHours(firstJob) };
  }), [days, data.dailyLogs, data.jobs, language]);
  const protocolRows = useMemo(() => (Object.keys(PROTOCOLS) as JobProtocol[]).map(protocol => {
    const jobs = data.jobs.filter(job => job.protocol === protocol && job.status === "delivered" && (job.deliveryDate || job.collectionDate) >= range.start && (job.deliveryDate || job.collectionDate) <= range.end);
    return { protocol, jobs: jobs.length, supplement: jobs.reduce((sum, job) => sum + (job.protocolExtraPaid ?? job.protocolExtraDetected ?? 0), 0) };
  }).filter(row => row.jobs > 0), [data.jobs, range]);

  const issues = useMemo(() => {
    const manual = data.jobs.filter(job => job.source === "manual" && job.status === "delivered" && (job.deliveryDate || job.collectionDate) >= range.start && (job.deliveryDate || job.collectionDate) <= range.end);
    const pdfRows = data.payslips.flatMap(item => (item.pdfJobs ?? []).filter(job => (job.date || item.weekStart) >= range.start && (job.date || item.weekStart) <= range.end));
    const manualMap = new Map(manual.map(job => [sourceKey(job.jobRef), job]));
    const pdfMap = new Map(pdfRows.map(job => [sourceKey(job.jobRef), job]));
    const rows: string[] = [];
    for (const [ref, job] of manualMap) {
      const pdf = pdfMap.get(ref);
      if (!pdf) rows.push(language === "ro" ? `Job ${job.jobRef} lipsește din PDF.` : `Job ${job.jobRef} is missing from the PDF.`);
      else if (job.estimatedMiles !== null && Math.abs(job.estimatedMiles - pdf.miles) > .5) rows.push(language === "ro" ? `Job ${job.jobRef}: ${number(job.estimatedMiles)} mi la tine, ${number(pdf.miles)} mi în PDF.` : `Job ${job.jobRef}: ${number(job.estimatedMiles)} mi in your data, ${number(pdf.miles)} mi in PDF.`);
    }
    for (const [ref, pdf] of pdfMap) if (!manualMap.has(ref)) rows.push(language === "ro" ? `Job ${pdf.jobRef} apare în PDF, dar lipsește din evidența ta.` : `Job ${pdf.jobRef} is in the PDF but missing from your records.`);
    if (snapshot.paymentComparisonReady && snapshot.payDifference < -.01) rows.unshift(language === "ro" ? `Plata este cu ${money(Math.abs(snapshot.payDifference))} sub calculul tău.` : `Payment is ${money(Math.abs(snapshot.payDifference))} below your calculation.`);
    return rows;
  }, [data, range, language, snapshot.paymentComparisonReady, snapshot.payDifference]);

  const saveConfig = (next: InsightConfig[]) => { setConfig(next); localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); };
  const toggle = (id: InsightId) => saveConfig(config.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.length) return;
    const next = [...config];
    [next[index], next[target]] = [next[target], next[index]];
    saveConfig(next);
  };

  const label = (id: InsightId) => ({
    activity: language === "ro" ? "Activitate zilnică" : "Daily activity",
    money: language === "ro" ? "Bani și comparație" : "Money comparison",
    routes: language === "ro" ? "Rute profitabile" : "Profitable routes",
    time: language === "ro" ? "Timpul zilnic" : "Daily time",
    workStart: language === "ro" ? "Ora de început" : "Work start time",
    fuel: language === "ro" ? "Combustibil pe mașină" : "Fuel by car",
    expenses: language === "ro" ? "Cheltuieli pe categorii" : "Expenses by category",
    expenseAudit: language === "ro" ? "Controlul rambursărilor" : "Reimbursement control",
    protocols: language === "ro" ? "Protocoale speciale" : "Special protocols",
    sources: language === "ro" ? "Sursele datelor" : "Data sources"
  }[id]);

  const focusAllows = (id: InsightId) => {
    if (focus === "all") return true;
    const groups: Record<Exclude<Focus, "all">, InsightId[]> = {
      overview: ["activity", "workStart", "fuel", "money", "sources", "expenseAudit"],
      operations: ["activity", "workStart", "fuel", "routes", "protocols"],
      money: ["money", "sources", "expenseAudit"],
      time: ["workStart", "time", "activity"],
      expenses: ["fuel", "expenses", "expenseAudit"],
      audit: ["sources", "expenseAudit", "protocols"]
    };
    return groups[focus].includes(id);
  };

  const activityData = days.map(day => ({ day: formatShortDate(day.date, language), jobs: day.jobs, miles: day.miles }));
  const moneyData = [
    { name: language === "ro" ? "Perioada trecută" : "Previous", profit: previousSnapshot.realProfit, venit: previousSnapshot.gross, costuri: previousSnapshot.actualCosts },
    { name: language === "ro" ? "Perioada curentă" : "Current", profit: snapshot.realProfit, venit: snapshot.gross, costuri: snapshot.actualCosts }
  ];
  const sourceData = (["manual", "pdf", "combined"] as SourceChoice[]).map(key => ({ name: sourceLabel(key, language), jobs: totals[key].jobs, miles: totals[key].miles, income: totals[key].income, net: totals[key].net }));
  const timeData = days.map(day => ({ day: formatShortDate(day.date, language), liber: Math.max(0, day.minutesAway - day.productiveMinutes - day.waitingMinutes - day.publicTransportMinutes) / 60, productiv: day.productiveMinutes / 60, asteptare: day.waitingMinutes / 60, transport: day.publicTransportMinutes / 60 }));
  const expenseAuditData = [{ name: language === "ro" ? "Perioada" : "Period", cost: periodExpenses.reduce((sum, expense) => sum + expense.actualCost, 0), cerut: periodExpenses.reduce((sum, expense) => sum + expense.claimed, 0), platit: periodExpenses.reduce((sum, expense) => sum + expense.approved, 0) }];
  const personalExpenses = periodExpenses.filter(expense => expense.source === "manual" && expense.actualCost > 0 && expense.claimed <= 0);
  const partialExpenses = periodExpenses.filter(expense => expense.claimed > 0 && expense.approved > 0 && expense.approved + .01 < expense.claimed);
  const unpaidExpenses = periodExpenses.filter(expense => expense.claimed > 0 && expense.approved <= 0);
  const checkExpenses = pdfExpenseRows.filter(expense => !isCompanyFuelPdfRow(expense) && (expense.needsCheck || /\b(?:ticket|code|receipt|query|check|missing|rejected|awaiting|pending)\b/i.test(expense.actionNote ?? "")));

  const renderTrendChart = () => {
    const common = <><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(value: number) => formatMetric(metric, value)}/></>;
    if (chartStyle === "bar") return <BarChart data={trendData}>{common}<Bar dataKey={metric} name={metricLabel(metric, language)} fill={colors[0]} radius={[6, 6, 0, 0]}/></BarChart>;
    if (chartStyle === "line") return <LineChart data={trendData}>{common}<Line type="monotone" dataKey={metric} name={metricLabel(metric, language)} stroke={colors[2]} strokeWidth={3} dot={{ r: 3 }}/></LineChart>;
    return <AreaChart data={trendData}>{common}<Area type="monotone" dataKey={metric} name={metricLabel(metric, language)} stroke={colors[0]} fill="#56d7ff33" strokeWidth={2}/></AreaChart>;
  };

  const renderInsight = (id: InsightId) => {
    if (id === "activity") return <InsightCard title={label(id)} explanation={language === "ro" ? "Compară numărul de mașini cu milele plătibile pentru fiecare zi." : "Compares car count with payable miles for each day."}><ResponsiveContainer width="100%" height={270}><AreaChart data={activityData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Area type="monotone" dataKey="miles" stroke={colors[0]} fill="#56d7ff33"/><Area type="monotone" dataKey="jobs" stroke={colors[2]} fill="#23e6a833"/></AreaChart></ResponsiveContainer></InsightCard>;
    if (id === "workStart") return <InsightCard title={label(id)} explanation={language === "ro" ? "Compară ora plecării de acasă cu ora primului job. Lipsurile rămân vizibile, fără ore presupuse." : "Compares the time you left home with the first job time. Missing entries remain visible and are never assumed."}>{workStartData.some(row => row.homeStart !== null || row.firstJob !== null) ? <><ResponsiveContainer width="100%" height={230}><LineChart data={workStartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis domain={[0, 24]} tickFormatter={value => hoursAsTime(Number(value))}/><Tooltip formatter={(value: number) => hoursAsTime(value)}/><Legend/><Line type="monotone" dataKey="homeStart" name={language === "ro" ? "Plecare de acasă" : "Left home"} stroke={colors[1]} strokeWidth={3} connectNulls/><Line type="monotone" dataKey="firstJob" name={language === "ro" ? "Primul job" : "First job"} stroke={colors[2]} strokeWidth={3} connectNulls/></LineChart></ResponsiveContainer><div className="work-start-grid">{workStartData.filter(row => row.homeStart !== null || row.firstJob !== null).slice(-7).map(row => <div key={row.date}><strong>{row.day}</strong><span>{language === "ro" ? "Acasă" : "Home"} <b>{hoursAsTime(row.homeStart)}</b></span><span>{language === "ro" ? "Job" : "Job"} <b>{hoursAsTime(row.firstJob)}</b></span></div>)}</div></> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "fuel") return <InsightCard title={label(id)} explanation={language === "ro" ? "Sumele provin din PDF și au fost plătite cu cardul companiei. Nu sunt cheltuieli personale și nu necesită rambursare." : "Amounts come from the PDF and were paid with the company card. They are not personal expenses and require no reimbursement."}>{fuelData.length ? <><div className="fuel-insight-summary"><span><Fuel/><b>{money(fuelData.reduce((sum, row) => sum + row.fuel, 0))}</b><small>{language === "ro" ? "total card companie" : "company card total"}</small></span><span><CarFront/><b>{fuelData.length}</b><small>{language === "ro" ? "mașini alimentate" : "fuelled cars"}</small></span><span><Gauge/><b>{money(fuelData.reduce((sum, row) => sum + row.fuel, 0) / fuelData.length)}</b><small>{language === "ro" ? "medie pe mașină" : "average per car"}</small></span></div><ResponsiveContainer width="100%" height={220}><BarChart data={fuelData.slice(0, 10)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="fuel" name={language === "ro" ? "Combustibil £" : "Fuel £"} fill={colors[3]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer><div className="fuel-car-table"><div><span>{language === "ro" ? "Mașină" : "Car"}</span><span>Job Ref</span><span>{language === "ro" ? "Mile" : "Miles"}</span><span>{language === "ro" ? "Combustibil" : "Fuel"}</span><span>£/mi</span></div>{fuelData.slice(0, 8).map(row => <div key={row.jobRef}><span><strong>{row.label}</strong><small>{row.car}</small></span><span>{row.jobRef}</span><span>{number(row.miles)}</span><span>{money(row.fuel)}</span><span>{row.miles ? money(row.costPerMile) : "—"}</span></div>)}</div></> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "money") return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată venitul, costurile și profitul față de perioada anterioară." : "Shows income, costs and profit against the previous period."}><ResponsiveContainer width="100%" height={270}><BarChart data={moneyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="venit" fill={colors[0]} radius={[5,5,0,0]}/><Bar dataKey="costuri" fill={colors[4]} radius={[5,5,0,0]}/><Bar dataKey="profit" fill={colors[2]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></InsightCard>;
    if (id === "sources") return <InsightCard title={label(id)} explanation={language === "ro" ? "Compară datele tale, PDF-ul și rezultatul combinat fără dubluri." : "Compares your records, PDF data and the deduplicated combined result."}><ResponsiveContainer width="100%" height={270}><BarChart data={sourceData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="jobs" fill={colors[2]} radius={[5,5,0,0]}/><Bar dataKey="miles" fill={colors[0]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></InsightCard>;
    if (id === "expenseAudit") return <InsightCard title={label(id)} explanation={language === "ro" ? "Separă costul real, suma cerută și suma plătită. Taxiul nedeclarat rămâne cost personal." : "Separates actual cost, amount claimed and amount paid. Unreported taxi stays a personal cost."}><ResponsiveContainer width="100%" height={190}><BarChart data={expenseAuditData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="cost" fill={colors[4]} radius={[5,5,0,0]}/><Bar dataKey="cerut" fill={colors[3]} radius={[5,5,0,0]}/><Bar dataKey="platit" fill={colors[2]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer><div className="expense-audit-summary"><span><b>{personalExpenses.length}</b>{language === "ro" ? "personale" : "personal"}</span><span><b>{partialExpenses.length}</b>{language === "ro" ? "parțiale" : "part paid"}</span><span><b>{unpaidExpenses.length}</b>{language === "ro" ? "neplătite" : "unpaid"}</span><span className={checkExpenses.length ? "warn" : ""}><b>{checkExpenses.length}</b>{language === "ro" ? "de verificat" : "to check"}</span></div>{!!checkExpenses.length && <div className="expense-action-list">{checkExpenses.slice(0, 4).map((expense, index) => <p key={`${expense.date}-${expense.jobRef}-${index}`}><TriangleAlert/><span><strong>{expense.jobRef || expense.date}</strong>{expense.actionNote || (language === "ro" ? "Verifică ticketul sau codul din PDF." : "Check the ticket or code in the PDF.")}</span></p>)}</div>}</InsightCard>;
    if (id === "protocols") return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată platformele suplimentare și diferența pozitivă detectată față de tariful normal." : "Shows additional platforms and the positive difference detected against the normal tariff."}>{protocolRows.length ? <div className="protocol-insight-grid">{protocolRows.map(row => <div key={row.protocol}><ProtocolBadge protocol={row.protocol} language={language}/><span><b>{row.jobs}</b>{language === "ro" ? " joburi" : " jobs"}</span><span><b>{money(row.supplement)}</b>{language === "ro" ? " detectat" : " detected"}</span></div>)}</div> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "routes") return <InsightCard title={label(id)} explanation={language === "ro" ? "Clasifică rutele după profitul obținut pentru fiecare milă plătibilă." : "Ranks routes by profit earned for each payable mile."}>{routes.length ? <ResponsiveContainer width="100%" height={270}><BarChart layout="vertical" data={routes}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="route" width={115}/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="perMile" fill={colors[1]} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "time") return <InsightCard title={label(id)} explanation={language === "ro" ? "Împarte ziua între lucru productiv, așteptare și transport public." : "Breaks the day into productive work, waiting and public transport."}><ResponsiveContainer width="100%" height={270}><BarChart data={timeData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Bar stackId="time" dataKey="productiv" fill={colors[2]}/><Bar stackId="time" dataKey="asteptare" fill={colors[3]}/><Bar stackId="time" dataKey="transport" fill={colors[1]}/><Bar stackId="time" dataKey="liber" fill="#546078"/></BarChart></ResponsiveContainer><Link className="insight-link" to="/performance"><Clock3/>{language === "ro" ? "Completează orele pentru fiecare zi" : "Enter times for each day"}</Link></InsightCard>;
    return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată categoriile care îți reduc cel mai mult profitul." : "Shows the categories reducing your profit the most."}>{expenses.length ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={expenses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>{expenses.map((_, index) => <Cell key={index} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value: number) => money(value)}/><Legend/></PieChart></ResponsiveContainer> : <EmptyInsight language={language}/>}</InsightCard>;
  };

  const focusOptions: Array<[Focus, typeof BrainCircuit, string]> = [
    ["overview", BrainCircuit, language === "ro" ? "Rezumat" : "Overview"],
    ["operations", Route, language === "ro" ? "Operațiuni" : "Operations"],
    ["money", Banknote, language === "ro" ? "Bani" : "Money"],
    ["time", Clock3, language === "ro" ? "Timp" : "Time"],
    ["expenses", WalletCards, language === "ro" ? "Cheltuieli" : "Expenses"],
    ["audit", ShieldCheck, "Audit"],
    ["all", Layers3, language === "ro" ? "Tot" : "All"]
  ];

  return <div className="aris-intelligence intelligence-workspace">
    <section className="intelligence-hero">
      <div className="intelligence-title"><span><Sparkles/> A.R.I.S. INTELLIGENCE CORE</span><h1>{language === "ro" ? <>Analiza dumneavoastră, <em>Domnule Bogdan</em></> : <>Your analysis, <em>Sir Bogdan</em></>}</h1><p>{language === "ro" ? "Alege perioada, sursa și informația. Toate graficele se recalculează din aceleași joburi, PDF-uri și cheltuieli." : "Choose the period, source and information. Every chart recalculates from the same jobs, PDFs and expenses."}</p></div>
      <div className="intelligence-core" style={{ "--score": `${snapshot.dataQuality}%` } as CSSProperties}><span><BrainCircuit/><b>{snapshot.dataQuality}%</b><small>{language === "ro" ? "CALITATE DATE" : "DATA QUALITY"}</small></span></div>
      <div className="intelligence-status"><span><i className={issues.length ? "warn" : "ok"}/>{issues.length ? (language === "ro" ? `${issues.length} verificări necesare` : `${issues.length} checks needed`) : (language === "ro" ? "Date sincronizate" : "Data synchronised")}</span><strong>{formatDate(range.start, language)} · {formatDate(range.end, language)}</strong></div>
    </section>

    <section className="intelligence-control-deck">
      <div className="intelligence-focus-tabs">{focusOptions.map(([value, Icon, text]) => <button key={value} className={focus === value ? "active" : ""} onClick={() => setFocus(value)}><Icon/>{text}</button>)}</div>
      <div className="intelligence-filters">
        <label><span><CalendarDays/>{language === "ro" ? "Perioadă" : "Period"}</span><div className="intelligence-segmented">{(["day", "week", "month", "all"] as Scope[]).map(value => <button key={value} className={scope === value ? "active" : ""} onClick={() => setScope(value)} type="button">{value === "day" ? (language === "ro" ? "Zi" : "Day") : value === "week" ? (language === "ro" ? "Săptămână" : "Week") : value === "month" ? (language === "ro" ? "Lună" : "Month") : (language === "ro" ? "Tot" : "All")}</button>)}</div></label>
        <label><span>{language === "ro" ? "Data de control" : "Control date"}</span><input type="date" value={anchor} onChange={event => setAnchor(event.target.value)}/></label>
        <label><span>{language === "ro" ? "Sursa analizată" : "Analysed source"}</span><select value={source} onChange={event => setSource(event.target.value as SourceChoice)}><option value="combined">{sourceLabel("combined", language)}</option><option value="manual">{sourceLabel("manual", language)}</option><option value="pdf">PDF</option></select></label>
        <button className="intelligence-customise" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2/>{language === "ro" ? "Alege graficele" : "Choose charts"}</button>
      </div>
    </section>

    {settingsOpen && <section className="insights-config"><header><strong>{language === "ro" ? "Grafice active și ordine" : "Active charts and order"}</strong><p>{language === "ro" ? "Ascunde ce nu folosești și schimbă ordinea cu săgețile." : "Hide what you do not use and change the order with the arrows."}</p></header>{config.map((item, index) => <div key={item.id}><button onClick={() => toggle(item.id)}>{item.visible ? <Eye/> : <EyeOff/>}{label(item.id)}</button><span><button disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp/></button><button disabled={index === config.length - 1} onClick={() => move(index, 1)}><ArrowDown/></button></span></div>)}</section>}

    <section className="intelligence-kpis">
      <IntelligenceKpi icon={CarFront} label={language === "ro" ? "Mașini" : "Cars"} value={String(selected.jobs)} delta={deltaText(selected.jobs, selectedPrevious.jobs, language)} tone="cyan"/>
      <IntelligenceKpi icon={Route} label={language === "ro" ? "Mile plătibile" : "Payable miles"} value={number(selected.miles)} delta={deltaText(selected.miles, selectedPrevious.miles, language)} tone="purple"/>
      <IntelligenceKpi icon={Banknote} label={language === "ro" ? "Venit" : "Income"} value={money(selected.income)} delta={deltaText(selected.income, selectedPrevious.income, language)} tone="green"/>
      <IntelligenceKpi icon={WalletCards} label={language === "ro" ? "Costuri" : "Costs"} value={money(selected.costs)} delta={deltaText(selected.costs, selectedPrevious.costs, language, true)} tone="gold"/>
      <IntelligenceKpi icon={Gauge} label={language === "ro" ? "Net după costuri" : "Net after costs"} value={money(selected.net)} delta={deltaText(selected.net, selectedPrevious.net, language)} tone="blue"/>
    </section>

    <section className="intelligence-lab">
      <header><div><span><ChartNoAxesCombined/> {language === "ro" ? "LABORATOR DE DATE" : "DATA LAB"}</span><h2>{metricLabel(metric, language)} · {sourceLabel(source, language)}</h2><p>{language === "ro" ? "Schimbă indicatorul și tipul graficului. Datele sunt grupate zilnic sau lunar, în funcție de perioadă." : "Change the metric and chart type. Data is grouped daily or monthly, based on the period."}</p></div><div className="intelligence-chart-controls"><label><ListFilter/>{language === "ro" ? "Indicator" : "Metric"}<select value={metric} onChange={event => setMetric(event.target.value as Metric)}>{(["income", "net", "costs", "jobs", "miles"] as Metric[]).map(value => <option key={value} value={value}>{metricLabel(value, language)}</option>)}</select></label><div>{(["area", "bar", "line"] as ChartStyle[]).map(value => <button key={value} className={chartStyle === value ? "active" : ""} onClick={() => setChartStyle(value)}>{value === "area" ? "AREA" : value === "bar" ? "BAR" : "LINE"}</button>)}</div></div></header>
      <div className="intelligence-main-chart"><ResponsiveContainer width="100%" height={330}>{renderTrendChart()}</ResponsiveContainer></div>
    </section>

    <section className={`intelligence-verdict ${issues.length ? "warn" : "ok"}`}><BrainCircuit/><div><span>A.R.I.S. LIVE VERDICT</span><strong>{issues.length ? (language === "ro" ? `Domnule, am găsit ${issues.length} diferențe în perioada aleasă.` : `Sir, I found ${issues.length} differences in the selected period.`) : (language === "ro" ? "Domnule, datele disponibile nu arată diferențe." : "Sir, the available data shows no differences.")}</strong><p>{language === "ro" ? `Analiza folosește sursa ${sourceLabel(source, language).toLowerCase()} și ${selected.jobs} mașini.` : `The analysis uses ${sourceLabel(source, language).toLowerCase()} and ${selected.jobs} cars.`}</p></div><button onClick={() => setFocus("audit")}><ShieldCheck/>{language === "ro" ? "Deschide auditul" : "Open audit"}</button></section>

    {(focus === "audit" || focus === "all") && !!issues.length && <section className="insights-issues"><h2>{language === "ro" ? "Diferențe găsite" : "Detected differences"}</h2>{issues.map((issue, index) => <div key={`${issue}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{issue}</p></div>)}</section>}

    <div className="intelligence-section-heading"><div><span>{language === "ro" ? "ANALIZĂ DETALIATĂ" : "DETAILED ANALYSIS"}</span><h2>{focusOptions.find(([value]) => value === focus)?.[2]}</h2></div><small>{config.filter(item => item.visible && focusAllows(item.id)).length} {language === "ro" ? "grafice active" : "active charts"}</small></div>
    <section className="insights-grid intelligence-grid">{config.filter(item => item.visible && focusAllows(item.id)).map(item => <div key={item.id}>{renderInsight(item.id)}</div>)}</section>
  </div>;
}

function deltaText(current: number, previous: number, language: Language, reverse = false) {
  if (!previous) return language === "ro" ? "Fără comparație anterioară" : "No previous comparison";
  const change = Math.round((current - previous) / Math.abs(previous) * 100);
  const direction = change === 0 ? "" : change > 0 ? "+" : "";
  const interpretation = change === 0 ? (language === "ro" ? "fără schimbare" : "no change") : (reverse ? change <= 0 : change >= 0) ? (language === "ro" ? "favorabil" : "favourable") : (language === "ro" ? "de urmărit" : "watch");
  return `${direction}${change}% · ${interpretation}`;
}

function IntelligenceKpi({ icon: Icon, label, value, delta, tone }: { icon: typeof Activity; label: string; value: string; delta: string; tone: string }) {
  return <article className={`intelligence-kpi ${tone}`}><div><Icon/><span>{label}</span></div><strong>{value}</strong><small>{delta}</small></article>;
}

function InsightCard({ title, explanation, children }: { title: string; explanation: string; children: ReactNode }) {
  return <article className="insight-chart-card"><header><h2>{title}</h2><p>{explanation}</p></header>{children}</article>;
}

function EmptyInsight({ language }: { language: Language }) {
  return <div className="insight-empty">{language === "ro" ? "Nu există date pentru perioada aleasă." : "No data for the selected period."}</div>;
}
