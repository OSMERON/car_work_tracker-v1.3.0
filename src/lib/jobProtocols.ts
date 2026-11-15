import type { Job, JobProtocol, Language } from "../types";

export const PROTOCOLS: Record<JobProtocol, { code: string; name: string; ro: string; en: string; classified?: boolean }> = {
  model: { code: "MARK-II", name: "MODEL", ro: "A doua aplicație și verificări foto", en: "Second app and photo checks" },
  hilton: { code: "ARC-2", name: "HILTON", ro: "Operațiune cu plată suplimentară", en: "Operation with additional payment" },
  autorola: { code: "SHADOW", name: "AUTOROLA", ro: "Ruta poate rămâne clasificată", en: "The route may remain classified", classified: true },
  other: { code: "NEXUS", name: "OTHER", ro: "Platformă nouă sau necunoscută", en: "New or unknown platform" }
};

export const detectProtocol = (text: string): JobProtocol | undefined => {
  const value = text.toUpperCase();
  if (/\bAUTOROLA\b/.test(value)) return "autorola";
  if (/\bHILTON\b/.test(value)) return "hilton";
  if (/\bMODEL\s*PIN\b|MOVEMENT\s+ON\s+MODEL|\bMODEL\s+APP\b/.test(value)) return "model";
  return undefined;
};

export const normalizeRegistration = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const parseRegistrationInput = (value: string) => [...new Set(value.split(/[\/,;\n]+/).map(normalizeRegistration).filter(Boolean))];

export const jobRegistrations = (job: Pick<Job, "registration" | "registrations" | "payslipRegistration">, includePayslip = false) => {
  const values = [...(job.registrations ?? []), job.registration];
  if (includePayslip) values.push(job.payslipRegistration);
  return [...new Set(values.map(normalizeRegistration).filter(Boolean))];
};

export const protocolLabel = (protocol: JobProtocol | undefined, language: Language) => protocol ? PROTOCOLS[protocol][language] : "";
