import type { AppData, DailyLog, DayWorkStatus, Job, PerformanceSettings } from "../types";
import { addDays, isoInRange, mondayOf } from "./date";
import { jobMiles } from "./analytics";
import { tariffForMiles } from "./rates";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const minutesAt = (value: string) => {
  if (!value || !value.includes(":")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

export const minutesAway = (log?: DailyLog) => {
  const start = minutesAt(log?.leftHomeTime ?? "");
  const end = minutesAt(log?.returnedHomeTime ?? "");
  if (start === null || end === null) return 0;
  return end >= start ? end - start : 1440 - start + end;
};

const jobDate = (job: Job) => job.deliveryDate || job.collectionDate;
const grossPayslipOutput = (payslip: AppData["payslips"][number]) => (payslip.deliveriesPaid ?? 0) + payslip.rewardPaid + payslip.bonusPaid + payslip.expensesPaid;

const vatOnGross = (gross: number, data: AppData, reimbursements = 0) => {
  const settings = data.taxSettings;
  const rate = settings?.salesVatRate ?? 20;
  const taxableGross = Math.max(0, gross - (settings?.reimbursementVatTreatment === "disbursement" ? reimbursements : 0));
  if (settings?.vatIncomeTreatment === "vat-exclusive") return taxableGross * rate / 100;
  return taxableGross * rate / (100 + rate);
};

const rangePayslips = (data: AppData, start: string, end: string) => data.payslips.filter(payslip => isoInRange(payslip.weekStart, start, end));
const rangeJobs = (data: AppData, start: string, end: string) => data.jobs.filter(job => job.status === "delivered" && isoInRange(jobDate(job), start, end));
const rangeExpenses = (data: AppData, start: string, end: string) => data.expenses.filter(expense => isoInRange(expense.date, start, end));

export const expectedWeekPayment = (data: AppData, weekStart: string) => {
  const jobs = data.jobs.filter(job => job.status === "delivered" && mondayOf(jobDate(job)) === weekStart);
  const expenses = data.expenses.filter(expense => expense.weekStart === weekStart);
  const payslip = data.payslips.find(item => item.weekStart === weekStart);
  const base = jobs.reduce((total, job) => total + tariffForMiles(jobMiles(job)) + (job.waitingEstimated ?? job.waitingPaid ?? 0), 0);
  const workedDays = new Set(jobs.map(jobDate)).size;
  const knownTiming = jobs.filter(job => job.firstDeliveryBefore9 !== null);
  const onTimeDays = new Set(knownTiming.filter(job => job.firstDeliveryBefore9).map(jobDate)).size;
  const ratio = workedDays ? onTimeDays / workedDays : 0;
  const rewardPercent = knownTiming.length ? ratio >= 1 ? 20 : ratio >= .75 ? 15 : ratio >= .5 ? 10 : 0 : payslip?.rewardPercent ?? 0;
  const reward = base * rewardPercent / 100;
  const claimed = expenses.reduce((total, expense) => total + expense.claimed, 0);
  const expected = base + reward + claimed + (payslip?.bonusPaid ?? 0) - (payslip?.deductions ?? 0) - (payslip?.adminFee ?? 0);
  const paid = payslip?.totalPaid ?? 0;
  return { base: round2(base), rewardPercent, reward: round2(reward), claimed: round2(claimed), expected: round2(expected), paid: round2(paid), difference: round2(paid - expected) };
};

export interface PerformanceDay {
  date: string;
  status: DayWorkStatus | "unconfirmed";
  reason: string;
  jobs: number;
  miles: number;
  gross: number;
  vatReserve: number;
  actualCosts: number;
  approvedExpenses: number;
  profitBeforeIncomeTax: number;
  incomeTaxReserve: number;
  realProfit: number;
  minutesAway: number;
  productiveMinutes: number;
  waitingMinutes: number;
  publicTransportMinutes: number;
  realHourly: number;
  score: number | null;
  dataQuality: number;
  longDay: boolean;
  restHours: number | null;
  morningEligible: boolean | null;
}

const statusForDay = (data: AppData, date: string, jobs: Job[]) => {
  const log = (data.dailyLogs ?? []).find(item => item.date === date);
  if (log) return { status: log.status as PerformanceDay["status"], reason: log.reason, log };
  if (jobs.length) return { status: "worked" as const, reason: "", log: undefined };
  if ((data.completedWeeks ?? []).includes(mondayOf(date))) return { status: "not-worked" as const, reason: "Nespecificat", log: undefined };
  return { status: "unconfirmed" as const, reason: "Date neconfirmate", log: undefined };
};

const previousRestHours = (data: AppData, date: string, current?: DailyLog) => {
  if (!current?.leftHomeTime) return null;
  const previous = (data.dailyLogs ?? []).filter(log => log.date < date && log.returnedHomeTime).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!previous) return null;
  const currentStart = minutesAt(current.leftHomeTime);
  const previousEnd = minutesAt(previous.returnedHomeTime);
  if (currentStart === null || previousEnd === null) return null;
  const dayGap = Math.round((new Date(`${date}T12:00:00`).getTime() - new Date(`${previous.date}T12:00:00`).getTime()) / 86400000);
  return round2((dayGap * 1440 - previousEnd + currentStart) / 60);
};

const dayDataQuality = (jobs: Job[], log?: DailyLog) => {
  if (!jobs.length && log) return 100;
  if (!jobs.length) return 0;
  let present = 0;
  let possible = 0;
  for (const job of jobs) {
    const values = [job.jobRef, jobDate(job), jobMiles(job) > 0, job.registration || job.payslipRegistration, job.pickupTown || job.pickupPostcode, job.deliveryTown || job.deliveryPostcode, job.collectionTime, job.deliveryTime];
    possible += values.length;
    present += values.filter(Boolean).length;
  }
  possible += 3;
  present += [log?.leftHomeTime, log?.returnedHomeTime, (log?.productiveMinutes ?? 0) > 0].filter(Boolean).length;
  return Math.round(present / possible * 100);
};

const dayScore = (day: Omit<PerformanceDay, "score">, settings: PerformanceSettings) => {
  if (day.status !== "worked" || !day.jobs) return null;
  const hourly = day.minutesAway ? clamp(day.realHourly / settings.hourlyTarget * 35, 0, 35) : 15;
  const jobs = clamp(day.jobs / 3 * 20, 0, 20);
  const recovery = day.actualCosts ? clamp(day.approvedExpenses / day.actualCosts * 15, 0, 15) : 15;
  const productive = day.minutesAway ? clamp(day.productiveMinutes / day.minutesAway * 15, 0, 15) : 7;
  const morning = day.morningEligible === null ? 7 : day.morningEligible ? 15 : 0;
  return Math.round(hourly + jobs + recovery + productive + morning);
};

export const performanceDays = (data: AppData, start: string, end: string): PerformanceDay[] => {
  const settings = data.performanceSettings ?? { hourlyTarget: 18, weeklyProfitTarget: 600, incomeTaxReservePercent: 20, longDayHours: 12, minimumRestHours: 8 };
  const result: PerformanceDay[] = [];
  let date = start;
  while (date <= end) {
    const jobs = rangeJobs(data, date, date);
    const expenses = rangeExpenses(data, date, date);
    const state = statusForDay(data, date, jobs);
    const payslip = data.payslips.find(item => item.weekStart === mondayOf(date));
    const workedDays = Math.max(1, new Set((payslip?.pdfJobs ?? []).map(job => job.date)).size || payslip?.adminDays || 1);
    const jobBase = jobs.reduce((total, job) => total + (job.tariffPaid ?? tariffForMiles(jobMiles(job))) + (job.waitingPaid ?? 0), 0);
    const weekJobBase = (payslip?.pdfJobs ?? []).reduce((total, job) => total + job.paid, 0) || payslip?.deliveriesPaid || 0;
    const share = weekJobBase > 0 ? jobBase / weekJobBase : (jobs.length ? 1 / workedDays : 0);
    const approvedExpenses = expenses.reduce((total, expense) => total + expense.approved, 0);
    const actualCosts = expenses.reduce((total, expense) => total + expense.actualCost, 0);
    const gross = jobBase + approvedExpenses + (payslip?.rewardPaid ?? 0) * share + (payslip?.bonusPaid ?? 0) / workedDays;
    const admin = ((payslip?.adminFee ?? 0) + (payslip?.deductions ?? 0)) / workedDays;
    const vatReserve = vatOnGross(gross, data, approvedExpenses);
    const profitBeforeIncomeTax = gross - vatReserve - actualCosts - admin;
    const incomeTaxReserve = Math.max(0, profitBeforeIncomeTax) * settings.incomeTaxReservePercent / 100;
    const away = minutesAway(state.log);
    const productiveMinutes = state.log?.productiveMinutes || 0;
    const firstJobs = jobs.filter(job => job.deliveryOrder === 1 || job.firstDeliveryBefore9 !== null);
    const morningEligible = firstJobs.length ? firstJobs.some(job => job.firstDeliveryBefore9 === true) : null;
    const partial = {
      date,
      status: state.status,
      reason: state.reason,
      jobs: jobs.length,
      miles: round2(jobs.reduce((total, job) => total + jobMiles(job), 0)),
      gross: round2(gross),
      vatReserve: round2(vatReserve),
      actualCosts: round2(actualCosts),
      approvedExpenses: round2(approvedExpenses),
      profitBeforeIncomeTax: round2(profitBeforeIncomeTax),
      incomeTaxReserve: round2(incomeTaxReserve),
      realProfit: round2(profitBeforeIncomeTax - incomeTaxReserve),
      minutesAway: away,
      productiveMinutes,
      waitingMinutes: state.log?.waitingMinutes || 0,
      publicTransportMinutes: state.log?.publicTransportMinutes || 0,
      realHourly: away ? round2((profitBeforeIncomeTax - incomeTaxReserve) / (away / 60)) : 0,
      dataQuality: dayDataQuality(jobs, state.log),
      longDay: away > settings.longDayHours * 60,
      restHours: previousRestHours(data, date, state.log),
      morningEligible
    };
    result.push({ ...partial, score: dayScore(partial, settings) });
    date = addDays(date, 1);
  }
  return result;
};

export const performanceSnapshot = (data: AppData, start: string, end: string) => {
  const jobs = rangeJobs(data, start, end);
  const expenses = rangeExpenses(data, start, end);
  const payslips = rangePayslips(data, start, end);
  const days = performanceDays(data, start, end);
  const gross = payslips.length ? payslips.reduce((total, payslip) => total + grossPayslipOutput(payslip), 0) : jobs.reduce((total, job) => total + (job.tariffPaid ?? tariffForMiles(jobMiles(job))) + (job.waitingPaid ?? 0), 0) + expenses.reduce((total, expense) => total + expense.approved, 0);
  const reimbursements = payslips.reduce((total, payslip) => total + payslip.expensesPaid, 0) || expenses.reduce((total, expense) => total + expense.approved, 0);
  const admin = payslips.reduce((total, payslip) => total + payslip.adminFee + payslip.deductions, 0);
  const actualCosts = expenses.reduce((total, expense) => total + expense.actualCost, 0);
  const approvedExpenses = expenses.reduce((total, expense) => total + expense.approved, 0);
  const claimedExpenses = expenses.reduce((total, expense) => total + expense.claimed, 0);
  const vatReserve = vatOnGross(gross, data, reimbursements);
  const profitBeforeIncomeTax = gross - vatReserve - actualCosts - admin;
  const incomeTaxReserve = Math.max(0, profitBeforeIncomeTax) * (data.performanceSettings?.incomeTaxReservePercent ?? 20) / 100;
  const realProfit = profitBeforeIncomeTax - incomeTaxReserve;
  const awayMinutes = days.reduce((total, day) => total + day.minutesAway, 0);
  const productiveMinutes = days.reduce((total, day) => total + day.productiveMinutes, 0);
  const weeksInRange = [...new Set(jobs.map(job => mondayOf(jobDate(job))))];
  const comparableWeeks = weeksInRange.filter(week =>
    (data.completedWeeks ?? []).includes(week) && data.payslips.some(payslip => payslip.weekStart === week)
  );
  const expected = comparableWeeks.map(week => expectedWeekPayment(data, week)).reduce((acc, row) => ({ expected: acc.expected + row.expected, paid: acc.paid + row.paid }), { expected: 0, paid: 0 });
  const scores = days.flatMap(day => day.score === null ? [] : [day.score]);
  const completeItems = jobs.reduce((total, job) => total + [job.jobRef, jobDate(job), jobMiles(job) > 0, job.registration || job.payslipRegistration, job.pickupTown || job.pickupPostcode, job.deliveryTown || job.deliveryPostcode].filter(Boolean).length, 0);
  const possibleItems = jobs.length * 6 + expenses.length + days.filter(day => day.jobs > 0).length;
  const receiptItems = expenses.filter(expense => expense.receipt).length;
  const logItems = days.filter(day => day.jobs > 0 && day.minutesAway > 0).length;
  const dataQuality = possibleItems ? Math.round((completeItems + receiptItems + logItems) / possibleItems * 100) : 0;
  return {
    jobs: jobs.length,
    miles: round2(jobs.reduce((total, job) => total + jobMiles(job), 0)),
    gross: round2(gross),
    actualCosts: round2(actualCosts),
    admin: round2(admin),
    vatReserve: round2(vatReserve),
    incomeTaxReserve: round2(incomeTaxReserve),
    realProfit: round2(realProfit),
    realHourly: awayMinutes ? round2(realProfit / (awayMinutes / 60)) : 0,
    grossPerCar: jobs.length ? round2(gross / jobs.length) : 0,
    profitPerCar: jobs.length ? round2(realProfit / jobs.length) : 0,
    earningsPerMile: jobs.reduce((total, job) => total + jobMiles(job), 0) ? round2(gross / jobs.reduce((total, job) => total + jobMiles(job), 0)) : 0,
    expenseRecovery: claimedExpenses ? round2(approvedExpenses / claimedExpenses * 100) : 100,
    approvedExpenses: round2(approvedExpenses),
    claimedExpenses: round2(claimedExpenses),
    expectedPay: round2(expected.expected),
    paid: round2(expected.paid),
    payDifference: round2(expected.paid - expected.expected),
    paymentComparisonReady: comparableWeeks.length > 0 && comparableWeeks.length === weeksInRange.length,
    comparableWeeks: comparableWeeks.length,
    incompleteWeeks: Math.max(0, weeksInRange.length - comparableWeeks.length),
    awayMinutes,
    productiveMinutes,
    productivePercent: awayMinutes ? round2(productiveMinutes / awayMinutes * 100) : 0,
    score: scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null,
    dataQuality: clamp(dataQuality),
    days
  };
};

export const weekdayPerformance = (data: AppData, start: string, end: string) => {
  const labels = ["Duminică", "Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă"];
  const groups = new Map<number, { jobs: number; profit: number; minutes: number; days: number }>();
  for (const day of performanceDays(data, start, end)) {
    if (!day.jobs) continue;
    const index = new Date(`${day.date}T12:00:00`).getDay();
    const row = groups.get(index) ?? { jobs: 0, profit: 0, minutes: 0, days: 0 };
    row.jobs += day.jobs; row.profit += day.realProfit; row.minutes += day.minutesAway; row.days += 1;
    groups.set(index, row);
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  return [...groups].map(([index, row]) => ({ index, name: labels[index], ...row, hourly: row.minutes ? round2(row.profit / (row.minutes / 60)) : 0 })).sort((a, b) => order.indexOf(a.index) - order.indexOf(b.index));
};

export const routePerformance = (data: AppData, start: string, end: string) => {
  const groups = new Map<string, { jobs: number; gross: number; costs: number; miles: number }>();
  for (const job of rangeJobs(data, start, end)) {
    const fallback = job.makeModel.split("/").map(value => value.replace(/\([^)]*\)/g, "").trim());
    const from = job.pickupPostcode || job.pickupTown || fallback[0] || "Necunoscut";
    const to = job.deliveryPostcode || job.deliveryTown || fallback[1] || "Necunoscut";
    const key = `${from} → ${to}`;
    const row = groups.get(key) ?? { jobs: 0, gross: 0, costs: 0, miles: 0 };
    row.jobs += 1;
    row.gross += (job.tariffPaid ?? tariffForMiles(jobMiles(job))) + (job.waitingPaid ?? 0);
    row.costs += data.expenses.filter(expense => expense.jobRef === job.jobRef).reduce((total, expense) => total + expense.actualCost, 0);
    row.miles += jobMiles(job);
    groups.set(key, row);
  }
  return [...groups].map(([route, row]) => {
    const vat = vatOnGross(row.gross, data);
    const profit = row.gross - vat - row.costs;
    const score = Math.round(clamp((profit / Math.max(1, row.jobs) / 50) * 60 + (row.gross / Math.max(1, row.miles) / 1.5) * 40));
    return { route, ...row, profit: round2(profit), perCar: round2(profit / row.jobs), perMile: row.miles ? round2(row.gross / row.miles) : 0, score };
  }).sort((a, b) => b.profit - a.profit);
};

export const performanceRecords = (data: AppData) => {
  const dates = data.jobs.map(jobDate).filter(Boolean).sort();
  const allDays = dates.length ? performanceDays(data, dates[0], dates[dates.length - 1]).filter(day => day.jobs > 0) : [];
  const bestProfit = [...allDays].sort((a, b) => b.realProfit - a.realProfit)[0];
  const mostCars = [...allDays].sort((a, b) => b.jobs - a.jobs)[0];
  const bestHourly = [...allDays].filter(day => day.realHourly > 0).sort((a, b) => b.realHourly - a.realHourly)[0];
  return { bestProfit, mostCars, bestHourly };
};
