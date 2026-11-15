import type { Expense, PayslipExpense } from "../types";

const fuelPattern = /^\s*(?:fuel|combustibil|petrol|diesel)\b/i;

export const isCompanyFuelDescription = (value: string) => fuelPattern.test(value || "");

export const isCompanyFuelPdfRow = (row: PayslipExpense) => isCompanyFuelDescription(row.description);

export const isCompanyFuelExpense = (expense: Expense) => expense.source === "payslip" && isCompanyFuelDescription(expense.category || expense.description);
