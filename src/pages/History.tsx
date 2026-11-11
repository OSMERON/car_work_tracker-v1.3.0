import { useMemo, useState, type FormEvent } from "react";
import { Calculator, MapPin, Pencil, Save, Trash2, X } from "lucide-react";
import { Empty, Field, PageHeader, StatusPill, money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { formatDate, mondayOf } from "../lib/date";
import { jobMiles, odometerMiles } from "../lib/analytics";
import { tariffForMiles } from "../lib/rates";
import { calculateDirectRouteMiles } from "../lib/routeMiles";
import type { Job } from "../types";

const optionalNumber = (value: string) => value.trim() === "" ? null : Number(value);
const inputNumber = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);

type EditDraft = Omit<Job, "odometerStart" | "odometerEnd" | "actualMiles" | "estimatedMiles" | "payslipMiles" | "waitingEstimated" | "waitingPaid" | "tariffPaid"> & {
  odometerStart: string;
  odometerEnd: string;
  actualMiles: string;
  estimatedMiles: string;
  payslipMiles: string;
  waitingEstimated: string;
  waitingPaid: string;
  tariffPaid: string;
};

const toDraft = (job: Job): EditDraft => ({
  ...job,
  odometerStart: inputNumber(job.odometerStart),
  odometerEnd: inputNumber(job.odometerEnd),
  actualMiles: inputNumber(job.actualMiles),
  estimatedMiles: inputNumber(job.estimatedMiles),
  payslipMiles: inputNumber(job.payslipMiles),
  waitingEstimated: inputNumber(job.waitingEstimated),
  waitingPaid: inputNumber(job.waitingPaid),
  tariffPaid: inputNumber(job.tariffPaid)
});

