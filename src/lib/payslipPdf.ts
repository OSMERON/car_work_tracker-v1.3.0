import type { Payslip, PayslipExpense, PayslipJob } from "../types";
import { mondayOf } from "./date";

const PAGE_MARKER = "<<<PAYSLIP_PAGE>>>";
const DATE_SOURCE = "\\d{2}\\/\\d{2}\\/\\d{4}";
const MONEY_SOURCE = "[\\d,]+\\.\\d{2}|-";

const money = (value?: string) => value && value !== "-" ? Number(value.replace(/,/g, "")) || 0 : 0;
const isoDate = (value: string) => {
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
};
const compact = (value: string) => value.replace(/\s+/g, " ").trim();

export const hashPdfFile = async (file: File) => {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
};

export const extractPdfText = async (file: File) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(compact(content.items.map(item => "str" in item ? item.str : "").join(" ")));
  }
  return pages.join(` ${PAGE_MARKER} `);
};

const valueFromFragment = (fragment: string) => {
  const match = fragment.match(new RegExp(`(?:£\\s*(${MONEY_SOURCE})|(${MONEY_SOURCE})\\s*£)`, "i"));
  return money(match?.[1] ?? match?.[2]);
};

const amountBetween = (text: string, start: RegExp, end: RegExp) => {
  const startMatch = start.exec(text);
  if (!startMatch) return 0;
  const rest = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(rest);
  return valueFromFragment(endMatch ? rest.slice(0, endMatch.index) : rest.slice(0, 120));
};

const weekDateFrom = (text: string) => {
  const afterLabel = text.match(new RegExp(`Week Commencing:?\\s*(${DATE_SOURCE})`, "i"));
  if (afterLabel) return afterLabel[1];
  const reportHeading = text.match(new RegExp(`(?:Contractor Service Report|JOB REPORT)\\s+(${DATE_SOURCE})\\s+(?:Service|Job) Report\\s*\\|\\s*Total`, "i"));
  if (reportHeading) return reportHeading[1];
  const beforeSection = text.match(new RegExp(`(${DATE_SOURCE})\\s+(?:Service|Job) Report\\s*\\|\\s*Total`, "i"));
  return beforeSection?.[1];
};

const parseJobs = (text: string): PayslipJob[] => {
  const pages = text.split(PAGE_MARKER);
  const page = pages.find(value => /Job Ref\s+Mileage\s+Description\s+Registration\s+Total Earned/i.test(value)) ?? text;
  const start = page.search(/Date\s+Job Ref\s+Mileage/i);
  const body = start >= 0 ? page.slice(start) : page;
  const jobs: PayslipJob[] = [];
  const rowPattern = new RegExp(`(${DATE_SOURCE})\\s+(\\d{5,})\\s+([\\d.]+)\\s+(.{3,150}?)\\s+(?:£\\s*([\\d,]+\\.\\d{2})|([\\d,]+\\.\\d{2})\\s*£)`, "gi");
  const registrationPattern = /((?:[A-Z]{2}\d{2}[A-Z]{3})(?:\s*\/\s*[A-Z]{2}\d{2}[A-Z]{3})?|\d{4}\s*[A-Z]{3}|[A-Z0-9]{5,8})$/i;
  for (const match of body.matchAll(rowPattern)) {
    const details = compact(match[4]);
    const registrationMatch = details.match(registrationPattern);
    if (!registrationMatch) continue;
    jobs.push({
      date: isoDate(match[1]),
      jobRef: match[2],
      miles: Number(match[3]),
      description: details.slice(0, registrationMatch.index).trim(),
      registration: compact(registrationMatch[1]).toUpperCase(),
      paid: money(match[5] ?? match[6])
    });
  }
  return jobs;
};

const parseExpenses = (text: string): PayslipExpense[] => {
  const pages = text.split(PAGE_MARKER);
  const page = pages.find(value => /Uploaded Expenses\s+Payable Expenses/i.test(value)) ?? "";
  const expenses: PayslipExpense[] = [];
  const rowPattern = new RegExp(`(${DATE_SOURCE})\\s+(\\d{5,})\\s+([A-Za-z][A-Za-z ]{0,30}?)\\s+£\\s*([\\d,]+\\.\\d{2})\\s+(?:(?:£\\s*)?([\\d,]+\\.\\d{2})\\s*£|-\\s*£)`, "gi");
  for (const match of page.matchAll(rowPattern)) {
    expenses.push({
      date: isoDate(match[1]),
      jobRef: match[2],
      description: compact(match[3]),
      uploaded: money(match[4]),
      payable: money(match[5])
    });
  }
  return expenses;
};

export const parsePayslipText = (rawText: string, filename: string): Payslip => {
  const text = compact(rawText.replaceAll(PAGE_MARKER, ` ${PAGE_MARKER} `));
  const summary = text.split(PAGE_MARKER)[0];
  const weekDate = weekDateFrom(text);
  if (!weekDate) throw new Error("Week Commencing was not found. This PDF layout is not supported yet.");
  const weekStart = mondayOf(isoDate(weekDate));
  const jobs = parseJobs(text);
  const expenses = parseExpenses(text);

  const deliveriesPaid = amountBetween(summary, /\bDeliveries\b/i, /On Time Deliveries/i);
  const rewardLabel = /(?:Rewards|Delivery Time Uplift)/i;
  const rewardPaid = amountBetween(summary, rewardLabel, /\bExpenses\b/i);
  const expensesPaid = amountBetween(summary, /\bExpenses\b/i, /(?:Bonus|Additional Fees)/i);
  const bonusPaid = amountBetween(summary, /(?:Bonus|Additional Fees)/i, /\bDeductions\b/i);
  const deductions = amountBetween(summary, /\bDeductions\b/i, /\bTotal\b/i);
  const rewardArea = summary.match(/(?:Rewards|Delivery Time Uplift)([\s\S]{0,100}?)Expenses/i)?.[1] ?? "";
  const rewardPercent = Number(rewardArea.match(/([\d.]+)%/)?.[1] ?? 0);
  const onTimeMatch = summary.match(/On Time Deliveries\s+(\d+)/i);
  const totalMatch = summary.match(new RegExp(`\\bTotal\\s+(?:£\\s*(${MONEY_SOURCE})|(${MONEY_SOURCE})\\s*£)`, "i"));
  const adminMatch = summary.match(new RegExp(`([\\d,]+\\.\\d{2})\\s*£\\s*(\\d+)\\s+Total`, "i"));

  return {
    id: `payslip-${weekStart}`,
    weekStart,
    deliveriesReported: jobs.length,
    onTimeReported: onTimeMatch ? Number(onTimeMatch[1]) : null,
    rewardPercent,
    rewardPaid,
    expensesPaid,
    bonusPaid,
    deductions,
    adminDays: adminMatch ? Number(adminMatch[2]) : 0,
    adminFee: money(adminMatch?.[1]),
    totalPaid: money(totalMatch?.[1] ?? totalMatch?.[2]),
    deliveriesPaid: deliveriesPaid || jobs.reduce((sum, item) => sum + item.paid, 0),
    sourceFiles: [filename],
    importedAt: new Date().toISOString(),
    pdfJobs: jobs,
    pdfExpenses: expenses
  };
};
