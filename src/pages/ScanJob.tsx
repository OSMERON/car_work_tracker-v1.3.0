import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CheckCircle2, FileImage, Images, LoaderCircle, ScanLine, ShieldAlert, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Field, PageHeader } from "../components/Ui";
import { ProtocolBadge } from "../components/ProtocolBadge";
import { mondayOf } from "../lib/date";
import { compressJobImage, getJobImages, saveJobImages } from "../lib/jobImageStore";
import { recognizeJobScreenshots, type JobScreenshotFields } from "../lib/jobScreenshotOcr";
import { parseRegistrationInput, PROTOCOLS } from "../lib/jobProtocols";
import { useData } from "../store/DataContext";
import type { Job, JobProtocol, VehicleType } from "../types";

type Draft = JobScreenshotFields & { collectionDate: string; collectionTime: string; notes: string; vehicleType: VehicleType | ""; odometerStart: string; rangeStart: string };
const emptyDraft = (): Draft => ({
  jobRef: "", rawJobRef: "", pickupCompany: "", pickupAddress: "", pickupTown: "", pickupPostcode: "",
  deliveryCompany: "", deliveryAddress: "", deliveryTown: "", deliveryPostcode: "", deliveryDate: "",
  registrations: [], makeModel: "", vehicleYear: "", vin: "", vinIncomplete: false, modelPin: "", protocol: undefined,
  otherInfo: "", rawText: "", confidence: 0, isJobList: false, collectionDate: "", collectionTime: "", notes: "", vehicleType: "", odometerStart: "", rangeStart: ""
});

