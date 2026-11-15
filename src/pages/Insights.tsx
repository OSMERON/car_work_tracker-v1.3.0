import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BrainCircuit, Clock3, Eye, EyeOff, Settings2, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, money, number } from "../components/Ui";
import { SourceMatrix } from "../components/SourceMatrix";
import { useData } from "../store/DataContext";
import { addDays, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { expenseGroups } from "../lib/analytics";
import { performanceDays, performanceSnapshot, routePerformance } from "../lib/performance";
import { calculateSourceTotals } from "../lib/sourceTotals";
import { ProtocolBadge } from "../components/ProtocolBadge";
import { PROTOCOLS } from "../lib/jobProtocols";
import type { JobProtocol } from "../types";

type InsightId = "activity" | "money" | "routes" | "time" | "expenses" | "expenseAudit" | "protocols" | "sources";
type InsightConfig = { id: InsightId; visible: boolean };
const DEFAULT_CONFIG: InsightConfig[] = ["activity", "money", "sources", "expenseAudit", "protocols", "routes", "time", "expenses"].map(id => ({ id: id as InsightId, visible: true }));
const CONFIG_KEY = "aris-insights-config-v1";
const colors = ["#56d7ff", "#8c7cff", "#23e6a8", "#ffb84d", "#ff5c85", "#42a5f5"];
const sourceKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeConfig = (value: unknown): InsightConfig[] => {
  const known = new Set(DEFAULT_CONFIG.map(item => item.id));
  const saved = Array.isArray(value) ? value.filter((item): item is InsightConfig => Boolean(item && typeof item === "object" && "id" in item && known.has((item as InsightConfig).id))).map(item => ({ id: item.id, visible: item.visible !== false })) : [];
  return [...saved, ...DEFAULT_CONFIG.filter(item => !saved.some(savedItem => savedItem.id === item.id))];
};

export function InsightsPage() {
  const { data, language } = useData();
  const [weekStart, setWeekStart] = useState(mondayOf(todayIso()));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<InsightConfig[]>(() => {
    try { return normalizeConfig(JSON.parse(localStorage.getItem(CONFIG_KEY) || "null")); } catch { return DEFAULT_CONFIG; }
  });
  const end = addDays(weekStart, 6);
  const previousStart = addDays(weekStart, -7);
  const previousEnd = addDays(weekStart, -1);
  const totals = useMemo(() => calculateSourceTotals(data, weekStart, end), [data, weekStart, end]);
  const snapshot = useMemo(() => performanceSnapshot(data, weekStart, end), [data, weekStart, end]);
  const previous = useMemo(() => performanceSnapshot(data, previousStart, previousEnd), [data, previousStart, previousEnd]);
  const days = useMemo(() => performanceDays(data, weekStart, end), [data, weekStart, end]);
  const routes = useMemo(() => routePerformance(data, weekStart, end).slice(0, 7), [data, weekStart, end]);
  const expenses = useMemo(() => expenseGroups(data.expenses, weekStart, end).slice(0, 7), [data.expenses, weekStart, end]);
  const periodExpenses = useMemo(() => data.expenses.filter(expense => expense.date >= weekStart && expense.date <= end), [data.expenses, weekStart, end]);
  const pdfExpenseRows = useMemo(() => data.payslips.filter(item => item.weekStart >= weekStart && item.weekStart <= end).flatMap(item => item.pdfExpenses ?? []), [data.payslips, weekStart, end]);
  const protocolRows = useMemo(() => (Object.keys(PROTOCOLS) as JobProtocol[]).map(protocol => {
    const jobs = data.jobs.filter(job => job.protocol === protocol && job.status === "delivered" && (job.deliveryDate || job.collectionDate) >= weekStart && (job.deliveryDate || job.collectionDate) <= end);
    return { protocol, jobs: jobs.length, supplement: jobs.reduce((sum, job) => sum + (job.protocolExtraPaid ?? job.protocolExtraDetected ?? 0), 0) };
  }).filter(row => row.jobs > 0), [data.jobs, weekStart, end]);

  const issues = useMemo(() => {
    const manual = data.jobs.filter(job => job.source === "manual" && job.status === "delivered" && (job.deliveryDate || job.collectionDate) >= weekStart && (job.deliveryDate || job.collectionDate) <= end);
    const pdfRows = data.payslips.filter(item => item.weekStart >= weekStart && item.weekStart <= end).flatMap(item => item.pdfJobs ?? []);
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
  }, [data, weekStart, end, language, snapshot.paymentComparisonReady, snapshot.payDifference]);

  const saveConfig = (next: InsightConfig[]) => { setConfig(next); localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); };
  const toggle = (id: InsightId) => saveConfig(config.map(item => item.id === id ? { ...item, visible: !item.visible } : item));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= config.length) return;
    const next = [...config];
    [next[index], next[target]] = [next[target], next[index]];
    saveConfig(next);
  };
  const label = (id: InsightId) => ({ activity: language === "ro" ? "Activitate zilnică" : "Daily activity", money: language === "ro" ? "Bani și comparație" : "Money comparison", routes: language === "ro" ? "Rute profitabile" : "Profitable routes", time: language === "ro" ? "Timpul zilnic" : "Daily time", expenses: language === "ro" ? "Cheltuieli pe categorii" : "Expenses by category", expenseAudit: language === "ro" ? "Controlul rambursărilor" : "Reimbursement control", protocols: language === "ro" ? "Protocoale speciale" : "Special protocols", sources: language === "ro" ? "Sursele datelor" : "Data sources" }[id]);

  const activityData = days.map(day => ({ day: formatShortDate(day.date, language), jobs: day.jobs, miles: day.miles }));
  const moneyData = [
    { name: language === "ro" ? "Săpt. trecută" : "Previous", profit: previous.realProfit, venit: previous.gross, costuri: previous.actualCosts },
    { name: language === "ro" ? "Săpt. curentă" : "Current", profit: snapshot.realProfit, venit: snapshot.gross, costuri: snapshot.actualCosts }
  ];
  const sourceData = ["manual", "pdf", "combined"].map(key => ({ name: key === "manual" ? "Manual" : key === "pdf" ? "PDF" : (language === "ro" ? "Combinat" : "Combined"), jobs: totals[key as keyof typeof totals].jobs, miles: totals[key as keyof typeof totals].miles, income: totals[key as keyof typeof totals].income }));
  const timeData = days.map(day => ({ day: formatShortDate(day.date, language), acasa: Math.max(0, day.minutesAway - day.productiveMinutes - day.waitingMinutes - day.publicTransportMinutes) / 60, productiv: day.productiveMinutes / 60, asteptare: day.waitingMinutes / 60, transport: day.publicTransportMinutes / 60 }));
  const expenseAuditData = [{
    name: language === "ro" ? "Săptămâna" : "Week",
    cost: periodExpenses.reduce((sum, expense) => sum + expense.actualCost, 0),
    cerut: periodExpenses.reduce((sum, expense) => sum + expense.claimed, 0),
    platit: periodExpenses.reduce((sum, expense) => sum + expense.approved, 0)
  }];
  const personalExpenses = periodExpenses.filter(expense => expense.source === "manual" && expense.actualCost > 0 && expense.claimed <= 0);
  const partialExpenses = periodExpenses.filter(expense => expense.claimed > 0 && expense.approved > 0 && expense.approved + .01 < expense.claimed);
  const unpaidExpenses = periodExpenses.filter(expense => expense.claimed > 0 && expense.approved <= 0);
  const checkExpenses = pdfExpenseRows.filter(expense => expense.needsCheck || /\b(?:ticket|code|receipt|query|check|missing|rejected|awaiting|pending)\b/i.test(expense.actionNote ?? ""));

  const renderInsight = (id: InsightId) => {
    if (id === "activity") return <InsightCard title={label(id)} explanation={language === "ro" ? "Compară numărul de joburi cu milele plătibile pentru fiecare zi." : "Compares job count with payable miles for each day."}><ResponsiveContainer width="100%" height={270}><AreaChart data={activityData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Area type="monotone" dataKey="miles" stroke={colors[0]} fill="#56d7ff33"/><Area type="monotone" dataKey="jobs" stroke={colors[2]} fill="#23e6a833"/></AreaChart></ResponsiveContainer></InsightCard>;
    if (id === "money") return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată venitul, costurile și profitul față de săptămâna anterioară." : "Shows income, costs and profit against the previous week."}><ResponsiveContainer width="100%" height={270}><BarChart data={moneyData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="venit" fill={colors[0]} radius={[5,5,0,0]}/><Bar dataKey="costuri" fill={colors[4]} radius={[5,5,0,0]}/><Bar dataKey="profit" fill={colors[2]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></InsightCard>;
    if (id === "sources") return <InsightCard title={label(id)} explanation={language === "ro" ? "Păstrează separat valorile tale, valorile PDF și rezultatul combinat fără dubluri." : "Keeps your values, PDF values and deduplicated combined result separate."}><ResponsiveContainer width="100%" height={270}><BarChart data={sourceData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="jobs" fill={colors[2]} radius={[5,5,0,0]}/><Bar dataKey="miles" fill={colors[0]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></InsightCard>;
    if (id === "expenseAudit") return <InsightCard title={label(id)} explanation={language === "ro" ? "Separă costul real, suma cerută și suma plătită. Taxiul sau Uberul nedeclarat rămâne cost personal." : "Separates actual cost, amount claimed and amount paid. Unreported taxi or Uber stays a personal cost."}><ResponsiveContainer width="100%" height={190}><BarChart data={expenseAuditData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip formatter={(value: number) => money(value)}/><Legend/><Bar dataKey="cost" fill={colors[4]} radius={[5,5,0,0]}/><Bar dataKey="cerut" fill={colors[3]} radius={[5,5,0,0]}/><Bar dataKey="platit" fill={colors[2]} radius={[5,5,0,0]}/></BarChart></ResponsiveContainer><div className="expense-audit-summary"><span><b>{personalExpenses.length}</b>{language === "ro" ? "personale" : "personal"}</span><span><b>{partialExpenses.length}</b>{language === "ro" ? "plătite parțial" : "part paid"}</span><span><b>{unpaidExpenses.length}</b>{language === "ro" ? "neplătite" : "unpaid"}</span><span className={checkExpenses.length ? "warn" : ""}><b>{checkExpenses.length}</b>{language === "ro" ? "de verificat" : "to check"}</span></div>{!!checkExpenses.length && <div className="expense-action-list">{checkExpenses.slice(0, 4).map((expense, index) => <p key={`${expense.date}-${expense.jobRef}-${index}`}><TriangleAlert/><span><strong>{expense.jobRef || expense.date}</strong>{expense.actionNote || (language === "ro" ? "Verifică ticketul sau codul din PDF." : "Check the ticket or code in the PDF.")}</span></p>)}</div>}</InsightCard>;
    if (id === "protocols") return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată platformele suplimentare și diferența pozitivă detectată față de tariful normal. Confirmă motivul în PDF înainte să o consideri supliment." : "Shows additional platforms and the positive difference detected against the normal tariff. Confirm the reason in the PDF before treating it as a supplement."}>{protocolRows.length ? <div className="protocol-insight-grid">{protocolRows.map(row => <div key={row.protocol}><ProtocolBadge protocol={row.protocol} language={language}/><span><b>{row.jobs}</b>{language === "ro" ? " joburi" : " jobs"}</span><span><b>{money(row.supplement)}</b>{language === "ro" ? " detectat" : " detected"}</span></div>)}</div> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "routes") return <InsightCard title={label(id)} explanation={language === "ro" ? "Clasifică rutele după profitul obținut pentru fiecare milă plătibilă." : "Ranks routes by profit earned for each payable mile."}>{routes.length ? <ResponsiveContainer width="100%" height={270}><BarChart layout="vertical" data={routes}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="route" width={115}/><Tooltip formatter={(value: number) => money(value)}/><Bar dataKey="perMile" fill={colors[1]} radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <EmptyInsight language={language}/>}</InsightCard>;
    if (id === "time") return <InsightCard title={label(id)} explanation={language === "ro" ? "Folosește separat ora plecării și ora sosirii pentru a împărți timpul zilei." : "Uses separate departure and arrival times to break down your day."}><ResponsiveContainer width="100%" height={270}><BarChart data={timeData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Bar stackId="time" dataKey="productiv" fill={colors[2]}/><Bar stackId="time" dataKey="asteptare" fill={colors[3]}/><Bar stackId="time" dataKey="transport" fill={colors[1]}/><Bar stackId="time" dataKey="acasa" fill="#546078"/></BarChart></ResponsiveContainer><Link className="insight-link" to="/performance"><Clock3/>{language === "ro" ? "Completează orele pentru fiecare zi" : "Enter times for each day"}</Link></InsightCard>;
    return <InsightCard title={label(id)} explanation={language === "ro" ? "Arată categoriile care îți reduc cel mai mult profitul săptămânal." : "Shows the categories reducing weekly profit the most."}>{expenses.length ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={expenses} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>{expenses.map((_, index) => <Cell key={index} fill={colors[index % colors.length]}/>)}</Pie><Tooltip formatter={(value: number) => money(value)}/><Legend/></PieChart></ResponsiveContainer> : <EmptyInsight language={language}/>}</InsightCard>;
  };

  return <div className="aris-intelligence">
    <PageHeader eyebrow="A.R.I.S. · ADAPTIVE ROUTE INTELLIGENCE SYSTEM" title={language === "ro" ? "Domnule, acesta este rezumatul săptămânii" : "Sir, this is your weekly summary"} subtitle={language === "ro" ? "Date manuale, PDF și total combinat. Fiecare diferență rămâne vizibilă." : "Manual data, PDF data and combined totals. Every difference stays visible."} action={<button className="secondary-button" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2/>{language === "ro" ? "Personalizează" : "Customise"}</button>}/>
    <div className="insights-toolbar"><label>{language === "ro" ? "Săptămâna" : "Week"}<input type="date" value={weekStart} onChange={event => setWeekStart(mondayOf(event.target.value))}/></label><div className={`insights-alert-count ${issues.length ? "warn" : "ok"}`}>{issues.length ? <TriangleAlert/> : <BrainCircuit/>}<span><strong>{issues.length}</strong>{language === "ro" ? " probleme de verificat" : " issues to review"}</span></div></div>
    {settingsOpen && <section className="insights-config"><header><strong>{language === "ro" ? "Grafice active și ordine" : "Active charts and order"}</strong><p>{language === "ro" ? "Ascunde ce nu folosești și schimbă ordinea cu săgețile." : "Hide what you do not use and change the order with the arrows."}</p></header>{config.map((item, index) => <div key={item.id}><button onClick={() => toggle(item.id)}>{item.visible ? <Eye/> : <EyeOff/>}{label(item.id)}</button><span><button disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp/></button><button disabled={index === config.length - 1} onClick={() => move(index, 1)}><ArrowDown/></button></span></div>)}</section>}
    <SourceMatrix totals={totals}/>
    <section className={`insights-brief ${issues.length ? "warn" : "ok"}`}><BrainCircuit/><div><strong>{language === "ro" ? "Raport A.R.I.S." : "A.R.I.S. report"}</strong><p>{issues.length ? (language === "ro" ? `Domnule, am găsit ${issues.length} diferențe. Verifică lista înainte de următoarea plată.` : `Sir, I found ${issues.length} differences. Review the list before the next payment.`) : (language === "ro" ? "Domnule, nu am găsit diferențe în datele disponibile." : "Sir, I found no differences in the available data.")}</p></div></section>
    {!!issues.length && <section className="insights-issues"><h2>{language === "ro" ? "Numai problemele găsite" : "Detected issues only"}</h2>{issues.map((issue, index) => <div key={`${issue}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><p>{issue}</p></div>)}</section>}
    <section className="insights-grid">{config.filter(item => item.visible).map(item => <div key={item.id}>{renderInsight(item.id)}</div>)}</section>
  </div>;
}

function InsightCard({ title, explanation, children }: { title: string; explanation: string; children: React.ReactNode }) { return <article className="insight-chart-card"><header><h2>{title}</h2><p>{explanation}</p></header>{children}</article>; }
function EmptyInsight({ language }: { language: "ro" | "en" }) { return <div className="insight-empty">{language === "ro" ? "Nu există date pentru această săptămână." : "No data for this week."}</div>; }
