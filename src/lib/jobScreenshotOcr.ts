import { createWorker, OEM } from "tesseract.js";
import { detectProtocol, normalizeRegistration } from "./jobProtocols";
import type { JobProtocol } from "../types";

export type JobScreenshotFields = {
  jobRef: string;
  rawJobRef: string;
  pickupCompany: string;
  pickupAddress: string;
  pickupTown: string;
  pickupPostcode: string;
  deliveryCompany: string;
  deliveryAddress: string;
  deliveryTown: string;
  deliveryPostcode: string;
  deliveryDate: string;
  registrations: string[];
  makeModel: string;
  vehicleYear: string;
  vin: string;
  vinIncomplete: boolean;
  modelPin: string;
  protocol?: JobProtocol;
  otherInfo: string;
  rawText: string;
  confidence: number;
  isJobList: boolean;
};

const blankFields = (): JobScreenshotFields => ({
  jobRef: "", rawJobRef: "", pickupCompany: "", pickupAddress: "", pickupTown: "", pickupPostcode: "",
  deliveryCompany: "", deliveryAddress: "", deliveryTown: "", deliveryPostcode: "", deliveryDate: "",
  registrations: [], makeModel: "", vehicleYear: "", vin: "", vinIncomplete: false, modelPin: "", protocol: undefined,
  otherInfo: "", rawText: "", confidence: 0, isJobList: false
});