export function ScanJobPage() {
  const { data, language, saveJob } = useData();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressed, setCompressed] = useState<Blob[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const duplicate = useMemo(() => data.jobs.find(job => job.jobRef.trim() === draft.jobRef.trim() && draft.jobRef.trim()), [data.jobs, draft.jobRef]);
  const lowConfidence = draft.confidence > 0 && draft.confidence < 82;
  const routeRequired = draft.protocol !== "autorola";
  const requiredMissing = !draft.jobRef || !draft.deliveryDate || !draft.collectionDate || !draft.vehicleType || (routeRequired && (!draft.pickupPostcode || !draft.deliveryPostcode));

  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])].filter(file => !file.type || file.type.startsWith("image/") || /\.(?:png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name));
    event.target.value = "";
    if (!selected.length) {
      setMessage(language === "ro" ? "Fișierul ales nu este recunoscut ca imagine. Folosește PNG, JPG, JPEG sau WEBP." : "The selected file is not recognised as an image. Use PNG, JPG, JPEG or WEBP.");
      return;
    }
    const nextFiles = [...files, ...selected];
    setFiles(nextFiles);
    setPreviews(nextFiles.map(file => URL.createObjectURL(file)));
    setMessage("");
    setReviewed(false);
    setReplaceConfirmed(false);
  };

  const removeImage = (index: number) => {
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    setFiles(next);
    setPreviews(next.map(file => URL.createObjectURL(file)));
    setCompressed([]);
  };

  const scan = async () => {
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    setProgress(0);
    try {
      setStage(language === "ro" ? "Pregătesc imaginile" : "Preparing images");
      const images = await Promise.all(files.map(compressJobImage));
      setCompressed(images);
      const fields = await recognizeJobScreenshots(images, (value, label) => { setProgress(value); setStage(label); });
      if (fields.isJobList && !fields.jobRef) {
        setDraft(current => ({ ...current, ...fields }));
        setMessage(language === "ro" ? "Aceasta este lista generală RAS. Nu a fost importat niciun job. Încarcă pagina individuală a unui job." : "This is the general RAS list. No job was imported. Upload an individual job page.");
        return;
      }
      setDraft(current => ({ ...current, ...fields }));
      setMessage(language === "ro" ? "Citirea s-a terminat. Verifică zonele marcate înainte de salvare." : "Reading finished. Check marked fields before saving.");
    } catch (error) {
      setMessage(`${language === "ro" ? "Citirea nu a reușit" : "Reading failed"}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      setProgress(1);
    }
  };

  const update = (key: keyof Draft, value: string | boolean | number | string[] | JobProtocol | undefined) => {
    setDraft(current => ({ ...current, [key]: value }));
    setReplaceConfirmed(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (draft.isJobList) {
      setMessage(language === "ro" ? "Lista generală nu se importă. Folosește pagina individuală a jobului." : "The general list is not imported. Use the individual job page.");
      return;
    }
    if (requiredMissing) {
      setMessage(language === "ro" ? "Completează Job Ref, data planificată, data colectării și postcode-urile când ruta nu este SHADOW." : "Complete Job Ref, planned date, collection date and postcodes when the route is not SHADOW.");
      return;
    }
    if (lowConfidence && !reviewed) {
      setMessage(language === "ro" ? "Confirmă că ai verificat manual câmpurile importante." : "Confirm that you manually checked the important fields.");
      return;
    }
    if (duplicate && !replaceConfirmed) {
      setMessage(language === "ro" ? `Job Ref ${draft.jobRef} există deja. Confirmă actualizarea în panoul roșu.` : `Job Ref ${draft.jobRef} already exists. Confirm the update in the red panel.`);
      return;
    }
    const now = new Date().toISOString();
    const id = duplicate?.id ?? crypto.randomUUID();
    const job: Job = {
      ...(duplicate ?? {} as Job), id, jobRef: draft.jobRef.trim(), rawJobRef: draft.rawJobRef.trim(), status: duplicate?.status ?? "collected",
      collectionDate: draft.collectionDate, collectionTime: draft.collectionTime, deliveryDate: duplicate?.deliveryDate || "", deliveryTime: duplicate?.deliveryTime || "",
      makeModel: draft.makeModel || duplicate?.makeModel || "", carType: duplicate?.carType || "", registration: draft.registrations[0] || duplicate?.registration || "", registrations: draft.registrations.length ? draft.registrations : duplicate?.registrations, payslipRegistration: duplicate?.payslipRegistration || "",
      customerType: duplicate?.customerType || "", pickupTown: draft.pickupTown, pickupPostcode: draft.pickupPostcode.replace(/\s/g, "").toUpperCase(),
      deliveryTown: draft.deliveryTown, deliveryPostcode: draft.deliveryPostcode.replace(/\s/g, "").toUpperCase(), vehicleType: draft.vehicleType as VehicleType, odometerStart: draft.odometerStart ? Number(draft.odometerStart) : duplicate?.odometerStart ?? null,
      rangeStart: draft.rangeStart ? Number(draft.rangeStart) : duplicate?.rangeStart ?? null, rangeEnd: duplicate?.rangeEnd ?? null,
      odometerEnd: duplicate?.odometerEnd ?? null, estimatedMiles: duplicate?.estimatedMiles ?? null, actualMiles: duplicate?.actualMiles ?? null, payslipMiles: duplicate?.payslipMiles ?? null,
      waitingEstimated: duplicate?.waitingEstimated ?? null, waitingPaid: duplicate?.waitingPaid ?? null, tariffPaid: duplicate?.tariffPaid ?? null,
      firstDeliveryBefore9: duplicate?.firstDeliveryBefore9 ?? null, deliveryOrder: duplicate?.deliveryOrder ?? null, weekStart: mondayOf(draft.collectionDate),
      notes: [duplicate?.notes, draft.notes].filter(Boolean).join("\n"), source: duplicate?.source ?? "manual", createdAt: duplicate?.createdAt ?? now, updatedAt: now,
      pickupCompany: draft.pickupCompany, pickupAddress: draft.pickupAddress, deliveryCompany: draft.deliveryCompany, deliveryAddress: draft.deliveryAddress,
      vin: draft.vin, vinIncomplete: draft.vinIncomplete, modelPin: draft.modelPin, otherInfo: draft.otherInfo, vehicleYear: draft.vehicleYear,
      protocol: draft.protocol, protocolExtraDetected: duplicate?.protocolExtraDetected ?? null, protocolExtraPaid: duplicate?.protocolExtraPaid ?? null,
      ocrRawText: draft.rawText, ocrConfidence: draft.confidence, sourceImageCount: (duplicate?.sourceImageCount ?? 0) + compressed.length,
      plannedDeliveryDate: draft.deliveryDate
    };
    const images = compressed.length ? compressed : await Promise.all(files.map(compressJobImage));
    const previousImages = duplicate ? await getJobImages(id) : [];
    await saveJobImages(id, [...previousImages, ...images]);
    saveJob(job);
    navigate("/history");
  };

  const confidenceLabel = !draft.confidence ? "" : draft.confidence >= 82 ? (language === "ro" ? "Citire bună" : "Good reading") : (language === "ro" ? "Verificare necesară" : "Review required");
  return <>
    <PageHeader eyebrow="A.R.I.S. VISION" title={language === "ro" ? "Importă jobul din fotografie" : "Import job from photo"} subtitle={language === "ro" ? "Procesarea rămâne în browser. Imaginea și textul nu sunt trimise unui serviciu extern." : "Processing stays in your browser. The image and text are not sent to an external service."}/>
    <section className="scan-intro-grid">
      <article className="scan-upload-panel">
        <div className="scan-actions">
          <label className="primary-button upload-button"><Camera/>{language === "ro" ? "Fă fotografie" : "Take photo"}<input type="file" accept="image/*,.png,.jpg,.jpeg,.webp" capture="environment" onChange={addFiles}/></label>
          <label className="secondary-button upload-button"><Images/>{language === "ro" ? "Alege din galerie" : "Choose from gallery"}<input type="file" accept="image/*,.png,.jpg,.jpeg,.webp" multiple onChange={addFiles}/></label>
        </div>
        <p>{language === "ro" ? "Poți adăuga mai multe capturi pentru același job. A.R.I.S. combină informațiile." : "You may add several screenshots for one job. A.R.I.S. merges the information."}</p>
        {!!previews.length && <div className="scan-thumbnails">{previews.map((preview, index) => <figure key={`${preview}-${index}`}><img src={preview} alt="Job screenshot"/><button type="button" onClick={() => removeImage(index)} aria-label={language === "ro" ? "Șterge imaginea" : "Remove image"}><Trash2/></button><figcaption>{index + 1}</figcaption></figure>)}</div>}
        <button className="scan-command-button" type="button" disabled={!files.length || busy} onClick={() => void scan()}>{busy ? <LoaderCircle className="spin"/> : <ScanLine/>}{busy ? (language === "ro" ? "A.R.I.S. citește" : "A.R.I.S. is reading") : (language === "ro" ? "Citește toate imaginile" : "Read all images")}</button>
        {busy && <div className="scan-progress"><i><b style={{ width: `${Math.round(progress * 100)}%` }}/></i><span>{stage} · {Math.round(progress * 100)}%</span></div>}
      </article>
      <article className="scan-security"><ShieldAlert/><div><strong>{language === "ro" ? `Controlul rămâne la tine, ${data.profile?.name}` : `You remain in control, ${data.profile?.name}`}</strong><p>{language === "ro" ? "Data colectării nu se presupune. VIN-ul incomplet este marcat. Câmpurile nesigure blochează salvarea până le verifici." : "The collection date is never assumed. An incomplete VIN is marked. Uncertain fields block saving until you review them."}</p></div></article>
    </section>

    {(draft.rawText || message) && <form className="form-card scan-review" onSubmit={save}>
      <div className="scan-review-heading"><div><span className="eyebrow">A.R.I.S. EXTRACTION</span><h2>{language === "ro" ? "Verifică datele extrase" : "Review extracted data"}</h2></div>{draft.confidence > 0 && <span className={`scan-confidence ${lowConfidence ? "warn" : "ok"}`}>{confidenceLabel} · {draft.confidence}%</span>}</div>
      <div className="form-grid">
        <Field label="Job Ref *"><input className={!draft.jobRef ? "field-invalid" : ""} value={draft.jobRef} onChange={event => update("jobRef", event.target.value.replace(/\D/g, ""))}/></Field>
        <Field label={language === "ro" ? "Referință completă" : "Full reference"}><input value={draft.rawJobRef} onChange={event => update("rawJobRef", event.target.value)}/></Field>
        <Field label={language === "ro" ? "Data colectării, completată de tine *" : "Collection date, entered by you *"}><input className={!draft.collectionDate ? "field-invalid" : ""} type="date" value={draft.collectionDate} onChange={event => update("collectionDate", event.target.value)}/></Field>
        <Field label={language === "ro" ? "Ora colectării" : "Collection time"}><input type="time" value={draft.collectionTime} onChange={event => update("collectionTime", event.target.value)}/></Field>
        <Field label={language === "ro" ? "Data livrării din job *" : "Delivery date from job *"}><input className={!draft.deliveryDate ? "field-invalid" : ""} type="date" value={draft.deliveryDate} onChange={event => update("deliveryDate", event.target.value)}/></Field>
        <Field label={language === "ro" ? "Înmatriculare sau înmatriculări" : "Registration or registrations"}><input value={draft.registrations.join(" / ")} onChange={event => update("registrations", parseRegistrationInput(event.target.value))} placeholder="X005WAT / KJ23LHE"/></Field>
        <Field label={language === "ro" ? "Marcă și model" : "Make and model"}><input value={draft.makeModel} onChange={event => update("makeModel", event.target.value)} placeholder="VAUXHALL VIVARO"/></Field>
        <Field label={language === "ro" ? "An, completat manual" : "Year, entered manually"}><input inputMode="numeric" value={draft.vehicleYear} onChange={event => update("vehicleYear", event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2027"/></Field>
        <Field label={language === "ro" ? "Tip vehicul *" : "Vehicle type *"}><select className={!draft.vehicleType ? "field-invalid" : ""} value={draft.vehicleType} onChange={event => update("vehicleType", event.target.value as VehicleType)}><option value="">{language === "ro" ? "Alege" : "Choose"}</option><option value="electric">Electric</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="hybrid">Hybrid</option></select></Field>
        <Field label={language === "ro" ? "Kilometraj la colectare, mile, opțional" : "Collection odometer, miles, optional"}><input type="number" min="0" step="0.1" value={draft.odometerStart} onChange={event => update("odometerStart", event.target.value)}/></Field>
        <Field label={language === "ro" ? "Range la colectare, mile, opțional" : "Collection range, miles, optional"}><input type="number" min="0" step="0.1" value={draft.rangeStart} onChange={event => update("rangeStart", event.target.value)}/></Field>
      </div>
      <section className="protocol-selector"><div><span className="eyebrow">A.R.I.S. PROTOCOL</span><h3>{language === "ro" ? "Platformă suplimentară" : "Additional platform"}</h3><p>{language === "ro" ? "Porecla este afișată mare, iar denumirea reală apare dedesubt." : "The codename appears large and the real name appears below."}</p></div><div className="protocol-options"><button type="button" className={!draft.protocol ? "active" : ""} onClick={() => update("protocol", undefined)}><strong>{language === "ro" ? "FĂRĂ PROTOCOL" : "NO PROTOCOL"}</strong><small>{language === "ro" ? "Job normal" : "Standard job"}</small></button>{(Object.keys(PROTOCOLS) as JobProtocol[]).map(protocol => <button type="button" key={protocol} className={draft.protocol === protocol ? "active" : ""} onClick={() => update("protocol", protocol)}><ProtocolBadge protocol={protocol} language={language} compact/></button>)}</div></section>
      <h3 className="form-section-title">{language === "ro" ? "Colectare" : "Pickup"}</h3>
      <div className="form-grid"><Field label={language === "ro" ? "Companie" : "Company"}><input value={draft.pickupCompany} onChange={event => update("pickupCompany", event.target.value)}/></Field><Field label={language === "ro" ? "Localitate" : "Town"}><input value={draft.pickupTown} onChange={event => update("pickupTown", event.target.value)}/></Field><Field label={`Postcode${routeRequired ? " *" : ""}`}><input className={routeRequired && !draft.pickupPostcode ? "field-invalid" : ""} value={draft.pickupPostcode} onChange={event => update("pickupPostcode", event.target.value.toUpperCase())} placeholder={!routeRequired ? (language === "ro" ? "Locație clasificată" : "Classified location") : ""}/></Field><Field label={language === "ro" ? "Adresă completă" : "Full address"} wide><textarea rows={2} value={draft.pickupAddress} onChange={event => update("pickupAddress", event.target.value)} placeholder={!routeRequired ? (language === "ro" ? "Locație clasificată" : "Classified location") : ""}/></Field></div>
      <h3 className="form-section-title">{language === "ro" ? "Livrare" : "Delivery"}</h3>
      <div className="form-grid"><Field label={language === "ro" ? "Companie" : "Company"}><input value={draft.deliveryCompany} onChange={event => update("deliveryCompany", event.target.value)}/></Field><Field label={language === "ro" ? "Localitate" : "Town"}><input value={draft.deliveryTown} onChange={event => update("deliveryTown", event.target.value)}/></Field><Field label={`Postcode${routeRequired ? " *" : ""}`}><input className={routeRequired && !draft.deliveryPostcode ? "field-invalid" : ""} value={draft.deliveryPostcode} onChange={event => update("deliveryPostcode", event.target.value.toUpperCase())} placeholder={!routeRequired ? (language === "ro" ? "Locație clasificată" : "Classified location") : ""}/></Field><Field label={language === "ro" ? "Adresă completă" : "Full address"} wide><textarea rows={2} value={draft.deliveryAddress} onChange={event => update("deliveryAddress", event.target.value)} placeholder={!routeRequired ? (language === "ro" ? "Locație clasificată" : "Classified location") : ""}/></Field></div>
      <h3 className="form-section-title">{language === "ro" ? "Detalii tehnice și instrucțiuni" : "Technical details and instructions"}</h3>
      <div className="form-grid"><Field label={`VIN${draft.vinIncomplete ? ` · ${language === "ro" ? "INCOMPLET" : "INCOMPLETE"}` : ""}`}><input className={draft.vinIncomplete ? "field-warning" : ""} value={draft.vin} onChange={event => update("vin", event.target.value.toUpperCase())}/></Field><Field label="Model PIN"><input value={draft.modelPin} onChange={event => update("modelPin", event.target.value)}/></Field><Field label="Other Info" wide><textarea rows={4} value={draft.otherInfo} onChange={event => update("otherInfo", event.target.value)}/></Field><Field label={language === "ro" ? "Notițe proprii" : "Your notes"} wide><textarea rows={3} value={draft.notes} onChange={event => update("notes", event.target.value)}/></Field></div>
      {lowConfidence && <label className="scan-verify"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)}/><CheckCircle2/><span>{language === "ro" ? "Am verificat manual Job Ref, înmatriculările, data și ruta când este vizibilă." : "I manually checked Job Ref, registrations, date and the route when visible."}</span></label>}
      {duplicate && <div className="scan-duplicate"><ShieldAlert/><div><strong>{language === "ro" ? `Jobul ${draft.jobRef} există deja` : `Job ${draft.jobRef} already exists`}</strong><p>{language === "ro" ? "Datele noi se combină cu înregistrarea existentă numai după confirmare." : "New data is merged into the existing record only after confirmation."}</p><label><input type="checkbox" checked={replaceConfirmed} onChange={event => setReplaceConfirmed(event.target.checked)}/>{language === "ro" ? "Confirm actualizarea jobului existent" : "Confirm updating the existing job"}</label></div></div>}
      {message && <div className={message.includes("terminat") || message.includes("finished") ? "alert green" : "alert red"}>{message}</div>}
      <details className="ocr-raw"><summary>{language === "ro" ? "Vezi textul brut citit" : "View raw recognized text"}</summary><pre>{draft.rawText}</pre></details>
      <div className="form-actions"><button className="primary-button" type="submit" disabled={busy}><FileImage/>{duplicate ? (language === "ro" ? "Actualizează jobul" : "Update job") : (language === "ro" ? "Salvează jobul" : "Save job")}</button></div>
    </form>}
  </>;
}
