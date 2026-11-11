import type { AppData, PayslipExpense, PayslipJob } from "../types";
import { isoInRange } from "./date";
import { tariffForMiles } from "./rates";

export interface SourceTotal {
  jobs: number;
  miles: number;
  income: number;
  costs: number;
  net: number;
}

export interface SourceTotals {
  manual: SourceTotal;
  pdf: SourceTotal;
  combined: SourceTotal;
}

const key = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const finish = (value: Omit<SourceTotal, "net">): SourceTotal => ({ ...value, net: round(value.income - value.costs) });

export const calculateSourceTotals = (data: AppData, start: string, end: string): SourceTotals => {
  const manualJobs = data.jobs.filter(job => job.source === "manual" && job.status === "delivered" && isoInRange(job.deliveryDate || job.collectionDate, start, end));
  const manualRefs = new Set(manualJobs.map(job => key(job.jobRef)).filter(Boolean));
  const manualExpenses = data.expenses.filter(expense => expense.source === "manual" && isoInRange(expense.date, start, end));
  const manualCosts = manualExpenses.reduce((sum, expense) => sum + expense.actualCost, 0);
  const manual = finish({
    jobs: manualJobs.length,
    miles: round(manualJobs.reduce((sum, job) => sum + (job.estimatedMiles ?? 0), 0)),
    income: round(manualJobs.reduce((sum, job) => sum + tariffForMiles(job.estimatedMiles) + (job.waitingEstimated ?? 0), 0)),
    costs: round(manualCosts)
  });

  const payslips = data.payslips.filter(payslip => isoInRange(payslip.weekStart, start, end));
  const pdfJobs = new Map<string, PayslipJob>();
  const pdfExpenses = new Map<string, PayslipExpense>();
  payslips.forEach(payslip => {
    (payslip.pdfJobs ?? []).forEach((job, index) => {
      if (!isoInRange(job.date || payslip.weekStart, start, end)) return;
      const ref = key(job.jobRef) || `${payslip.weekStart}-${index}`;
      pdfJobs.set(ref, job);
    });
    (payslip.pdfExpenses ?? []).forEach((expense, index) => {
      if (!isoInRange(expense.date || payslip.weekStart, start, end)) return;
      const expenseKey = [expense.date, key(expense.jobRef), expense.uploaded.toFixed(2), index].join("|");
      pdfExpenses.set(expenseKey, expense);
    });
  });
  const pdfIncome = payslips.reduce((sum, payslip) => sum + payslip.totalPaid, 0);
  const pdfCosts = [...pdfExpenses.values()].reduce((sum, expense) => sum + expense.uploaded, 0);
  const pdf = finish({
    jobs: pdfJobs.size,
    miles: round([...pdfJobs.values()].reduce((sum, job) => sum + job.miles, 0)),
    income: round(pdfIncome),
    costs: round(pdfCosts)
  });

  const pdfRefs = new Set(pdfJobs.keys());
  const unmatchedManualJobs = manualJobs.filter(job => !pdfRefs.has(key(job.jobRef)));
  const combinedJobs = new Set([...manualRefs, ...pdfRefs]);
  const combinedMiles = [...pdfJobs.values()].reduce((sum, job) => sum + job.miles, 0)
    + unmatchedManualJobs.reduce((sum, job) => sum + (job.estimatedMiles ?? 0), 0);
  const unmatchedManualIncome = unmatchedManualJobs.reduce((sum, job) => sum + tariffForMiles(job.estimatedMiles) + (job.waitingEstimated ?? 0), 0);
  const manualExpenseKeys = new Set(manualExpenses.map(expense => [expense.date, key(expense.jobRef), expense.actualCost.toFixed(2)].join("|")));
  const unmatchedPdfCosts = [...pdfExpenses.values()]
    .filter(expense => !manualExpenseKeys.has([expense.date, key(expense.jobRef), expense.uploaded.toFixed(2)].join("|")))
    .reduce((sum, expense) => sum + expense.uploaded, 0);
  const combined = finish({
    jobs: combinedJobs.size,
    miles: round(combinedMiles),
    income: round(pdfIncome + unmatchedManualIncome),
    costs: round(manualCosts + unmatchedPdfCosts)
  });

  return { manual, pdf, combined };
};