const clean = (value = "") => value.replace(/[|]/g, "I").replace(/\s+/g, " ").replace(/^[\s,:.-]+|[\s,:.-]+$/g, "").trim();
const postcode = (value = "") => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 5 || compact.length > 7) return clean(value).toUpperCase();
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
};
const isoDate = (value = "") => {
  const match = value.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
};
const findPostcodes = (value: string) => [...value.toUpperCase().matchAll(/\b([A-Z]{1,2}\d[A-Z\d]?)[\s,.]*([0-9][A-Z]{2})\b/g)].map(match => postcode(`${match[1]} ${match[2]}`));
const townFromAddress = (address: string, foundPostcode: string) => {
  const without = address.replace(new RegExp(foundPostcode.replace(" ", "\\s*"), "i"), "");
  const parts = without.split(/[,\n]/).map(clean).filter(Boolean);
  return parts.at(-1)?.replace(/\b(?:ROAD|STREET|HOUSE|UNIT|PARK)\b.*$/i, "").trim() || "";
};
const labelledBlock = (text: string, start: RegExp, end: RegExp) => {
  const startMatch = start.exec(text);
  if (!startMatch) return "";
  const rest = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(rest);
  return clean(endMatch ? rest.slice(0, endMatch.index) : rest);
};
const removeContactData = (value: string) => value
  .split("\n")
  .filter(line => !/^\s*Contact\s*:/i.test(line))
  .join("\n")
  .replace(/\b(?:\+?44\s?\d|0\d)(?:[\s()-]*\d){8,11}\b/g, "")
  .replace(/\[?\s*VID\s*:\s*\d+\s*\]?/gi, "")
  .replace(/[ \t]+$/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const cleanOtherInfo = (value: string) => clean(value
  .replace(/\b(?:\+?44\s?\d|0\d)(?:[\s()-]*\d){8,11}\b/g, "")
  .replace(/\bCALL\s+(?=Support|$)/gi, "")
);

export const parseJobScreenshotText = (rawText: string, confidence = 0): JobScreenshotFields => {
  const fields = blankFields();
  const text = rawText.replace(/\r/g, "").replace(/[“”]/g, '"');
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
  fields.isJobList = /Clear\s+Completed\s+Jobs|Job\s+No\s*:/i.test(oneLine) && !/Job\s+Ref\s*:/i.test(oneLine);
  if (fields.isJobList) {
    fields.rawText = removeContactData(rawText);
    fields.confidence = Math.round(confidence);
    return fields;
  }

  const ref = oneLine.match(/Job\s*Ref\s*[:;]?\s*([0-9]{6,})\s*[\/]\s*([0-9]+)/i) || oneLine.match(/Job\s*Ref\s*[:;]?\s*([0-9]{6,})/i);
  fields.jobRef = ref?.[1] || "";
  fields.rawJobRef = ref ? clean(ref[2] ? `${ref[1]}/${ref[2]}` : ref[1]) : "";

  const from = labelledBlock(oneLine, /\bFrom\s*[:;]?\s*/i, /\bContact\s*[:;]?|\bTo\s*[:;]?/i);
  const to = labelledBlock(oneLine, /\bTo\s*[:;]?\s*/i, /\bContact\s*[:;]?|\bDelivery\s*Date/i);
  const splitLocation = (value: string) => {
    const codes = findPostcodes(value);
    const code = codes.at(-1) || "";
    const parts = value.split(",").map(clean).filter(Boolean);
    return { company: parts[0] || "", address: value, town: townFromAddress(value, code), code };
  };
  const pickup = splitLocation(from);
  const delivery = splitLocation(to);
  Object.assign(fields, { pickupCompany: pickup.company, pickupAddress: pickup.address, pickupTown: pickup.town, pickupPostcode: pickup.code, deliveryCompany: delivery.company, deliveryAddress: delivery.address, deliveryTown: delivery.town, deliveryPostcode: delivery.code });

  fields.deliveryDate = isoDate(oneLine.match(/Delivery\s*Date\s*[:;]?\s*([0-9/.\-]+)/i)?.[1]);
  fields.otherInfo = cleanOtherInfo(labelledBlock(oneLine, /Other\s*Info\s*[:;]?\s*/i, /Click\s*Here|REG\s*[/|]VIN/i));
  fields.modelPin = clean(oneLine.match(/MODEL\s*PIN\s*[:;]?\s*([0-9]{4,})/i)?.[1]);
  fields.protocol = detectProtocol(`${fields.otherInfo} ${oneLine.match(/\b(?:AUTOROLA|HILTON)\b/i)?.[0] || ""}`);

  const regBlock = oneLine.match(/REG\s*[/|]VIN\s*[:;]?\s*(.*?)\s+MODEL\s*:/i)?.[1] || "";
  const identifiers = regBlock.split(/[\/|]/).map(value => normalizeRegistration(value.replace(/\.+$/g, ""))).filter(Boolean);
  fields.registrations = [...new Set(identifiers.filter(value => value.length <= 8))];
  fields.vin = identifiers.find(value => value.length > 8) || "";
  fields.vinIncomplete = Boolean(fields.vin && (regBlock.includes("...") || fields.vin.length !== 17));
  const registrationNeedsReview = fields.registrations.length > 1 && fields.registrations.some(value => !/\d/.test(value));

  const modelMatch = oneLine.match(/REG\s*[/|]VIN.*?MODEL\s*:\s*(.*?)(?:\[\s*VID\s*:|$)/i);
  fields.makeModel = clean(modelMatch?.[1]).replace(/[\[]+$/g, "").trim();
  fields.rawText = removeContactData(rawText);
  fields.confidence = Math.round(registrationNeedsReview ? Math.min(confidence, 75) : confidence);
  return fields;
};

const choose = (first: string, second: string) => first.trim() || second.trim();
export const mergeJobScreenshotFields = (items: JobScreenshotFields[]) => items.reduce((result, item) => ({
  ...result,
  jobRef: choose(result.jobRef, item.jobRef), rawJobRef: choose(result.rawJobRef, item.rawJobRef),
  pickupCompany: choose(result.pickupCompany, item.pickupCompany), pickupAddress: choose(result.pickupAddress, item.pickupAddress), pickupTown: choose(result.pickupTown, item.pickupTown), pickupPostcode: choose(result.pickupPostcode, item.pickupPostcode),
  deliveryCompany: choose(result.deliveryCompany, item.deliveryCompany), deliveryAddress: choose(result.deliveryAddress, item.deliveryAddress), deliveryTown: choose(result.deliveryTown, item.deliveryTown), deliveryPostcode: choose(result.deliveryPostcode, item.deliveryPostcode),
  deliveryDate: choose(result.deliveryDate, item.deliveryDate), registrations: [...new Set([...result.registrations, ...item.registrations])],
  makeModel: choose(result.makeModel, item.makeModel), vehicleYear: choose(result.vehicleYear, item.vehicleYear), vin: choose(result.vin, item.vin), vinIncomplete: result.vinIncomplete || item.vinIncomplete,
  modelPin: choose(result.modelPin, item.modelPin), protocol: result.protocol ?? item.protocol, otherInfo: choose(result.otherInfo, item.otherInfo),
  rawText: [result.rawText, item.rawText].filter(Boolean).join("\n\n--- SCREENSHOT ---\n\n"), confidence: Math.round(Math.max(result.confidence, item.confidence)), isJobList: result.isJobList || item.isJobList
}), blankFields());

export const recognizeJobScreenshots = async (images: Blob[], onProgress: (progress: number, label: string) => void) => {
  const root = new URL(import.meta.env.BASE_URL, window.location.href);
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: new URL("ocr/worker.min.js", root).href,
    corePath: new URL("ocr/core", root).href,
    langPath: new URL("ocr/lang", root).href,
    logger: message => onProgress(message.progress, message.status)
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "300" });
    const results: JobScreenshotFields[] = [];
    for (let index = 0; index < images.length; index += 1) {
      onProgress(index / images.length, `Screenshot ${index + 1}/${images.length}`);
      const { data } = await worker.recognize(images[index], { rotateAuto: true });
      results.push(parseJobScreenshotText(data.text, data.confidence));
    }
    return mergeJobScreenshotFields(results);
  } finally {
    await worker.terminate();
  }
};
