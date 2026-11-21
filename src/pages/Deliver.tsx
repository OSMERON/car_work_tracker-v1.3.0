import { useMemo, useState, type FormEvent } from "react";
import { Calculator } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Field, PageHeader, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { mondayOf, todayIso } from "../lib/date";
import type { Expense, Job } from "../types";
import { tariffForMiles } from "../lib/rates";
import { odometerMiles } from "../lib/analytics";
import { calculateDirectRouteMiles } from "../lib/routeMiles";
import { jobRegistrations } from "../lib/jobProtocols";
import { ChargingCalculator, FuelCalculator } from "../components/EnergyCalculators";
import type { ChargingEntry, FuelEntry } from "../types";
import { calculateConsumption } from "../lib/consumption";

type Row = { category: string; amount: string; claimed: string; receipt: boolean; hasTicket: boolean; rasCode: string; notes: string };
const blank = (): Row => ({ category: "Train", amount: "", claimed: "", receipt: false, hasTicket: false, rasCode: "", notes: "" });

export function Deliver() {
  const { data, saveJob, saveExpenses, language } = useData();
  const t = tFor(language);
  const navigate = useNavigate();
  const active = data.jobs.filter(job => job.status === "collected").sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
  const [jobId, setJobId] = useState(active[0]?.id || "");
  const job = active.find(item => item.id === jobId);
  const [rows, setRows] = useState<Row[]>([blank()]);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeInfo, setRouteInfo] = useState("");
  const [form, setForm] = useState({ date: todayIso(), time: "", deliveryTown: "", deliveryPostcode: "", odometerEnd: "", rangeEnd: "", routeMiles: "", actualDrivenMiles: "", waiting: "", before9: false, notes: "" });
  const [chargingEntry, setChargingEntry] = useState<ChargingEntry | undefined>();
  const [fuelEntry, setFuelEntry] = useState<FuelEntry | undefined>();

  const deliveryPostcode = form.deliveryPostcode || job?.deliveryPostcode || "";
  const odometerCalculation = useMemo(() => odometerMiles(job?.odometerStart, form.odometerEnd ? Number(form.odometerEnd) : null), [form.odometerEnd, job?.odometerStart]);
  const payableMiles = useMemo(() => form.routeMiles ? Number(form.routeMiles) : job?.payslipMiles ?? job?.estimatedMiles ?? 0, [form.routeMiles, job]);
  const actualDrivenMiles = form.actualDrivenMiles ? Number(form.actualDrivenMiles) : odometerCalculation;
  const set = (key: keyof typeof form, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }));

  const calculateRoute = async () => {
    if (!job) return;
    setRouteBusy(true);
    setRouteError("");
    setRouteInfo("");
    try {
      const result = await calculateDirectRouteMiles(job.pickupPostcode, deliveryPostcode);
      set("routeMiles", String(result.miles));
      setRouteInfo(language === "ro" ? `${number(result.miles)} mile, aproximativ ${result.minutes} minute.` : `${number(result.miles)} miles, about ${result.minutes} minutes.`);
    } catch {
      setRouteError(language === "ro" ? "Ruta nu a putut fi calculată. Verifică postcode-urile sau introdu milele direct." : "Route could not be calculated. Check the postcodes or enter the miles directly.");
    } finally {
      setRouteBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!job) return;
    const now = new Date().toISOString();
    const savedJob: Job = {
      ...job,
      status: "delivered",
      deliveryDate: form.date,
      deliveryTime: form.time,
      deliveryTown: form.deliveryTown || job.deliveryTown,
      deliveryPostcode: deliveryPostcode.toUpperCase().replace(/\s/g, ""),
      odometerEnd: form.odometerEnd ? Number(form.odometerEnd) : null,
      rangeEnd: form.rangeEnd ? Number(form.rangeEnd) : null,
      actualMiles: actualDrivenMiles,
      estimatedMiles: form.routeMiles ? Number(form.routeMiles) : job.estimatedMiles,
      waitingEstimated: form.waiting ? Number(form.waiting) : 0,
      tariffPaid: tariffForMiles(payableMiles),
      firstDeliveryBefore9: form.before9,
      weekStart: mondayOf(form.date),
      notes: [job.notes, form.notes].filter(Boolean).join(" | "),
      chargingEntry,
      fuelEntry,
      updatedAt: now
    };
    saveJob(savedJob);
    const expenses: Expense[] = rows.filter(row => row.amount || row.claimed).map(row => ({
      id: crypto.randomUUID(),
      jobRef: job.jobRef,
      date: form.date,
      weekStart: mondayOf(form.date),
      category: row.category,
      description: row.category,
      actualCost: Number(row.amount) || 0,
      claimed: Number(row.claimed) || 0,
      approved: 0,
      receipt: row.receipt,
      hasTicket: row.hasTicket,
      rasCode: row.rasCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      reimbursementStatus: "review",
      notes: row.notes,
      source: "manual"
    }));
    if (chargingEntry?.payer === "self" && chargingEntry.totalCost) expenses.push({ id: crypto.randomUUID(), jobRef: job.jobRef, date: form.date, weekStart: mondayOf(form.date), category: "Electric charging", description: "Electric charging", actualCost: chargingEntry.totalCost, claimed: 0, approved: 0, receipt: false, notes: "Created automatically by A.R.I.S.", source: "manual" });
    if (fuelEntry?.payer === "self" && fuelEntry.totalCost) expenses.push({ id: crypto.randomUUID(), jobRef: job.jobRef, date: form.date, weekStart: mondayOf(form.date), category: "Fuel", description: "Fuel", actualCost: fuelEntry.totalCost, claimed: 0, approved: 0, receipt: false, notes: "Created automatically by A.R.I.S.", source: "manual" });
    if (expenses.length) saveExpenses(expenses);
    navigate("/");
  };

  if (!active.length) return <><PageHeader title={t("completeDelivery")}/><div className="empty">{language === "ro" ? "Nu există mașini colectate care așteaptă livrarea." : "No collected cars are waiting for delivery."}</div></>;

  return <><PageHeader eyebrow={language === "ro" ? "Etapa 2 din 2" : "Stage 2 of 2"} title={t("completeDelivery")} subtitle={language === "ro" ? "Milele plătibile folosesc numai ruta directă dintre colectare și livrare." : "Payable miles use only the direct route from pickup to delivery."}/>
    <form className="form-card" onSubmit={submit}>
      <Field label={t("activeCars")} wide><select value={jobId} onChange={event => { setJobId(event.target.value); setRouteError(""); setRouteInfo(""); set("routeMiles", ""); }}>{active.map(item => <option key={item.id} value={item.id}>{jobRegistrations(item, true).join(" / ") || "NO REG"} · {item.makeModel || item.jobRef} · {item.pickupTown || (item.protocol === "autorola" ? "CLASSIFIED" : "?")} → {item.deliveryTown || (item.protocol === "autorola" ? "CLASSIFIED" : "?")}</option>)}</select></Field>
      <div className="form-grid">
        <Field label={t("date")}><input type="date" value={form.date} onChange={event => set("date", event.target.value)} required/></Field>
        <Field label={t("time")}><input type="time" value={form.time} onChange={event => set("time", event.target.value)}/></Field>
        <Field label={t("town")}><input value={form.deliveryTown} placeholder={job?.deliveryTown} onChange={event => set("deliveryTown", event.target.value)}/></Field>
        <Field label={t("postcode")}><input value={form.deliveryPostcode} placeholder={job?.deliveryPostcode} onChange={event => set("deliveryPostcode", event.target.value.toUpperCase())}/></Field>
      </div>

      <section className="delivery-mileage-card">
        <div><span className="eyebrow">{language === "ro" ? "MILE PLĂTIBILE" : "PAYABLE MILES"}</span><h3>{language === "ro" ? "Colectare → livrare" : "Pickup → delivery"}</h3><p>{language === "ro" ? "Nu include drumul până acasă. PDF-ul va înlocui estimarea când îl încarci." : "Does not include travel home. The PDF replaces the estimate after upload."}</p></div>
        <div className="route-entry"><Field label={language === "ro" ? "Mile rută directă" : "Direct route miles"}><input type="number" min="0" step="0.1" value={form.routeMiles} placeholder={String(job?.payslipMiles ?? job?.estimatedMiles ?? "")} onChange={event => set("routeMiles", event.target.value)}/></Field><button className="secondary-button" type="button" disabled={routeBusy || !job?.pickupPostcode || !deliveryPostcode} onClick={() => void calculateRoute()}><Calculator size={17}/>{routeBusy ? (language === "ro" ? "Se calculează" : "Calculating") : (language === "ro" ? "Calculează din postcode" : "Calculate from postcodes")}</button></div>
        {routeInfo && <p className="good">{routeInfo}</p>}{routeError && <p className="error-message">{routeError}</p>}
        <div className="calculation-note">{language === "ro" ? "Tarif estimat pentru ruta directă" : "Estimated tariff for direct route"}: <strong>£{tariffForMiles(payableMiles).toFixed(2)}</strong> · {payableMiles.toFixed(1)} mi</div>
      </section>

      <section className="personal-mileage delivery-personal-mileage"><div><span className="eyebrow">{language === "ro" ? "DISTANȚĂ REALĂ, OPȚIONAL" : "ACTUAL DISTANCE, OPTIONAL"}</span><p>{language === "ro" ? "Pentru costurile tale. Nu schimbă tariful jobului." : "For your own costs. It does not change the job tariff."}</p></div><div className="form-grid"><Field label={`${t("odometerEnd")} (${language === "ro" ? "mile" : "miles"})`}><input type="number" step="0.1" value={form.odometerEnd} onChange={event => set("odometerEnd", event.target.value)}/></Field><Field label={language === "ro" ? "Mile reale conduse" : "Actual driven miles"}><input type="number" min="0" step="0.1" value={form.actualDrivenMiles} placeholder={odometerCalculation === null ? "" : String(odometerCalculation)} onChange={event => set("actualDrivenMiles", event.target.value)}/></Field><Field label={language === "ro" ? "Range la livrare (mile)" : "Delivery range (miles)"}><input type="number" min="0" step="0.1" value={form.rangeEnd} onChange={event => set("rangeEnd", event.target.value)}/></Field></div>
      {job && (() => { const preview = calculateConsumption({ ...job, odometerEnd: form.odometerEnd ? Number(form.odometerEnd) : null, actualMiles: actualDrivenMiles, rangeEnd: form.rangeEnd ? Number(form.rangeEnd) : null }); return preview ? <p className="calculation-note">{preview.rangeIncreased ? (language === "ro" ? "Range crescut" : "Range increased") : `${language === "ro" ? "Consum range" : "Range used"}: ${preview.rangeUsed.toFixed(1)} mi · ${language === "ro" ? "Eficiență" : "Efficiency"}: ${preview.efficiency.toFixed(1)}%`}</p> : <p className="calculation-note">{language === "ro" ? "Completează ambele valori pentru calculul consumului." : "Complete both values to calculate consumption."}</p>; })()}</section>

      {(job?.vehicleType === "electric" || job?.vehicleType === "hybrid") && <ChargingCalculator key={`charge-${job.id}`} language={language} initial={job.chargingEntry} onChange={setChargingEntry}/>} 
      {(job?.vehicleType === "petrol" || job?.vehicleType === "diesel" || job?.vehicleType === "hybrid") && <FuelCalculator key={`fuel-${job.id}`} language={language} initial={job.fuelEntry} onChange={setFuelEntry}/>} 

      <div className="form-grid"><Field label={t("waitingAmount")}><input type="number" step="0.01" value={form.waiting} onChange={event => set("waiting", event.target.value)}/></Field><Field label={t("before9")}><label className="check"><input type="checkbox" checked={form.before9} onChange={event => set("before9", event.target.checked)}/><span>{language === "ro" ? "Da" : "Yes"}</span></label></Field></div>
      <div className="section-title compact"><h2>{t("expenses")}</h2><button type="button" className="secondary-button" onClick={() => setRows(current => [...current, blank()])}>+ {t("addExpense")}</button></div>
      {rows.map((row, index) => <div className="expense-row" key={index}><select value={row.category} onChange={event => setRows(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, category: event.target.value } : item))}><option>Train</option><option>Bus</option><option>Taxi</option><option>Parking</option><option>Misc</option></select><input type="number" step="0.01" placeholder={t("amount")} value={row.amount} onChange={event => setRows(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, amount: event.target.value } : item))}/><input type="number" step="0.01" placeholder={t("claimed")} value={row.claimed} onChange={event => setRows(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, claimed: event.target.value } : item))}/>{row.category === "Taxi" ? <input aria-label="RAS code" placeholder={language === "ro" ? "Cod RAS" : "RAS code"} value={row.rasCode} onChange={event => setRows(current => current.map((item,rowIndex)=>rowIndex===index?{...item,rasCode:event.target.value.replace(/[^A-Za-z0-9]/g,"").toUpperCase()}:item))}/> : row.category === "Bus" || row.category === "Train" ? <label className="check small"><input type="checkbox" checked={row.hasTicket} onChange={event=>setRows(current=>current.map((item,rowIndex)=>rowIndex===index?{...item,hasTicket:event.target.checked}:item))}/>{language === "ro" ? "Am biletul" : "I have the ticket"}</label> : <label className="check small"><input type="checkbox" checked={row.receipt} onChange={event => setRows(current => current.map((item, rowIndex) => rowIndex === index ? { ...item, receipt: event.target.checked } : item))}/>{language === "ro" ? "Am chitanța" : "I have the receipt"}</label>}{rows.length > 1 && <button className="icon-button" type="button" onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}>×</button>}</div>)}
      <Field label={t("notes")} wide><textarea rows={3} value={form.notes} onChange={event => set("notes", event.target.value)}/></Field>
      <div className="form-actions"><button className="primary-button" type="submit">{t("saveDelivery")}</button></div>
    </form>
  </>;
}
