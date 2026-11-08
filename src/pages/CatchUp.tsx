import { CheckCircle2, CircleAlert, ListPlus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Field, PageHeader, money, number } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatDate, mondayOf, todayIso } from "../lib/date";
import { tariffForMiles } from "../lib/rates";
import type { Expense, Job } from "../types";

type ExpenseRow = { category: string; actual: string; claimed: string; receipt: boolean };
const blankExpense = (): ExpenseRow => ({ category: "Train", actual: "", claimed: "", receipt: true });
const blankForm = () => ({
  collectionDate: todayIso(), deliveryDate: todayIso(), deliveryTime: "", jobRef: "", registration: "",
  makeModel: "", pickupTown: "", pickupPostcode: "", deliveryTown: "", deliveryPostcode: "",
  actualMiles: "", waiting: "", before9: false, notes: ""
});

export function CatchUp() {
  const { data, language, saveJob, saveExpenses, removeJob, setWeekComplete } = useData();
  const [form, setForm] = useState(blankForm);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([blankExpense()]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const set = (key: string, value: string | boolean) => setForm(previous => ({ ...previous, [key]: value }));
  const weekStart = mondayOf(form.deliveryDate);
  const weekEnd = addDays(weekStart, 6);
  const weekComplete = (data.completedWeeks ?? []).includes(weekStart);
  const weekJobs = useMemo(() => data.jobs.filter(job => job.status === "delivered" && job.weekStart === weekStart).sort((a,b) => a.deliveryDate.localeCompare(b.deliveryDate)), [data.jobs, weekStart]);
  const weekMiles = weekJobs.reduce((sum, job) => sum + (job.actualMiles ?? job.estimatedMiles ?? 0), 0);

  const toggleWeekComplete = () => {
    setError("");
    if (!weekComplete && weekJobs.length === 0) {
      setError(language === "ro" ? "Adaugă cel puțin un job înainte să confirmi săptămâna." : "Add at least one job before confirming the week.");
      return;
    }
    setWeekComplete(weekStart, !weekComplete);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (!form.jobRef.trim() || !form.collectionDate || !form.deliveryDate || !form.pickupTown.trim() || !form.deliveryTown.trim()) {
      setError(language === "ro" ? "Completează Job Ref, datele și ambele orașe." : "Complete Job Ref, dates and both towns."); return;
    }
    const duplicate = data.jobs.find(job => job.jobRef && job.jobRef === form.jobRef.trim());
    const now = new Date().toISOString();
    const miles = form.actualMiles ? Number(form.actualMiles) : null;
    const job: Job = {
      id: duplicate?.id ?? crypto.randomUUID(), jobRef: form.jobRef.trim(), status: "delivered",
      collectionDate: form.collectionDate, collectionTime: duplicate?.collectionTime ?? "",
      deliveryDate: form.deliveryDate, deliveryTime: form.deliveryTime,
      makeModel: form.makeModel || duplicate?.makeModel || "", carType: duplicate?.carType ?? "",
      registration: form.registration.toUpperCase().replace(/\s/g, ""), payslipRegistration: duplicate?.payslipRegistration ?? "",
      customerType: duplicate?.customerType ?? "", pickupTown: form.pickupTown,
      pickupPostcode: form.pickupPostcode.toUpperCase().replace(/\s/g, ""), deliveryTown: form.deliveryTown,
      deliveryPostcode: form.deliveryPostcode.toUpperCase().replace(/\s/g, ""),
      odometerStart: duplicate?.odometerStart ?? null, odometerEnd: duplicate?.odometerEnd ?? null,
      estimatedMiles: duplicate?.estimatedMiles ?? miles, actualMiles: miles, payslipMiles: duplicate?.payslipMiles ?? null,
      waitingEstimated: form.waiting ? Number(form.waiting) : 0, waitingPaid: duplicate?.waitingPaid ?? null,
      tariffPaid: duplicate?.tariffPaid ?? null, firstDeliveryBefore9: form.before9,
      deliveryOrder: duplicate?.deliveryOrder ?? null, weekStart,
      notes: form.notes, source: "manual", createdAt: duplicate?.createdAt ?? now, updatedAt: now
    };
    saveJob(job);
    const expenses: Expense[] = expenseRows.filter(row => row.actual || row.claimed).map(row => ({
      id: crypto.randomUUID(), jobRef: job.jobRef, date: form.deliveryDate, weekStart,
      category: row.category, description: row.category, actualCost: Number(row.actual) || 0,
      claimed: Number(row.claimed) || 0, approved: 0, receipt: row.receipt, notes: "Catch-up entry", source: "manual"
    }));
    if (expenses.length) saveExpenses(expenses);
    setWeekComplete(weekStart, false);
    setForm(previous => ({ ...blankForm(), collectionDate: previous.deliveryDate, deliveryDate: previous.deliveryDate }));
    setExpenseRows([blankExpense()]);
    setMessage(language === "ro" ? `Jobul ${job.jobRef} a fost salvat. Săptămâna rămâne incompletă până o confirmi.` : `Job ${job.jobRef} was saved. The week stays incomplete until you confirm it.`);
  };

  return <>
    <PageHeader eyebrow={language === "ro" ? "Introducere rapidă" : "Quick entry"} title={language === "ro" ? "Recuperează joburile terminate" : "Catch up completed jobs"} subtitle={language === "ro" ? "Adaugă fiecare job într-un singur formular. Job Ref este obligatoriu. Numărul de înmatriculare este opțional." : "Add each completed job in one form. Job Ref is required. Registration is optional."}/>
    <section className={`week-status ${weekComplete ? "complete" : "incomplete"}`}>
      {weekComplete ? <CheckCircle2/> : <CircleAlert/>}
      <div><strong>{language === "ro" ? `Săptămâna ${formatDate(weekStart, language)} până la ${formatDate(weekEnd, language)}` : `Week ${formatDate(weekStart, language)} to ${formatDate(weekEnd, language)}`}</strong><span>{weekComplete ? (language === "ro" ? "Confirmată completă. Comparația de plată este activă." : "Confirmed complete. Pay comparison is active.") : (language === "ro" ? "Incompletă. Aplicația nu afișează pierderi sau diferențe personale." : "Incomplete. The app hides personal loss and difference figures.")}</span></div>
      <button className={weekComplete ? "secondary-button" : "primary-button"} type="button" onClick={toggleWeekComplete}>{weekComplete ? (language === "ro" ? "Marchează incompletă" : "Mark incomplete") : (language === "ro" ? "Confirmă săptămâna completă" : "Confirm week complete")}</button>
    </section>
    <div className="catch-up-layout">
      <form className="form-card" onSubmit={submit}>
        <div className="form-grid">
          <Field label={language === "ro" ? "Data colectării *" : "Collection date *"}><input type="date" value={form.collectionDate} onChange={event => set("collectionDate", event.target.value)} required/></Field>
          <Field label={language === "ro" ? "Data livrării *" : "Delivery date *"}><input type="date" value={form.deliveryDate} onChange={event => set("deliveryDate", event.target.value)} required/></Field>
          <Field label="Job Ref *"><input value={form.jobRef} onChange={event => set("jobRef", event.target.value)} placeholder="26101234" required/></Field>
          <Field label={language === "ro" ? "Înmatriculare, opțional" : "Registration, optional"}><input value={form.registration} onChange={event => set("registration", event.target.value)} placeholder={language === "ro" ? "Lasă gol dacă nu o ai" : "Leave blank if unavailable"}/></Field>
          <Field label={language === "ro" ? "Oraș pickup *" : "Pickup town *"}><input value={form.pickupTown} onChange={event => set("pickupTown", event.target.value)} required/></Field>
          <Field label={language === "ro" ? "Postcode pickup" : "Pickup postcode"}><input value={form.pickupPostcode} onChange={event => set("pickupPostcode", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Oraș livrare *" : "Delivery town *"}><input value={form.deliveryTown} onChange={event => set("deliveryTown", event.target.value)} required/></Field>
          <Field label={language === "ro" ? "Postcode livrare" : "Delivery postcode"}><input value={form.deliveryPostcode} onChange={event => set("deliveryPostcode", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Mile efective" : "Actual miles"}><input type="number" min="0" step="0.1" value={form.actualMiles} onChange={event => set("actualMiles", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Ora livrării" : "Delivery time"}><input type="time" value={form.deliveryTime} onChange={event => set("deliveryTime", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Waiting time £" : "Waiting time £"}><input type="number" min="0" step="0.01" value={form.waiting} onChange={event => set("waiting", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Prima livrare înainte de 09:00" : "First delivery before 09:00"}><label className="check"><input type="checkbox" checked={form.before9} onChange={event => set("before9", event.target.checked)}/><span>{language === "ro" ? "Da" : "Yes"}</span></label></Field>
          <Field label={language === "ro" ? "Marcă și model, opțional" : "Make and model, optional"}><input value={form.makeModel} onChange={event => set("makeModel", event.target.value)}/></Field>
          <Field label={language === "ro" ? "Observații" : "Notes"} wide><textarea rows={2} value={form.notes} onChange={event => set("notes", event.target.value)}/></Field>
        </div>
        {form.actualMiles && <div className="calculation-note">{language === "ro" ? "Tarif estimat după mile" : "Estimated mileage tariff"}: <strong>{money(tariffForMiles(Number(form.actualMiles)))}</strong></div>}
        <div className="section-title compact"><h2>{language === "ro" ? "Cheltuieli și chitanțe" : "Expenses and receipts"}</h2><button className="secondary-button" type="button" onClick={() => setExpenseRows(rows => [...rows, blankExpense()])}>+ {language === "ro" ? "Cheltuială" : "Expense"}</button></div>
        {expenseRows.map((row, index) => <div className="expense-row" key={index}>
          <select value={row.category} onChange={event => setExpenseRows(rows => rows.map((item, itemIndex) => itemIndex === index ? {...item, category:event.target.value} : item))}><option>Train</option><option>Bus</option><option>Taxi</option><option>Fuel</option><option>Parking</option><option>Misc</option></select>
          <input type="number" min="0" step="0.01" placeholder={language === "ro" ? "Cost real £" : "Actual cost £"} value={row.actual} onChange={event => setExpenseRows(rows => rows.map((item, itemIndex) => itemIndex === index ? {...item, actual:event.target.value} : item))}/>
          <input type="number" min="0" step="0.01" placeholder={language === "ro" ? "Cerut £" : "Claimed £"} value={row.claimed} onChange={event => setExpenseRows(rows => rows.map((item, itemIndex) => itemIndex === index ? {...item, claimed:event.target.value} : item))}/>
          <label className="check small"><input type="checkbox" checked={row.receipt} onChange={event => setExpenseRows(rows => rows.map((item, itemIndex) => itemIndex === index ? {...item, receipt:event.target.checked} : item))}/>{language === "ro" ? "Chitanță" : "Receipt"}</label>
          {expenseRows.length > 1 && <button className="icon-button" type="button" onClick={() => setExpenseRows(rows => rows.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
        </div>)}
        {error && <p className="error-message">{error}</p>}{message && <p className="success-message">{message}</p>}
        <div className="form-actions"><button className="primary-button" type="submit"><ListPlus size={18}/>{language === "ro" ? "Salvează jobul terminat" : "Save completed job"}</button></div>
      </form>
      <aside className="catch-up-summary"><h2>{language === "ro" ? "Joburile săptămânii" : "Week jobs"}</h2><div className="catch-up-totals"><strong>{weekJobs.length}</strong><span>{language === "ro" ? "joburi" : "jobs"}</span><strong>{number(weekMiles)}</strong><span>{language === "ro" ? "mile" : "miles"}</span></div>{weekJobs.length === 0 ? <p>{language === "ro" ? "Nu ai introdus încă niciun job pentru această săptămână." : "No jobs entered for this week yet."}</p> : <div className="mini-job-list">{weekJobs.map(job => <div key={job.id}><span><strong>{job.jobRef}</strong><small>{job.pickupTown} → {job.deliveryTown}</small></span><span>{number(job.actualMiles ?? job.estimatedMiles ?? 0)} mi<button type="button" onClick={() => { if (confirm(language === "ro" ? `Ștergi jobul ${job.jobRef}?` : `Delete job ${job.jobRef}?`)) { removeJob(job.id); setWeekComplete(weekStart, false); } }}><Trash2 size={15}/></button></span></div>)}</div>}</aside>
    </div>
  </>;
}
