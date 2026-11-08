import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import seed from "../data/seed-data.json";
import type { AppData, Expense, Job, Language, Payslip, TaxAdjustment, TaxSettings } from "../types";

const DATA_KEY = "car-work-tracker-data-v1";
const LANGUAGE_KEY = "car-work-tracker-language";

const normalizeData = (input: AppData): AppData => ({
  ...input,
  completedWeeks: input.completedWeeks ?? input.payslips.map(p => p.weekStart),
  confirmedTaxPeriods: input.confirmedTaxPeriods ?? [],
  taxAdjustments: input.taxAdjustments ?? [],
  taxSettings: input.taxSettings ?? {
    businessName: "",
    vatNumber: "",
    scheme: "flat-rate",
    flatRatePercent: null,
    salesVatRate: 20,
    accountingBasis: "cash",
    vatIncomeTreatment: "unknown",
    reimbursementVatTreatment: "unknown"
  },
  payslips: input.payslips.map(p => {
    const legacyAmount = !p.deliveriesPaid && p.deliveriesReported > 30 ? p.deliveriesReported : undefined;
    return {
      ...p,
      deliveriesPaid: p.deliveriesPaid ?? legacyAmount ?? 0,
      deliveriesReported: legacyAmount ? input.jobs.filter(j => j.status === "delivered" && j.weekStart === p.weekStart).length : p.deliveriesReported,
      rewardPercent: p.rewardPercent > 0 && p.rewardPercent <= 1 ? p.rewardPercent * 100 : p.rewardPercent
    };
  })
});

const loadData = (): AppData => {
  try { return normalizeData(JSON.parse(localStorage.getItem(DATA_KEY) || "null") || seed as AppData); }
  catch { return normalizeData(seed as AppData); }
};

type DataApi = {
  data: AppData; language: Language; setLanguage: (value: Language) => void;
  saveJob: (job: Job) => void; removeJob: (id: string) => void;
  saveExpenses: (items: Expense[]) => void; removeExpense: (id: string) => void;
  savePayslip: (item: Payslip) => void; removePayslip: (id: string) => void;
  setWeekComplete: (weekStart: string, complete: boolean) => void;
  saveTaxSettings: (settings: TaxSettings) => void;
  saveTaxAdjustment: (item: TaxAdjustment) => void;
  removeTaxAdjustment: (id: string) => void;
  setTaxPeriodConfirmed: (periodKey: string, confirmed: boolean) => void;
  replaceData: (next: AppData) => void; restoreSeed: () => void;
};

