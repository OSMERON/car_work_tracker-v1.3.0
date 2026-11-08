import type { AppData, Expense, Job } from "../types";
import { addDays, isoInRange, mondayOf } from "./date";

export const jobMiles = (job: Job) => job.actualMiles ?? job.payslipMiles ?? job.estimatedMiles ?? 0;
export const jobEarnings = (job: Job) => (job.tariffPaid ?? 0) + (job.waitingPaid ?? 0);

export interface PeriodSummary {
  collected: number; delivered: number; active: number; miles: number; earnings: number;
  actualCosts: number; approved: number; profit: number; waiting: number; carryOver: number;
}

export const summarize = (data: AppData, start: string, end: string): PeriodSummary => {
  const jobs = data.jobs.filter(j => isoInRange(j.deliveryDate || j.collectionDate, start, end));
  const expenses = data.expenses.filter(e => isoInRange(e.date, start, end));
  const payslips = data.payslips.filter(p => isoInRange(p.weekStart, start, end));
  const actualPaid = payslips.reduce((a,p) => a + p.totalPaid, 0);
  const earnings = actualPaid || jobs.reduce((a,j) => a + jobEarnings(j), 0);
  const actualCosts = expenses.reduce((a,e) => a + e.actualCost, 0);
  return {
    collected: jobs.filter(j => j.status !== "cancelled").length,
    delivered: jobs.filter(j => j.status === "delivered").length,
    active: data.jobs.filter(j => j.status === "collected").length,
    miles: jobs.filter(j => j.status === "delivered").reduce((a,j) => a + jobMiles(j), 0),
    earnings, actualCosts,
    approved: expenses.reduce((a,e) => a + e.approved, 0),
    profit: earnings - actualCosts,
    waiting: jobs.reduce((a,j) => a + (j.waitingPaid ?? j.waitingEstimated ?? 0), 0),
    carryOver: jobs.filter(j => j.collectionDate && j.deliveryDate && j.collectionDate !== j.deliveryDate).length
  };
};

export const weeklySeries = (data: AppData, start: string, end: string) => {
  const weeks = new Map<string,{week:string,deliveries:number,miles:number,earnings:number,costs:number}>();
  let cursor = mondayOf(start);
  while (cursor <= end) {
    weeks.set(cursor,{week:cursor,deliveries:0,miles:0,earnings:0,costs:0});
    cursor=addDays(cursor,7);
  }
  data.jobs.forEach(job => {
    const d=job.deliveryDate || job.collectionDate;
    if (!isoInRange(d,start,end) || job.status==="cancelled") return;
    const w=mondayOf(d); const row=weeks.get(w);
    if (!row) return;
    if (job.status==="delivered") row.deliveries += 1;
    row.miles += jobMiles(job);
    row.earnings += jobEarnings(job);
  });
  data.payslips.forEach(p => { const row=weeks.get(p.weekStart); if(row) row.earnings=p.totalPaid; });
  data.expenses.forEach(e => { const w=mondayOf(e.date); const row=weeks.get(w); if(row) row.costs+=e.actualCost; });
  return [...weeks.values()];
};

export const expenseGroups = (expenses: Expense[], start: string, end: string) => {
  const groups=new Map<string,number>();
  expenses.filter(e=>isoInRange(e.date,start,end)).forEach(e=>groups.set(e.category,(groups.get(e.category)||0)+e.actualCost));
  return [...groups].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
};

export const modelGroups = (jobs: Job[], start: string, end: string) => {
  const groups=new Map<string,number>();
  jobs.filter(j=>j.status==="delivered"&&isoInRange(j.deliveryDate,start,end)&&j.makeModel.trim()).forEach(j=>groups.set(j.makeModel.trim(),(groups.get(j.makeModel.trim())||0)+1));
  return [...groups].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
};
