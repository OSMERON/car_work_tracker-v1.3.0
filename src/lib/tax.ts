import type { AppData, TaxAdjustment, TaxSettings } from "../types";
import { isoInRange } from "./date";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (items: TaxAdjustment[], type: TaxAdjustment["type"], field: "amount" | "vatAmount" = "amount") => items.filter(item => item.type === type).reduce((total, item) => total + item[field], 0);

export interface VatDraft {
  servicesFromPdfs: number;
  reimbursementsFromPdfs: number;
  turnoverBeforeVatTreatment: number;
  taxableGross: number;
  salesExVat: number;
  purchasesExVat: number;
  outputVat: number;
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
  const rate = settings.salesVatRate / 100;
  const outputVat = settings.vatIncomeTreatment === "vat-exclusive"
    ? round2(turnoverBeforeVatTreatment * rate)
    : round2(turnoverBeforeVatTreatment * rate / (1 + rate));
  const salesExVat = settings.vatIncomeTreatment === "vat-exclusive"
    ? round2(turnoverBeforeVatTreatment)
    : round2(turnoverBeforeVatTreatment - outputVat);
  const taxableGross = settings.vatIncomeTreatment === "vat-exclusive"
    ? round2(turnoverBeforeVatTreatment + outputVat)
    : round2(turnoverBeforeVatTreatment);
  const box8 = round2(sum(adjustments, "box8"));
  const box9 = round2(sum(adjustments, "box9"));
  const box1 = round2(outputVat + sum(adjustments, "other-output-vat"));
  const box2 = round2(sum(adjustments, "box2"));
  const box3 = round2(box1 + box2);
  const expenseInputVat = data.expenses.filter(expense => isoInRange(expense.date, start, end) && expense.includeInTax !== false && expense.vatReclaimable).reduce((total, expense) => total + (expense.vatAmount ?? 0), 0);
  const box4 = round2(expenseInputVat + sum(adjustments, "input-vat", "vatAmount") + sum(adjustments, "capital-purchase", "vatAmount"));
  const box5 = round2(Math.abs(box3 - box4));
  const businessPurchases = data.expenses.filter(expense => isoInRange(expense.date, start, end) && expense.includeInTax !== false).reduce((total, expense) => total + Math.max(0, expense.actualCost - (expense.vatAmount ?? 0)), 0);
  const payslipCharges = payslips.reduce((total, payslip) => total + payslip.adminFee + payslip.deductions, 0);
  const purchasesExVat = round2(businessPurchases + payslipCharges + sum(adjustments, "capital-purchase"));
  const box6 = round2(salesExVat + box8);
  const box7 = round2(purchasesExVat + box9);
  const blockers: string[] = [];
  if (settings.vatIncomeTreatment === "unknown") blockers.push("vatIncomeTreatment");
  if (settings.reimbursementVatTreatment === "unknown") blockers.push("reimbursementVatTreatment");
  if (!payslips.length) blockers.push("noPayslips");
  return {
    servicesFromPdfs: round2(servicesFromPdfs),
    reimbursementsFromPdfs: round2(reimbursementsFromPdfs),
    turnoverBeforeVatTreatment: round2(turnoverBeforeVatTreatment),
    taxableGross,
    salesExVat,
    purchasesExVat,
    outputVat,
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
  const outputVat = vat.outputVat;
  const turnoverForAccounts = vat.salesExVat;
  const expenses = round2(appExpenses + payslipCharges + extraAllowableExpenses);
  return {
    grossReceipts: vat.taxableGross,
    outputVat,
    turnoverForAccounts,
    expenses,
    estimatedProfit: round2(turnoverForAccounts - expenses)
  };
};
