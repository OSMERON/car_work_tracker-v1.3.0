export type JobStatus = "collected" | "delivered" | "cancelled";
export type Language = "ro" | "en";
export type JobProtocol = "model" | "hilton" | "autorola" | "other";
export type VehicleType = "electric" | "petrol" | "diesel" | "hybrid" | "unspecified";
export type PaymentSource = "self" | "company";
export type ThemeMode = "light" | "dark";
export type ReimbursementStatus = "full" | "partial" | "unpaid" | "review";

export interface FuelEntry {
  litres: number | null;
  totalCost: number | null;
  pricePerLitre: number | null;
  payer: PaymentSource;
}

export interface ChargingEntry {
  totalCost: number | null;
  durationMinutes: number | null;
  averageKw: number | null;
  tariffPencePerKwh: number | null;
  payer: PaymentSource;
}

export interface UserProfile {
  name: string;
  initialized: boolean;
}

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
  vehicleType?: VehicleType;
  registration: string;
  payslipRegistration: string;
  customerType: string;
  pickupTown: string;
  pickupPostcode: string;
  deliveryTown: string;
  deliveryPostcode: string;
  odometerStart: number | null;
  odometerEnd: number | null;
  rangeStart?: number | null;
  rangeEnd?: number | null;
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
  rawJobRef?: string;
  pickupCompany?: string;
  pickupAddress?: string;
  deliveryCompany?: string;
  deliveryAddress?: string;
  vin?: string;
  vinIncomplete?: boolean;
  modelPin?: string;
  vehicleId?: string;
  otherInfo?: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  sourceImageCount?: number;
  plannedDeliveryDate?: string;
  registrations?: string[];
  vehicleYear?: string;
  protocol?: JobProtocol;
  protocolExtraDetected?: number | null;
  protocolExtraPaid?: number | null;
  fuelEntry?: FuelEntry;
  chargingEntry?: ChargingEntry;
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
  vatAmount?: number;
  vatReclaimable?: boolean;
  includeInTax?: boolean;
  notes: string;
  source: "manual" | "payslip";
  rasCode?: string;
  hasTicket?: boolean;
  reimbursementStatus?: ReimbursementStatus;
  reimbursementOverride?: ReimbursementStatus | null;
  reimbursementNote?: string;
  correctedByUser?: boolean;
  resubmittedToOffice?: boolean;
  matchedPayslipId?: string;
}

export interface Payslip {
  id: string;
  fileHash?: string;
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
  expenseReviewConfirmed?: boolean;
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
  actionNote?: string;
  needsCheck?: boolean;
}

export interface AppData {
  version: number;
  generatedAt: string;
  profile?: UserProfile;
  themeMode?: ThemeMode;
  jobs: Job[];
  expenses: Expense[];
  payslips: Payslip[];
  completedWeeks?: string[];
  taxSettings?: TaxSettings;
  taxAdjustments?: TaxAdjustment[];
  confirmedTaxPeriods?: string[];
  dailyLogs?: DailyLog[];
  performanceSettings?: PerformanceSettings;
}

export type VatIncomeTreatment = "unknown" | "vat-inclusive" | "vat-exclusive";
export type ReimbursementVatTreatment = "unknown" | "taxable-recharge" | "disbursement";
export type TaxAdjustmentType = "other-sales-gross" | "other-output-vat" | "box2" | "input-vat" | "capital-purchase" | "box8" | "box9" | "allowable-expense";

export interface TaxSettings {
  businessName: string;
  vatNumber: string;
  scheme: "standard";
  flatRatePercent?: number | null;
  salesVatRate: number;
  accountingBasis: "cash" | "invoice";
  vatIncomeTreatment: VatIncomeTreatment;
  reimbursementVatTreatment: ReimbursementVatTreatment;
}

export type DayWorkStatus = "worked" | "not-worked" | "unavailable" | "day-off" | "holiday" | "sick" | "no-jobs";

export interface DailyLog {
  id: string;
  date: string;
  status: DayWorkStatus;
  leftHomeTime: string;
  returnedHomeTime: string;
  productiveMinutes: number;
  waitingMinutes: number;
  publicTransportMinutes: number;
  reason: string;
  notes: string;
  updatedAt: string;
}

export interface PerformanceSettings {
  hourlyTarget: number;
  weeklyProfitTarget: number;
  incomeTaxReservePercent: number;
  longDayHours: number;
  minimumRestHours: number;
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
