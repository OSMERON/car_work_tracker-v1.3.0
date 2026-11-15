import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import seed from "../data/seed-data.json";
import type { AppData, DailyLog, Expense, Job, Language, Payslip, PerformanceSettings, TaxAdjustment, TaxSettings } from "../types";
import { clearLocalFiles, deleteJobImages } from "../lib/jobImageStore";
import { jobRegistrations, normalizeRegistration } from "../lib/jobProtocols";
import { tariffForMiles } from "../lib/rates";
import { isCompanyFuelExpense, isCompanyFuelPdfRow } from "../lib/expenseRules";

const DATA_KEY = "car-work-tracker-data-v1";
const LANGUAGE_KEY = "car-work-tracker-language";

const normalizeTaxSettings = (settings?: TaxSettings): TaxSettings => {
  const legacyScheme = (settings as unknown as { scheme?: string } | undefined)?.scheme;
  return {
    businessName: settings?.businessName ?? "",
    vatNumber: settings?.vatNumber ?? "",
    scheme: "standard",
    flatRatePercent: null,
    salesVatRate: settings?.salesVatRate ?? 20,
    accountingBasis: legacyScheme === "flat-rate" ? "invoice" : settings?.accountingBasis ?? "invoice",
    vatIncomeTreatment: legacyScheme === "flat-rate" || !settings ? "vat-inclusive" : settings.vatIncomeTreatment,
    reimbursementVatTreatment: legacyScheme === "flat-rate" || !settings ? "taxable-recharge" : settings.reimbursementVatTreatment
  };
};

const routeFromDescription = (description: string) => {
  const parts = description.split("/").map(value => value.replace(/\([^)]*\)/g, "").replace(/\b(?:SS|COLL|NOTICE|BUYER|AUTOROLA|JIG|CD)\s*-?/gi, "").trim()).filter(Boolean);
  return { pickupTown: parts[0] ?? "", deliveryTown: parts[1] ?? "" };
};

const normalizeJobs = (jobs: Job[]) => {
  const seen = new Set<string>();
  return jobs.map((job, index) => {
    let id = job.id || `job-${job.jobRef || index}`;
    if (seen.has(id)) id = `${id}-${job.jobRef || index}`;
    seen.add(id);
    const registrations = jobRegistrations(job);
    if (job.pickupTown || job.deliveryTown || !job.makeModel.includes("/")) return { ...job, id, registrations };
    const parts = job.makeModel.split("/").map(value => value.replace(/\([^)]*\)/g, "").trim()).filter(Boolean);
    return { ...job, id, registrations, pickupTown: parts[0] ?? "", deliveryTown: parts[1] ?? "" };
  });
};

