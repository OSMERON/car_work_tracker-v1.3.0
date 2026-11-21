import type { AppData, Job, Language } from "../types";
import { getPayslipPdf, savePayslipPdf } from "./pdfStore";
import { bytesText, createZip, readZip, textBytes } from "./zip";

const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sheet = (rows: unknown[][]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => { const ref = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`; return typeof cell === "number" ? `<c r="${ref}"><v>${cell}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`; }).join("")}</row>`).join("")}</sheetData></worksheet>`;
const appRow = (data: AppData) => [["ARIS_DATA_JSON"], [JSON.stringify(data)]];

export const makeWorkbook = (data: AppData, language: Language) => {
  const ro = language === "ro";
  const jobs = [["ID", "Job Ref", ro ? "Data colectării" : "Collection date", ro ? "Tip vehicul" : "Vehicle type", ro ? "Înmatriculare" : "Registration", ro ? "Model" : "Model", ro ? "Colectare" : "Pickup", ro ? "Livrare" : "Delivery", ro ? "Mile reale" : "Actual miles", ro ? "Range colectare" : "Collection range", ro ? "Range livrare" : "Delivery range", "JSON"], ...data.jobs.map(job => [job.id, job.jobRef, job.collectionDate, job.vehicleType ?? "unspecified", job.registration, job.makeModel, job.pickupTown, job.deliveryTown, job.actualMiles ?? "", job.rangeStart ?? "", job.rangeEnd ?? "", JSON.stringify(job)])];
  const expenses = [["ID", "Job Ref", ro ? "Data" : "Date", ro ? "Categorie" : "Category", ro ? "Cost" : "Cost", "JSON"], ...data.expenses.map(item => [item.id, item.jobRef, item.date, item.category, item.actualCost, JSON.stringify(item)])];
  const payslips = [["ID", ro ? "Săptămână" : "Week", ro ? "Total plătit" : "Total paid", "JSON"], ...data.payslips.map(item => [item.id, item.weekStart, item.totalPaid, JSON.stringify(item)])];
  const electric = [["Job Ref", ro ? "Tip" : "Type", ro ? "Cost" : "Cost", ro ? "Durată minute" : "Duration minutes", "kW", "p/kWh", ro ? "Litri" : "Litres", ro ? "Preț/litru" : "Price/litre"], ...data.jobs.filter(job => job.chargingEntry || job.fuelEntry).map(job => [job.jobRef, job.vehicleType ?? "unspecified", job.chargingEntry?.totalCost ?? job.fuelEntry?.totalCost ?? "", job.chargingEntry?.durationMinutes ?? "", job.chargingEntry?.averageKw ?? "", job.chargingEntry?.tariffPencePerKwh ?? "", job.fuelEntry?.litres ?? "", job.fuelEntry?.pricePerLitre ?? ""])];
  const summary = [[ro ? "A.R.I.S. Export" : "A.R.I.S. Export", "1.5.6"], [ro ? "Nume" : "Name", data.profile?.name ?? ""], [ro ? "Joburi" : "Jobs", data.jobs.length], [ro ? "Cheltuieli" : "Expenses", data.expenses.length], [ro ? "Fluturași" : "Payslips", data.payslips.length], ...appRow(data)];
  const settings = [[ro ? "Setare" : "Setting", ro ? "Valoare" : "Value"], ["profile", JSON.stringify(data.profile ?? {})], ["theme", data.themeMode ?? "dark"], ["tax", JSON.stringify(data.taxSettings ?? {})]];
  const sheets = [["Summary", summary], ["Jobs", jobs], ["Expenses", expenses], ["Payslips", payslips], ["Electric", electric], ["Settings", settings]] as const;
  const files = [
    { name: "[Content_Types].xml", data: textBytes(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`) },
    { name: "_rels/.rels", data: textBytes(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: "xl/workbook.xml", data: textBytes(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets></workbook>`) },
    { name: "xl/_rels/workbook.xml.rels", data: textBytes(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}</Relationships>`) },
    ...sheets.map(([, rows], index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: textBytes(sheet(rows as unknown[][])) }))
  ];
  return createZip(files).slice(0, undefined, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
};

export const readWorkbook = async (file: File) => {
  const files = await readZip(await file.arrayBuffer()); const summary = files.get("xl/worksheets/sheet1.xml"); if (!summary) throw new Error("Summary sheet missing");
  const document = new DOMParser().parseFromString(bytesText(summary), "application/xml"); const cells = [...document.querySelectorAll("c")].map(cell => cell.textContent ?? ""); const marker = cells.indexOf("ARIS_DATA_JSON"); if (marker < 0 || !cells[marker + 1]) throw new Error("A.R.I.S. data missing");
  return JSON.parse(cells[marker + 1]) as AppData;
};

export const makeBackup = async (data: AppData, language: Language) => {
  const workbook = new Uint8Array(await makeWorkbook(data, language).arrayBuffer()); const files = [{ name: "ARIS_data.xlsx", data: workbook }, { name: "manifest.json", data: textBytes(JSON.stringify({ app: "ARIS", version: "1.5.6", createdAt: new Date().toISOString() }, null, 2)) }];
  for (const payslip of data.payslips) { const pdf = await getPayslipPdf(payslip.id); if (pdf) files.push({ name: `payslips/${payslip.id}.pdf`, data: new Uint8Array(await pdf.arrayBuffer()) }); }
  return createZip(files);
};

export const readBackup = async (file: File) => { const files = await readZip(await file.arrayBuffer()); const book = files.get("ARIS_data.xlsx"); if (!book) throw new Error("ARIS_data.xlsx missing"); const bookPart = book.buffer.slice(book.byteOffset, book.byteOffset + book.byteLength) as ArrayBuffer; const data = await readWorkbook(new File([bookPart], "ARIS_data.xlsx")); for (const [name, bytes] of files) if (name.startsWith("payslips/") && name.endsWith(".pdf")) { const part = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; await savePayslipPdf(name.slice(9, -4), new File([part], name.split("/").pop() ?? "payslip.pdf", { type: "application/pdf" })); } return data; };

const key = (job: Job) => job.jobRef.trim().toLowerCase() || [job.collectionDate, job.registration, job.pickupTown, job.deliveryTown].join("|").toLowerCase();
export const mergeData = (current: AppData, incoming: AppData, replace: boolean) => replace ? incoming : { ...current, jobs: [...current.jobs, ...incoming.jobs.filter(job => !new Set(current.jobs.map(key)).has(key(job)))], expenses: [...current.expenses, ...incoming.expenses.filter(item => !current.expenses.some(existing => existing.id === item.id))], payslips: [...current.payslips, ...incoming.payslips.filter(item => !current.payslips.some(existing => existing.id === item.id || existing.weekStart === item.weekStart))], generatedAt: new Date().toISOString() };
export const previewImport = (current: AppData, incoming: AppData) => { const keys = new Set(current.jobs.map(key)); const duplicates = incoming.jobs.filter(job => keys.has(key(job))).length; return { newJobs: incoming.jobs.length - duplicates, duplicates, expenses: incoming.expenses.length, payslips: incoming.payslips.length, errors: 0 }; };

export const downloadBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
