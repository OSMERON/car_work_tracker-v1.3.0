import type { AppData, TaxAdjustment, TaxSettings } from "../types";
import { isoInRange } from "./date";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (items: TaxAdjustment[], type: TaxAdjustment["type"], field: "amount" | "vatAmount" = "amount") => items.filter(item => item.type === type).reduce((total, item) => total + item[field], 0);

export interface VatDraft {
  servicesFromPdfs: number;
  reimbursementsFromPdfs: number;
  turnoverBeforeVatTreatment: number;
  flatRateTurnover: number;
  boxes: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>;
  paymentDirection: "pay" | "reclaim";
  blockers: string[];
  payslipCount: number;
}

export const calculateVatDraft = (data: AppData, start: string, end: string, settings: TaxSettings): VatDraft => {
  const payslips = data.payslips.filter(payslip => isoInRange(payslip.weekStart, start, end));
  const adjustments = (data.taxAdjustments ?? []).filter(item => isoInRange(item.date, start, end));
  const servicesFromPdfs = payslips.reduce((total, payslip) => total + (payslip.deliveriesPaid ?? 0) + payslip.rewardPaid + payslip.bonusPaid, 0);
  const reimbursementsFromPdfs = payslips.reduce((total, payslip) => total + payslip.expensesPaid, 0);
  const reimbursementsIncluded = settings.reimbursementVatTreatment === "taxable-recharge" ? reimbursementsFromPdfs : 0;
  const turnoverBeforeVatTreatment = servicesFromPdfs + reimbursementsIncluded + sum(adjustments, "other-sales-gross");
  const vatMultiplier = settings.vatIncomeTreatment === "vat-exclusive" ? 1 + settings.salesVatRate / 100 : 1;
  const flatRateTurnover = round2(turnoverBeforeVatTreatment * vatMultiplier);
  const box8 = round2(sum(adjustments, "box8"));
  const box9 = round2(sum(adjustments, "box9"));
  const box1 = round2(flatRateTurnover * (settings.flatRatePercent ?? 0) / 100 + sum(adjustments, "other-output-vat"));
  const box2 = round2(sum(adjustments, "box2"));
  const box3 = round2(box1 + box2);
  const box4 = round2(sum(adjustments, "input-vat", "vatAmount") + sum(adjustments, "capital-purchase", "vatAmount"));
  const box5 = round2(Math.abs(box3 - box4));
  const box6 = round2(flatRateTurnover + box8);
  const box7 = round2(sum(adjustments, "capital-purchase") + box9);
  const blockers: string[] = [];
  if (settings.flatRatePercent === null || settings.flatRatePercent <= 0) blockers.push("flatRatePercent");
  if (settings.vatIncomeTreatment === "unknown") blockers.push("vatIncomeTreatment");
  if (settings.reimbursementVatTreatment === "unknown") blockers.push("reimbursementVatTreatment");
  if (!payslips.length) blockers.push("noPayslips");
  return {
    servicesFromPdfs: round2(servicesFromPdfs),
    reimbursementsFromPdfs: round2(reimbursementsFromPdfs),
    turnoverBeforeVatTreatment: round2(turnoverBeforeVatTreatment),
    flatRateTurnover,
    boxes: { 1: box1, 2: box2, 3: box3, 4: box4, 5: box5, 6: box6, 7: box7, 8: box8, 9: box9 },
    paymentDirection: box3 >= box4 ? "pay" : "reclaim",
    blockers,
    payslipCount: payslips.length
  };
};

export const calculateIncomeTaxSummary = (data: AppData, start: string, end: string, settings: TaxSettings) => {
  const vat = calculateVatDraft(data, start, end, settings);
  const payslips = data.payslips.filter(payslip => isoInRange(payslip.weekStart, start, end));
  const appExpenses = data.expenses.filter(expense => isoInRange(expense.date, start, end)).reduce((total, expense) => total + expense.actualCost, 0);
  const payslipCharges = payslips.reduce((total, payslip) => total + payslip.adminFee + payslip.deductions, 0);
  const adjustments = (data.taxAdjustments ?? []).filter(item => isoInRange(item.date, start, end));
  const extraAllowableExpenses = sum(adjustments, "allowable-expense");
  const flatRateVat = round2(vat.flatRateTurnover * (settings.flatRatePercent ?? 0) / 100);
  const turnoverForAccounts = round2(vat.flatRateTurnover - flatRateVat);
  const expenses = round2(appExpenses + payslipCharges + extraAllowableExpenses);
  return {
    grossReceipts: vat.flatRateTurnover,
    flatRateVat,
    turnoverForAccounts,
    expenses,
    estimatedProfit: round2(turnoverForAccounts - expenses)
  };
};