const normalizeData = (input: AppData): AppData => ({
  ...input,
  completedWeeks: input.completedWeeks ?? input.payslips.map(p => p.weekStart),
  confirmedTaxPeriods: input.confirmedTaxPeriods ?? [],
  taxAdjustments: input.taxAdjustments ?? [],
  dailyLogs: input.dailyLogs ?? [],
  performanceSettings: input.performanceSettings ?? {
    hourlyTarget: 18,
    weeklyProfitTarget: 600,
    incomeTaxReservePercent: 20,
    longDayHours: 12,
    minimumRestHours: 8
  },
  taxSettings: normalizeTaxSettings(input.taxSettings),
  jobs: normalizeJobs(input.jobs),
  expenses: input.expenses.filter(expense => !isCompanyFuelExpense(expense)).map(expense => ({
    ...expense,
    vatAmount: expense.vatAmount ?? 0,
    vatReclaimable: expense.vatReclaimable ?? false,
    includeInTax: expense.includeInTax ?? (expense.source === "manual" || expense.approved > 0)
  })),
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
  saveDailyLog: (item: DailyLog) => void;
  savePerformanceSettings: (settings: PerformanceSettings) => void;
  saveTaxAdjustment: (item: TaxAdjustment) => void;
  removeTaxAdjustment: (id: string) => void;
  setTaxPeriodConfirmed: (periodKey: string, confirmed: boolean) => void;
  replaceData: (next: AppData) => void; restoreSeed: () => void; clearAllData: () => Promise<void>;
};

const DataContext = createContext<DataApi | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem(LANGUAGE_KEY) as Language) || "ro");
  useEffect(() => localStorage.setItem(DATA_KEY, JSON.stringify(data)), [data]);
  const setLanguage = (value: Language) => { setLanguageState(value); localStorage.setItem(LANGUAGE_KEY, value); };
  const replaceData = (next: AppData) => setData(normalizeData({ ...next, generatedAt: new Date().toISOString() }));
  const saveJob = (job: Job) => setData(prev => ({ ...prev, jobs: [...prev.jobs.filter(x => x.id !== job.id), job] }));
  const removeJob = (id: string) => {
    void deleteJobImages(id);
    setData(prev => ({ ...prev, jobs: prev.jobs.filter(x => x.id !== id), expenses: prev.expenses.filter(x => x.jobRef !== prev.jobs.find(j => j.id === id)?.jobRef) }));
  };
  const saveExpenses = (items: Expense[]) => setData(prev => ({ ...prev, expenses: [...prev.expenses.filter(e => !items.some(x => x.id === e.id)), ...items] }));
  const removeExpense = (id: string) => setData(prev => ({ ...prev, expenses: prev.expenses.filter(x => x.id !== id) }));
  const savePayslip = (item: Payslip) => setData(prev => {
    const now = new Date().toISOString();
    const jobs = [...prev.jobs];
    for (const row of item.pdfJobs ?? []) {
      const route = routeFromDescription(row.description);
      const rowRegistration = normalizeRegistration(row.registration);
      const index = jobs.findIndex(job => job.jobRef === row.jobRef || (rowRegistration && jobRegistrations(job, true).includes(rowRegistration)));
      if (index >= 0) {
        const existing = jobs[index];
        const registrations = [...new Set([...jobRegistrations(existing), rowRegistration].filter(Boolean))];
        const detectedProtocolExtra = existing.protocol ? Math.max(0, Math.round((row.paid - tariffForMiles(row.miles)) * 100) / 100) : null;
        jobs[index] = {
          ...existing,
          status: "delivered",
          deliveryDate: existing.deliveryDate || row.date,
          collectionDate: existing.collectionDate || row.date,
          makeModel: existing.makeModel || row.description,
          registration: existing.registration || row.registration,
          registrations,
          pickupTown: existing.pickupTown || route.pickupTown,
          deliveryTown: existing.deliveryTown || route.deliveryTown,
          payslipRegistration: row.registration,
          payslipMiles: row.miles,
          tariffPaid: row.paid,
          protocolExtraDetected: detectedProtocolExtra,
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
          registrations: row.registration ? [normalizeRegistration(row.registration)] : [],
          payslipRegistration: row.registration,
          customerType: "",
          pickupTown: route.pickupTown,
          pickupPostcode: "",
          deliveryTown: route.deliveryTown,
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
    const mergedExpenses = prev.expenses.filter(expense => !(expense.source === "payslip" && expense.weekStart === item.weekStart));
    const matchedManual = new Set<number>();
    const pdfExpenses: Expense[] = (item.pdfExpenses ?? []).filter(row => !isCompanyFuelPdfRow(row)).map((row, index) => ({
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
      vatAmount: 0,
      vatReclaimable: false,
      includeInTax: row.payable > 0,
      notes: ["Imported from payslip PDF", row.actionNote].filter(Boolean).join(" · "),
      source: "payslip" as const
    })).filter((pdfExpense, pdfIndex) => {
      const manualIndex = mergedExpenses.findIndex((expense, index) => !matchedManual.has(index) && expense.source === "manual" && expense.date === pdfExpense.date && expense.jobRef === pdfExpense.jobRef && Math.abs(expense.actualCost - pdfExpense.actualCost) < 0.01);
      if (manualIndex < 0) return true;
      const existing = mergedExpenses[manualIndex];
      matchedManual.add(manualIndex);
      mergedExpenses[manualIndex] = {
        ...existing,
        claimed: existing.claimed || pdfExpense.claimed,
        approved: pdfExpense.approved,
        notes: [existing.notes, pdfExpense.notes].filter(Boolean).join(" · ")
      };
      return false;
    });
    return {
      ...prev,
      jobs,
      expenses: [...mergedExpenses, ...pdfExpenses],
      payslips: [...prev.payslips.filter(x => x.weekStart !== item.weekStart), item],
      completedWeeks: [...new Set([...(prev.completedWeeks ?? []), item.weekStart])]
    };
  });
  const removePayslip = (id: string) => setData(prev => ({ ...prev, payslips: prev.payslips.filter(x => x.id !== id) }));
  const setWeekComplete = (weekStart: string, complete: boolean) => setData(prev => ({ ...prev, completedWeeks: complete ? [...new Set([...(prev.completedWeeks ?? []), weekStart])] : (prev.completedWeeks ?? []).filter(week => week !== weekStart) }));
  const saveTaxSettings = (taxSettings: TaxSettings) => setData(prev => ({ ...prev, taxSettings }));
  const saveDailyLog = (item: DailyLog) => setData(prev => ({ ...prev, dailyLogs: [...(prev.dailyLogs ?? []).filter(entry => entry.date !== item.date), item] }));
  const savePerformanceSettings = (performanceSettings: PerformanceSettings) => setData(prev => ({ ...prev, performanceSettings }));
  const saveTaxAdjustment = (item: TaxAdjustment) => setData(prev => ({ ...prev, taxAdjustments: [...(prev.taxAdjustments ?? []).filter(entry => entry.id !== item.id), item] }));
  const removeTaxAdjustment = (id: string) => setData(prev => ({ ...prev, taxAdjustments: (prev.taxAdjustments ?? []).filter(item => item.id !== id) }));
  const setTaxPeriodConfirmed = (periodKey: string, confirmed: boolean) => setData(prev => ({ ...prev, confirmedTaxPeriods: confirmed ? [...new Set([...(prev.confirmedTaxPeriods ?? []), periodKey])] : (prev.confirmedTaxPeriods ?? []).filter(key => key !== periodKey) }));
  const restoreSeed = () => setData(normalizeData(seed as AppData));
  const clearAllData = async () => {
    await clearLocalFiles().catch(() => undefined);
    setData(normalizeData({ version: 2, generatedAt: new Date().toISOString(), jobs: [], expenses: [], payslips: [], completedWeeks: [], confirmedTaxPeriods: [], taxAdjustments: [], dailyLogs: [] }));
  };
  const value = useMemo(() => ({ data, language, setLanguage, saveJob, removeJob, saveExpenses, removeExpense, savePayslip, removePayslip, setWeekComplete, saveTaxSettings, saveDailyLog, savePerformanceSettings, saveTaxAdjustment, removeTaxAdjustment, setTaxPeriodConfirmed, replaceData, restoreSeed, clearAllData }), [data, language]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const value = useContext(DataContext);
  if (!value) throw new Error("DataProvider missing");
  return value;
};
