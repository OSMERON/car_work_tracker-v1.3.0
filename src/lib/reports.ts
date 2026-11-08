import type { AppData } from "../types";
import { addDays, isoInRange } from "./date";
import { jobEarnings, jobMiles } from "./analytics";

export interface DailyWorkRow {
  date: string;
  jobs: number;
  miles: number;
  jobPay: number;
  reimbursements: number;
  costs: number;
}

export const dailyWorkRows = (data: AppData, start: string, end: string): DailyWorkRow[] => {
  const rows: DailyWorkRow[] = [];
  let date = start;
  while (date <= end) {
    const jobs = data.jobs.filter(job => job.status === "delivered" && job.deliveryDate === date);
    const pdfJobPay = data.payslips.flatMap(payslip => payslip.pdfJobs ?? []).filter(job => job.date === date).reduce((sum, job) => sum + job.paid, 0);
    const reimbursements = data.payslips.flatMap(payslip => payslip.pdfExpenses ?? []).filter(expense => expense.date === date).reduce((sum, expense) => sum + expense.payable, 0);
    const costs = data.expenses.filter(expense => expense.date === date).reduce((sum, expense) => sum + expense.actualCost, 0);
    rows.push({
      date,
      jobs: jobs.length,
      miles: jobs.reduce((sum, job) => sum + jobMiles(job), 0),
      jobPay: pdfJobPay || jobs.reduce((sum, job) => sum + jobEarnings(job), 0),
      reimbursements,
      costs
    });
    date = addDays(date, 1);
  }
  return rows;
};

export const payslipTotalForRange = (data: AppData, start: string, end: string) => data.payslips
  .filter(payslip => isoInRange(payslip.weekStart, start, end))
  .reduce((sum, payslip) => sum + payslip.totalPaid, 0);

export const monthBounds = (iso: string) => {
  const start = `${iso.slice(0, 7)}-01`;
  const date = new Date(`${start}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return { start, end: date.toLocaleDateString("en-CA") };
};
