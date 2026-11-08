export type JobStatus = "collected" | "delivered" | "cancelled";
export type Language = "ro" | "en";

export interface Job {
  id: string;
  jobRef: string;
  status: JobStatus;
  collectionDate: string;
  collectionTime: string;
  deliveryDate: string;
  deliveryTime: string;
  makeModel: string;
  carType: string;
  registration: string;
  payslipRegistration: string;
  customerType: string;
  pickupTown: string;
  pickupPostcode: string;
  deliveryTown: string;
  deliveryPostcode: string;
  odometerStart: number | null;
  odometerEnd: number | null;
  estimatedMiles: number | null;
  actualMiles: number | null;
  payslipMiles: number | null;
  waitingEstimated: number | null;
  waitingPaid: number | null;
  tariffPaid: number | null;
  firstDeliveryBefore9: boolean | null;
  deliveryOrder: number | null;
  weekStart: string;
  notes: string;
  source: "manual" | "payslip";
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  jobRef: string;
  date: string;
  weekStart: string;
  category: string;
  description: string;
  actualCost: number;
  claimed: number;
  approved: number;
  receipt: boolean;
  notes: string;
  source: "manual" | "payslip";
}

export interface Payslip {
  id: string;
  weekStart: string;
  deliveriesReported: number;
  onTimeReported: number | null;
  rewardPercent: number;
  rewardPaid: number;
  expensesPaid: number;
  bonusPaid: number;
  deductions: number;
  adminDays: number;
  adminFee: number;
  totalPaid: number;
  sourceFiles: string[];
  deliveriesPaid?: number;
  importedAt?: string;
  pdfJobs?: PayslipJob[];
  pdfExpenses?: PayslipExpense[];
}

export interface PayslipJob {
  date: string;
  jobRef: string;
  miles: number;
  description: string;
  registration: string;
  paid: number;
}

export interface PayslipExpense {
  date: string;
  jobRef: string;
  description: string;
  uploaded: number;
  payable: number;
}

export interface AppData {
  version: number;
  generatedAt: string;
  jobs: Job[];
  expenses: Expense[];
  payslips: Payslip[];
  completedWeeks?: string[];
  taxSettings?: TaxSettings;
  taxAdjustments?: TaxAdjustment[];
  confirmedTaxPeriods?: string[];
}

export type VatIncomeTreatment = "unknown" | "vat-inclusive" | "vat-exclusive";
export type ReimbursementVatTreatment = "unknown" | "taxable-recharge" | "disbursement";
export type TaxAdjustmentType = "other-sales-gross" | "other-output-vat" | "box2" | "input-vat" | "capital-purchase" | "box8" | "box9" | "allowable-expense";

export interface TaxSettings {
  businessName: string;
  vatNumber: string;
  scheme: "flat-rate";
  flatRatePercent: number | null;
  salesVatRate: number;
  accountingBasis: "cash" | "invoice";
  vatIncomeTreatment: VatIncomeTreatment;
  reimbursementVatTreatment: ReimbursementVatTreatment;
}

export interface TaxAdjustment {
  id: string;
  date: string;
  type: TaxAdjustmentType;
  amount: number;
  vatAmount: number;
  notes: string;
}

export interface NewExpenseInput {
  category: string;
  amount: number;
  claimed: number;
  receipt: boolean;
  notes: string;
}
