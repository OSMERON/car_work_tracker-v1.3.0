import { CalendarDays, ChevronLeft, ChevronRight, FileCheck2, Route } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, StatCard, money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatDate, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { dailyWorkRows, monthBounds, payslipTotalForRange } from "../lib/reports";

type ViewMode = "day" | "week" | "month";

const moveMonth = (iso: string, amount: number) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return date.toLocaleDateString("en-CA");
};

export function ReportsPage() {
  const { data, language } = useData();
  const [mode, setMode] = useState<ViewMode>("week");
  const [focus, setFocus] = useState(todayIso());
  const range = useMemo(() => {
    if (mode === "day") return { start: focus, end: focus };
    if (mode === "week") {
      const start = mondayOf(focus);
      return { start, end: addDays(start, 6) };
    }
    return monthBounds(focus);
  }, [focus, mode]);
  const rows = dailyWorkRows(data, range.start, range.end);
  const totals = rows.reduce((result, row) => ({
    jobs: result.jobs + row.jobs,
    miles: result.miles + row.miles,
    jobPay: result.jobPay + row.jobPay,
    reimbursements: result.reimbursements + row.reimbursements,
    costs: result.costs + row.costs
  }), { jobs: 0, miles: 0, jobPay: 0, reimbursements: 0, costs: 0 });
  const pdfTotal = payslipTotalForRange(data, range.start, range.end);
  const dayJobs = data.jobs.filter(job => job.collectionDate === focus || job.deliveryDate === focus);

  const move = (direction: number) => {
    if (mode === "day") setFocus(addDays(focus, direction));
    else if (mode === "week") setFocus(addDays(focus, direction * 7));
    else setFocus(moveMonth(focus, direction));
  };

  const title = mode === "day" ? formatDate(focus, language) : mode === "week" ? `${formatDate(range.start, language)} - ${formatDate(range.end, language)}` : new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", { month: "long", year: "numeric" }).format(new Date(`${focus}T12:00:00`));

  return <>
    <PageHeader eyebrow={language === "ro" ? "Din joburi și PDF-uri" : "From jobs and PDFs"} title={language === "ro" ? "Calendar și rapoarte" : "Calendar and reports"} subtitle={language === "ro" ? "Vezi separat fiecare zi, fiecare săptămână și fiecare lună." : "Review every day, week and month separately."}/>
    <section className="report-toolbar">
      <div className="segmented"><button className={mode === "day" ? "active" : ""} onClick={() => setMode("day")}>{language === "ro" ? "Zi" : "Day"}</button><button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>{language === "ro" ? "Săptămână" : "Week"}</button><button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>{language === "ro" ? "Lună" : "Month"}</button></div>
      <div className="period-navigation"><button className="icon-button" onClick={() => move(-1)}><ChevronLeft/></button><strong>{title}</strong><button className="icon-button" onClick={() => move(1)}><ChevronRight/></button><input type="date" value={focus} onChange={event => setFocus(event.target.value)}/></div>
    </section>
    <section className="stats-grid report-stats"><StatCard label={language === "ro" ? "Joburi livrate" : "Delivered jobs"} value={String(totals.jobs)} tone="green"/><StatCard label={language === "ro" ? "Mile" : "Miles"} value={number(totals.miles)}/><StatCard label={language === "ro" ? "Plată joburi din PDF" : "PDF job pay"} value={money(totals.jobPay)} tone="amber"/><StatCard label={language === "ro" ? "Rambursări" : "Reimbursements"} value={money(totals.reimbursements)}/><StatCard label={language === "ro" ? "Costuri reale" : "Actual costs"} value={money(totals.costs)}/><StatCard label={language === "ro" ? "Total fluturași" : "Payslip total"} value={money(pdfTotal)} tone="green"/></section>
    {mode === "month" ? <MonthCalendar rows={rows} month={focus.slice(0, 7)} language={language} onPick={date => { setFocus(date); setMode("day"); }}/> : mode === "week" ? <div className="week-day-grid">{rows.map(row => <DayCard key={row.date} row={row} language={language} onPick={() => { setFocus(row.date); setMode("day"); }}/>)}</div> : <section className="section-block"><div className="section-title"><div><h2>{formatDate(focus, language)}</h2><p>{dayJobs.length} {language === "ro" ? "înregistrări" : "records"}</p></div></div>{dayJobs.length ? <div className="report-job-list">{dayJobs.map(job => <article key={job.id}><span className="reg">{job.registration || "NO REG"}</span><div><strong>{job.jobRef || job.makeModel}</strong><small>{job.pickupTown || "?"} → {job.deliveryTown || "?"}</small></div><span><Route size={15}/>{number(job.actualMiles ?? job.payslipMiles ?? job.estimatedMiles ?? 0)} mi</span></article>)}</div> : <div className="empty">{language === "ro" ? "Nu există joburi pentru această zi." : "No jobs for this day."}</div>}</section>}
    <div className="report-explanation"><FileCheck2/><div><strong>{language === "ro" ? "Cum sunt împărțite sumele" : "How amounts are allocated"}</strong><p>{language === "ro" ? "Plata fiecărui job și rambursările folosesc data din PDF. Reward, bonus, deduceri și taxa administrativă rămân la nivelul întregii săptămâni, în totalul fluturașului." : "Each job payment and reimbursement uses its PDF date. Reward, bonus, deductions and the administration fee stay at whole-week level in the payslip total."}</p></div></div>
  </>;
}

function DayCard({ row, language, onPick }: { row: ReturnType<typeof dailyWorkRows>[number]; language: "ro" | "en"; onPick: () => void }) {
  return <button className="day-report-card" onClick={onPick}><header><CalendarDays size={18}/><strong>{formatShortDate(row.date, language)}</strong></header><div><span>{language === "ro" ? "Joburi" : "Jobs"}</span><strong>{row.jobs}</strong></div><div><span>{language === "ro" ? "Mile" : "Miles"}</span><strong>{number(row.miles)}</strong></div><div><span>{language === "ro" ? "Plată joburi" : "Job pay"}</span><strong>{money(row.jobPay)}</strong></div><div><span>{language === "ro" ? "Rambursări" : "Reimbursements"}</span><strong>{money(row.reimbursements)}</strong></div></button>;
}

function MonthCalendar({ rows, month, language, onPick }: { rows: ReturnType<typeof dailyWorkRows>; month: string; language: "ro" | "en"; onPick: (date: string) => void }) {
  const first = rows[0]?.date ?? `${month}-01`;
  const blanks = (new Date(`${first}T12:00:00`).getDay() + 6) % 7;
  const labels = language === "ro" ? ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <section className="month-calendar"><div className="month-labels">{labels.map(label => <strong key={label}>{label}</strong>)}</div><div className="month-grid">{Array.from({ length: blanks }, (_, index) => <span key={`blank-${index}`} className="month-blank"/>)}{rows.map(row => <button key={row.date} onClick={() => onPick(row.date)} className={row.jobs ? "has-work" : ""}><strong>{Number(row.date.slice(-2))}</strong>{row.jobs > 0 && <><span>{row.jobs} {language === "ro" ? "joburi" : "jobs"}</span><small>{number(row.miles)} mi</small><small>{money(row.jobPay)}</small></>}</button>)}</div></section>;
}