const DataContext = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem(LANGUAGE_KEY) as Language) || "ro");
  useEffect(() => localStorage.setItem(DATA_KEY, JSON.stringify(data)), [data]);
  const setLanguage = (value: Language) => { setLanguageState(value); localStorage.setItem(LANGUAGE_KEY, value); };
  const replaceData = (next: AppData) => setData(normalizeData({ ...next, generatedAt: new Date().toISOString() }));
  const saveJob = (job: Job) => setData(prev => ({ ...prev, jobs: [...prev.jobs.filter(x => x.id !== job.id), job] }));
  const removeJob = (id: string) => setData(prev => ({ ...prev, jobs: prev.jobs.filter(x => x.id !== id), expenses: prev.expenses.filter(x => x.jobRef !== prev.jobs.find(j => j.id === id)?.jobRef) }));
  const saveExpenses = (items: Expense[]) => setData(prev => ({ ...prev, expenses: [...prev.expenses.filter(e => !items.some(x => x.id === e.id)), ...items] }));
  const removeExpense = (id: string) => setData(prev => ({ ...prev, expenses: prev.expenses.filter(x => x.id !== id) }));
  const savePayslip = (item: Payslip) => setData(prev => {
    const now = new Date().toISOString();
    const jobs = [...prev.jobs];
    for (const row of item.pdfJobs ?? []) {
      const index = jobs.findIndex(job => job.jobRef === row.jobRef);
      if (index >= 0) {
        const existing = jobs[index];
        jobs[index] = {
          ...existing,
          status: "delivered",
          deliveryDate: existing.deliveryDate || row.date,
          collectionDate: existing.collectionDate || row.date,
          makeModel: existing.makeModel || row.description,
          registration: existing.registration || row.registration,
          payslipRegistration: row.registration,
          payslipMiles: row.miles,
          tariffPaid: row.paid,
          weekStart: item.weekStart,
          updatedAt: now
        };
      } else {
        jobs.push({
          id: `pdf-job-${item.weekStart}-${row.jobRef}`,
          jobRef: row.jobRef,
          status: "delivered",
          collectionDate: row.date,
          collectionTime: "",
          deliveryDate: row.date,
          deliveryTime: "",
          makeModel: row.description,
          carType: "",
          registration: row.registration,
          payslipRegistration: row.registration,
          customerType: "",
          pickupTown: "",
          pickupPostcode: "",
          deliveryTown: "",
          deliveryPostcode: "",
          odometerStart: null,
          odometerEnd: null,
          estimatedMiles: row.miles,
          actualMiles: null,
          payslipMiles: row.miles,
          waitingEstimated: null,
          waitingPaid: null,
          tariffPaid: row.paid,
          firstDeliveryBefore9: null,
          deliveryOrder: null,
          weekStart: item.weekStart,
          notes: "Imported from payslip PDF",
          source: "payslip",
          createdAt: now,
          updatedAt: now
        });
      }
    }
    const manualExpenses = prev.expenses.filter(expense => !(expense.source === "payslip" && expense.weekStart === item.weekStart));
    const pdfExpenses: Expense[] = (item.pdfExpenses ?? []).map((row, index) => ({
      id: `pdf-expense-${item.weekStart}-${row.jobRef}-${index}`,
      jobRef: row.jobRef,
      date: row.date,
      weekStart: item.weekStart,
      category: row.description || "Expense",
      description: row.description,
      actualCost: row.uploaded,
      claimed: row.uploaded,
      approved: row.payable,
      receipt: false,
      notes: "Imported from payslip PDF",
      source: "payslip"
    }));
    return {
      ...prev,
      jobs,
      expenses: [...manualExpenses, ...pdfExpenses],
      payslips: [...prev.payslips.filter(x => x.weekStart !== item.weekStart), item],
      completedWeeks: [...new Set([...(prev.completedWeeks ?? []), item.weekStart])]
    };
  });
  const removePayslip = (id: string) => setData(prev => ({ ...prev, payslips: prev.payslips.filter(x => x.id !== id) }));
  const setWeekComplete = (weekStart: string, complete: boolean) => setData(prev => ({ ...prev, completedWeeks: complete ? [...new Set([...(prev.completedWeeks ?? []), weekStart])] : (prev.completedWeeks ?? []).filter(week => week !== weekStart) }));
  const saveTaxSettings = (taxSettings: TaxSettings) => setData(prev => ({ ...prev, taxSettings }));
  const saveTaxAdjustment = (item: TaxAdjustment) => setData(prev => ({ ...prev, taxAdjustments: [...(prev.taxAdjustments ?? []).filter(entry => entry.id !== item.id), item] }));
  const removeTaxAdjustment = (id: string) => setData(prev => ({ ...prev, taxAdjustments: (prev.taxAdjustments ?? []).filter(item => item.id !== id) }));
  const setTaxPeriodConfirmed = (periodKey: string, confirmed: boolean) => setData(prev => ({ ...prev, confirmedTaxPeriods: confirmed ? [...new Set([...(prev.confirmedTaxPeriods ?? []), periodKey])] : (prev.confirmedTaxPeriods ?? []).filter(key => key !== periodKey) }));
  const restoreSeed = () => setData(normalizeData(seed as AppData));
  const value = useMemo(() => ({ data, language, setLanguage, saveJob, removeJob, saveExpenses, removeExpense, savePayslip, removePayslip, setWeekComplete, saveTaxSettings, saveTaxAdjustment, removeTaxAdjustment, setTaxPeriodConfirmed, replaceData, restoreSeed }), [data, language]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const value = useContext(DataContext);
  if (!value) throw new Error("DataProvider missing");
  return value;
};