export function HistoryPage() {
  const { data, language, removeJob, saveJob } = useData();
  const t = tFor(language);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [message, setMessage] = useState("");
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const jobs = useMemo(() => data.jobs
    .filter(job => status === "all" || job.status === status)
    .filter(job => [job.jobRef, job.registration, job.makeModel, job.pickupTown, job.deliveryTown, job.pickupPostcode, job.deliveryPostcode].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.deliveryDate || b.collectionDate).localeCompare(a.deliveryDate || a.collectionDate)), [data.jobs, search, status]);

  const odometerCalculation = draft ? odometerMiles(optionalNumber(draft.odometerStart), optionalNumber(draft.odometerEnd)) : null;
  const invalidOdometer = Boolean(draft?.odometerStart && draft?.odometerEnd && odometerCalculation === null);
  const previewMiles = draft ? optionalNumber(draft.payslipMiles) ?? optionalNumber(draft.estimatedMiles) ?? 0 : 0;

  const update = (field: keyof EditDraft, value: string | boolean | number | null) => setDraft(current => current ? ({ ...current, [field]: value }) as EditDraft : current);

  const calculateRoute = async () => {
    if (!draft) return;
    setRouteBusy(true);
    setRouteError("");
    try {
      const result = await calculateDirectRouteMiles(draft.pickupPostcode, draft.deliveryPostcode);
      update("estimatedMiles", String(result.miles));
      setMessage(language === "ro" ? `Ruta directă estimată: ${number(result.miles)} mile, aproximativ ${result.minutes} minute.` : `Estimated direct route: ${number(result.miles)} miles, about ${result.minutes} minutes.`);
    } catch {
      setRouteError(language === "ro" ? "Ruta nu a putut fi calculată. Verifică ambele postcode-uri sau introdu milele direct." : "Route could not be calculated. Check both postcodes or enter the miles directly.");
    } finally {
      setRouteBusy(false);
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft || invalidOdometer) return;
    const actualMiles = optionalNumber(draft.actualMiles) ?? odometerCalculation;
    saveJob({
      ...draft,
      registration: draft.registration.toUpperCase().replace(/\s/g, ""),
      payslipRegistration: draft.payslipRegistration.toUpperCase().replace(/\s/g, ""),
      pickupPostcode: draft.pickupPostcode.toUpperCase().replace(/\s/g, ""),
      deliveryPostcode: draft.deliveryPostcode.toUpperCase().replace(/\s/g, ""),
      odometerStart: optionalNumber(draft.odometerStart),
      odometerEnd: optionalNumber(draft.odometerEnd),
      actualMiles,
      estimatedMiles: optionalNumber(draft.estimatedMiles),
      payslipMiles: optionalNumber(draft.payslipMiles),
      waitingEstimated: optionalNumber(draft.waitingEstimated),
      waitingPaid: optionalNumber(draft.waitingPaid),
      tariffPaid: optionalNumber(draft.tariffPaid),
      weekStart: mondayOf(draft.deliveryDate || draft.collectionDate),
      updatedAt: new Date().toISOString()
    });
    setMessage(language === "ro" ? "Mașina a fost actualizată. Rapoartele și performanța au fost recalculate." : "Car updated. Reports and performance were recalculated.");
    setDraft(null);
  };

  return <>
    <PageHeader title={t("history")} subtitle={language === "ro" ? `${data.jobs.length} înregistrări. Poți edita orice mașină livrată și recalcula milele.` : `${data.jobs.length} records. You can edit any delivered car and recalculate its miles.`}/>
    {message && <div className="alert green">{message}</div>}
    <div className="notice-card mileage-method"><Calculator/><div><strong>{language === "ro" ? "Milele plătibile sunt numai între colectare și livrare" : "Payable miles are only from pickup to delivery"}</strong><p>{language === "ro" ? "Milele din PDF au prioritate. Înainte de PDF, aplicația estimează ruta directă din cele două postcode-uri. Drumul până acasă rămâne separat și nu schimbă plata jobului." : "PDF miles take priority. Before the PDF arrives, the app estimates the direct route from both postcodes. Travel home stays separate and does not change job pay."}</p></div></div>
    <div className="filter-bar"><input className="search-input" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("search")}/><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t("all")}</option><option value="collected">{t("collectedStatus")}</option><option value="delivered">{t("deliveredStatus")}</option><option value="cancelled">{t("cancelledStatus")}</option></select></div>
    {!jobs.length ? <Empty>{t("noData")}</Empty> : <div className="history-table">{jobs.map((job, index) => <article key={`${job.id}-${job.jobRef}-${index}`}>
      <div className="history-primary"><span className="reg">{job.registration || job.payslipRegistration || "NO REG"}</span><div><strong>{job.makeModel || job.jobRef || "Car"}</strong><small>{formatDate(job.deliveryDate || job.collectionDate, language)} · {job.jobRef || "No Job Ref"}</small></div></div>
      <div className="history-route"><MapPin size={15}/>{job.pickupTown || job.pickupPostcode || "?"} → {job.deliveryTown || job.deliveryPostcode || "?"}</div>
      <div className="history-mile">{number(jobMiles(job))} mi</div>
      <StatusPill status={job.status}/>
      <div className="row-actions"><button onClick={() => { setDraft(toDraft(job)); setMessage(""); setRouteError(""); }} title={t("edit")}><Pencil size={17}/></button><button onClick={() => { if (confirm(language === "ro" ? "Ștergi această înregistrare?" : "Delete this record?")) removeJob(job.id); }} title={t("delete")}><Trash2 size={17}/></button></div>
      {draft?.id === job.id && <form className="job-edit-panel" onSubmit={save}>
        <div className="job-edit-heading"><div><span className="eyebrow">{language === "ro" ? "EDITARE MAȘINĂ LIVRATĂ" : "EDIT DELIVERED CAR"}</span><h2>{draft.jobRef || draft.registration || draft.makeModel}</h2></div><button className="icon-button" type="button" onClick={() => setDraft(null)} aria-label={language === "ro" ? "Închide" : "Close"}><X/></button></div>
        <div className="job-edit-grid">
          <Field label="Job Ref"><input value={draft.jobRef} onChange={event => update("jobRef", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Înmatriculare" : "Registration"}><input value={draft.registration} onChange={event => update("registration", event.target.value.toUpperCase())}/></Field>
          <Field label={t("makeModel")}><input value={draft.makeModel} onChange={event => update("makeModel", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Stare" : "Status"}><select value={draft.status} onChange={event => update("status", event.target.value)}><option value="collected">{t("collectedStatus")}</option><option value="delivered">{t("deliveredStatus")}</option><option value="cancelled">{t("cancelledStatus")}</option></select></Field>
          <Field label={language === "ro" ? "Data colectării" : "Collection date"}><input type="date" value={draft.collectionDate} onChange={event => update("collectionDate", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Ora colectării" : "Collection time"}><input type="time" value={draft.collectionTime} onChange={event => update("collectionTime", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Data livrării" : "Delivery date"}><input type="date" value={draft.deliveryDate} onChange={event => update("deliveryDate", event.target.value)} required/></Field>
          <Field label={language === "ro" ? "Ora livrării" : "Delivery time"}><input type="time" value={draft.deliveryTime} onChange={event => update("deliveryTime", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Colectare, localitate" : "Pickup town"}><input value={draft.pickupTown} onChange={event => update("pickupTown", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Colectare, postcode" : "Pickup postcode"}><input value={draft.pickupPostcode} onChange={event => update("pickupPostcode", event.target.value.toUpperCase())}/></Field>
          <Field label={language === "ro" ? "Livrare, localitate" : "Delivery town"}><input value={draft.deliveryTown} onChange={event => update("deliveryTown", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Livrare, postcode" : "Delivery postcode"}><input value={draft.deliveryPostcode} onChange={event => update("deliveryPostcode", event.target.value.toUpperCase())}/></Field>
        </div>
        <section className="mileage-editor">
          <div><span className="eyebrow">{language === "ro" ? "MILE PLĂTIBILE" : "PAYABLE MILES"}</span><h3>{language === "ro" ? "Ruta directă de la colectare la livrare" : "Direct route from pickup to delivery"}</h3><p>{language === "ro" ? "PDF-ul rămâne sursa principală. Estimarea după postcode se folosește până primești PDF-ul." : "The PDF remains the primary source. The postcode estimate is used until the PDF arrives."}</p></div>
          <div className="mileage-source-grid"><Field label={language === "ro" ? "Mile din PDF, prioritate 1" : "PDF miles, priority 1"}><input type="number" min="0" step="0.1" value={draft.payslipMiles} onChange={event => update("payslipMiles", event.target.value)}/></Field><Field label={language === "ro" ? "Ruta directă estimată, prioritate 2" : "Estimated direct route, priority 2"}><input type="number" min="0" step="0.1" value={draft.estimatedMiles} onChange={event => update("estimatedMiles", event.target.value)}/></Field><button className="secondary-button route-calculate" type="button" disabled={routeBusy || !draft.pickupPostcode || !draft.deliveryPostcode} onClick={() => void calculateRoute()}><Calculator size={17}/>{routeBusy ? (language === "ro" ? "Se calculează" : "Calculating") : (language === "ro" ? "Calculează din postcode" : "Calculate from postcodes")}</button></div>
          {routeError && <p className="error-message">{routeError}</p>}
          <div className="mileage-result"><div><span>{language === "ro" ? "Mile folosite pentru plată și rapoarte" : "Miles used for pay and reports"}</span><strong>{number(previewMiles)} mi</strong></div><div><span>{language === "ro" ? "Tarif estimat" : "Estimated tariff"}</span><strong>{money(tariffForMiles(previewMiles))}</strong></div></div>
          <div className="personal-mileage"><div><span className="eyebrow">{language === "ro" ? "MILE REALE CONDUSE, SEPARAT" : "ACTUAL DRIVEN MILES, SEPARATE"}</span><p>{language === "ro" ? "Acestea includ eventualul drum acasă. Nu schimbă plata jobului." : "These may include travel home. They do not change job pay."}</p></div><div className="mileage-inputs"><Field label={language === "ro" ? "Kilometraj la colectare" : "Collection odometer"}><input type="number" min="0" step="0.1" value={draft.odometerStart} onChange={event => update("odometerStart", event.target.value)}/></Field><span>−</span><Field label={language === "ro" ? "Kilometraj la final" : "Final odometer"}><input type="number" min="0" step="0.1" value={draft.odometerEnd} onChange={event => update("odometerEnd", event.target.value)}/></Field><span>=</span><strong className={invalidOdometer ? "bad" : ""}>{odometerCalculation === null ? "—" : `${number(odometerCalculation)} mi`}</strong></div><Field label={language === "ro" ? "Mile reale conduse, opțional" : "Actual driven miles, optional"}><input type="number" min="0" step="0.1" value={draft.actualMiles} onChange={event => update("actualMiles", event.target.value)}/></Field>{invalidOdometer && <p className="error-message">{language === "ro" ? "Kilometrajul final trebuie să fie mai mare sau egal cu cel de la colectare." : "Final odometer must be greater than or equal to collection odometer."}</p>}</div>
        </section>
        <div className="job-edit-grid compact-grid"><Field label={language === "ro" ? "Plata jobului" : "Job payment"}><input type="number" step="0.01" value={draft.tariffPaid} onChange={event => update("tariffPaid", event.target.value)}/></Field><Field label={language === "ro" ? "Waiting estimat" : "Estimated waiting"}><input type="number" step="0.01" value={draft.waitingEstimated} onChange={event => update("waitingEstimated", event.target.value)}/></Field><Field label={language === "ro" ? "Waiting plătit" : "Paid waiting"}><input type="number" step="0.01" value={draft.waitingPaid} onChange={event => update("waitingPaid", event.target.value)}/></Field><Field label={language === "ro" ? "Prima livrare înainte de 09:00" : "First delivery before 09:00"}><select value={draft.firstDeliveryBefore9 === null ? "unknown" : draft.firstDeliveryBefore9 ? "yes" : "no"} onChange={event => update("firstDeliveryBefore9", event.target.value === "unknown" ? null : event.target.value === "yes")}><option value="unknown">{language === "ro" ? "Necunoscut" : "Unknown"}</option><option value="yes">{language === "ro" ? "Da" : "Yes"}</option><option value="no">Nu</option></select></Field><Field label={t("notes")} wide><textarea rows={3} value={draft.notes} onChange={event => update("notes", event.target.value)}/></Field></div>
        <div className="job-edit-actions"><button className="secondary-button" type="button" onClick={() => setDraft(null)}><X size={17}/>{language === "ro" ? "Renunță" : "Cancel"}</button><button className="primary-button" disabled={invalidOdometer}><Save size={17}/>{language === "ro" ? "Salvează și recalculează" : "Save and recalculate"}</button></div>
      </form>}
    </article>)}</div>}
  </>;
}
