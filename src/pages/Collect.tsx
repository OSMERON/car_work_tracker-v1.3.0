import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Field, PageHeader } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { mondayOf, todayIso } from "../lib/date";
import type { Job } from "../types";

export function Collect() {
  const { saveJob, language } = useData();
  const t = tFor(language);
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    date: todayIso(), time: "", jobRef: "", registration: "", makeModel: "", carType: "",
    customerType: "", pickupTown: "", pickupPostcode: "", deliveryTown: "",
    deliveryPostcode: "", odometerStart: "", estimatedMiles: "", notes: ""
  });
  const set = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.date || !form.jobRef || !form.pickupTown) { setMessage(t("required")); return; }
    const now = new Date().toISOString();
    const job: Job = {
      id: crypto.randomUUID(), jobRef: form.jobRef.trim(), status: "collected",
      collectionDate: form.date, collectionTime: form.time, deliveryDate: "", deliveryTime: "",
      makeModel: form.makeModel, carType: form.carType,
      registration: form.registration.toUpperCase().replace(/\s/g, ""), payslipRegistration: "",
      customerType: form.customerType, pickupTown: form.pickupTown,
      pickupPostcode: form.pickupPostcode.toUpperCase().replace(/\s/g, ""),
      deliveryTown: form.deliveryTown,
      deliveryPostcode: form.deliveryPostcode.toUpperCase().replace(/\s/g, ""),
      odometerStart: form.odometerStart ? Number(form.odometerStart) : null, odometerEnd: null,
      estimatedMiles: form.estimatedMiles ? Number(form.estimatedMiles) : null,
      actualMiles: null, payslipMiles: null, waitingEstimated: null, waitingPaid: null,
      tariffPaid: null, firstDeliveryBefore9: null, deliveryOrder: null,
      weekStart: mondayOf(form.date), notes: form.notes, source: "manual",
      createdAt: now, updatedAt: now
    };
    saveJob(job);
    navigate("/");
  };

  return <>
    <PageHeader eyebrow={language === "ro" ? "Etapa 1 din 2" : "Stage 1 of 2"} title={t("newCollection")} subtitle={language === "ro" ? "Înregistrează detaliile pe care le știi acum. Le completezi la livrare." : "Record what you know now. Finish the details at delivery."}/>
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <Field label={t("date")}><input type="date" value={form.date} onChange={event => set("date", event.target.value)} required/></Field>
        <Field label={t("time")}><input type="time" value={form.time} onChange={event => set("time", event.target.value)}/></Field>
        <Field label={`${t("jobRef")} *`}><input value={form.jobRef} onChange={event => set("jobRef", event.target.value)} placeholder="26081234" required/></Field>
        <Field label={`${t("registration")} (${language === "ro" ? "opțional" : "optional"})`}><input value={form.registration} onChange={event => set("registration", event.target.value)} placeholder="AB12CDE"/></Field>
        <Field label={t("makeModel")}><input value={form.makeModel} onChange={event => set("makeModel", event.target.value)} placeholder="BMW X3"/></Field>
        <Field label={t("carType")}><input value={form.carType} onChange={event => set("carType", event.target.value)} placeholder="SUV / EV / Van"/></Field>
        <Field label={t("customerType")}><select value={form.customerType} onChange={event => set("customerType", event.target.value)}><option value="">—</option><option>DEALER</option><option>CLIENT</option><option>BUYER</option><option>AUCTION</option></select></Field>
        <Field label={t("odometerStart")}><input type="number" step="0.1" value={form.odometerStart} onChange={event => set("odometerStart", event.target.value)}/></Field>
      </div>
      <h2 className="form-section-title">{t("pickup")}</h2>
      <div className="form-grid">
        <Field label={`${t("town")} *`}><input value={form.pickupTown} onChange={event => set("pickupTown", event.target.value)} required/></Field>
        <Field label={t("postcode")}><input value={form.pickupPostcode} onChange={event => set("pickupPostcode", event.target.value)}/></Field>
      </div>
      <h2 className="form-section-title">{t("destination")}</h2>
      <div className="form-grid">
        <Field label={t("town")}><input value={form.deliveryTown} onChange={event => set("deliveryTown", event.target.value)}/></Field>
        <Field label={t("postcode")}><input value={form.deliveryPostcode} onChange={event => set("deliveryPostcode", event.target.value)}/></Field>
        <Field label={t("estimatedMiles")}><input type="number" step="0.1" value={form.estimatedMiles} onChange={event => set("estimatedMiles", event.target.value)}/></Field>
        <Field label={t("notes")} wide><textarea rows={3} value={form.notes} onChange={event => set("notes", event.target.value)}/></Field>
      </div>
      {message && <p className="error-message">{message}</p>}
      <div className="form-actions"><button className="primary-button" type="submit">{t("saveCollection")}</button></div>
    </form>
  </>;
}
