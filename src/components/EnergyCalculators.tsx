import { useEffect, useState } from "react";
import { Field } from "./Ui";
import type { ChargingEntry, FuelEntry, Language, PaymentSource } from "../types";

const value = (text: string) => text === "" || !Number.isFinite(Number(text)) ? null : Number(text);
const display = (amount: number) => String(Math.round(amount * 100) / 100);

export function ChargingCalculator({ language, initial, onChange }: { language: Language; initial?: ChargingEntry; onChange: (entry: ChargingEntry | undefined) => void }) {
  const [form, setForm] = useState({ cost: initial?.totalCost?.toString() ?? "", hours: initial?.durationMinutes ? String(Math.floor(initial.durationMinutes / 60)) : "", minutes: initial?.durationMinutes ? String(initial.durationMinutes % 60) : "", kw: initial?.averageKw?.toString() ?? "", tariff: initial?.tariffPencePerKwh?.toString() ?? "", payer: initial?.payer ?? "self" as PaymentSource });
  const [message, setMessage] = useState("");
  const entry = (): ChargingEntry => ({ totalCost: value(form.cost), durationMinutes: (value(form.hours) ?? 0) * 60 + (value(form.minutes) ?? 0), averageKw: value(form.kw), tariffPencePerKwh: value(form.tariff), payer: form.payer });
  useEffect(() => { const item = entry(); onChange(Object.values(item).some(itemValue => typeof itemValue === "number" && itemValue > 0) ? item : undefined); }, [form]);
  const calculate = () => {
    const cost = value(form.cost), duration = ((value(form.hours) ?? 0) * 60 + (value(form.minutes) ?? 0)) / 60, kw = value(form.kw), tariff = value(form.tariff);
    const known = [cost, duration || null, kw, tariff].filter(item => item != null && item > 0).length;
    if (known < 3) { setMessage(language === "ro" ? "Introdu încă o valoare pentru calcul." : "Enter one more value for the calculation."); return; }
    const next = { ...form };
    if (cost == null && duration && kw && tariff) next.cost = display(duration * kw * tariff / 100);
    else if (!duration && cost && kw && tariff) { const totalMinutes = cost / (kw * tariff / 100) * 60; next.hours = String(Math.floor(totalMinutes / 60)); next.minutes = display(totalMinutes % 60); }
    else if (kw == null && cost && duration && tariff) next.kw = display(cost / duration / (tariff / 100));
    else if (tariff == null && cost && duration && kw) next.tariff = display(cost / (duration * kw) * 100);
    else setMessage(language === "ro" ? "Toate valorile sunt deja completate." : "All values are already filled in.");
    setForm(next); setMessage(language === "ro" ? "Calcul finalizat." : "Calculation complete.");
  };
  const set = (key: keyof typeof form, next: string) => setForm(current => ({ ...current, [key]: next }));
  return <section className="energy-calculator"><h3>{language === "ro" ? "Încărcare electrică" : "Electric charging"}</h3><p>{language === "ro" ? "Completează trei valori. A.R.I.S. o calculează pe a patra." : "Enter three values. A.R.I.S. calculates the fourth."}</p><div className="form-grid">
    <Field label={language === "ro" ? "Cost total (£)" : "Total cost (£)"}><input type="number" min="0" step="0.01" value={form.cost} onChange={event => set("cost", event.target.value)}/></Field>
    <Field label={language === "ro" ? "Durată, ore" : "Duration, hours"}><input type="number" min="0" step="1" value={form.hours} onChange={event => set("hours", event.target.value)}/></Field>
    <Field label={language === "ro" ? "Durată, minute" : "Duration, minutes"}><input type="number" min="0" max="59" step="1" value={form.minutes} onChange={event => set("minutes", event.target.value)}/></Field>
    <Field label={language === "ro" ? "Viteză medie (kW)" : "Average speed (kW)"}><input type="number" min="0" step="0.01" value={form.kw} onChange={event => set("kw", event.target.value)}/></Field>
    <Field label={language === "ro" ? "Tarif (p/kWh)" : "Tariff (p/kWh)"}><input type="number" min="0" step="0.01" value={form.tariff} onChange={event => set("tariff", event.target.value)}/></Field>
    <Field label={language === "ro" ? "Plătitor" : "Payer"}><select value={form.payer} onChange={event => setForm(current => ({ ...current, payer: event.target.value as PaymentSource }))}><option value="self">{language === "ro" ? "Plătit de mine" : "Paid by me"}</option><option value="company">{language === "ro" ? "Companie / Fuel card" : "Company / Fuel card"}</option></select></Field>
  </div><button type="button" className="secondary-button" onClick={calculate}>{language === "ro" ? "Calculează" : "Calculate"}</button>{message && <p className="calculation-note">{message}</p>}</section>;
}

export function FuelCalculator({ language, initial, onChange }: { language: Language; initial?: FuelEntry; onChange: (entry: FuelEntry | undefined) => void }) {
  const [form, setForm] = useState({ litres: initial?.litres?.toString() ?? "", cost: initial?.totalCost?.toString() ?? "", price: initial?.pricePerLitre?.toString() ?? "", payer: initial?.payer ?? "self" as PaymentSource });
  const [message, setMessage] = useState("");
  useEffect(() => { const result: FuelEntry = { litres: value(form.litres), totalCost: value(form.cost), pricePerLitre: value(form.price), payer: form.payer }; onChange([result.litres, result.totalCost, result.pricePerLitre].some(item => item != null && item > 0) ? result : undefined); }, [form]);
  const calculate = () => {
    const litres = value(form.litres), cost = value(form.cost), price = value(form.price); const known = [litres, cost, price].filter(item => item != null && item > 0).length;
    if (known < 2) { setMessage(language === "ro" ? "Introdu încă o valoare pentru calcul." : "Enter one more value for the calculation."); return; }
    const next = { ...form };
    if (litres == null && cost && price) next.litres = display(cost / price); else if (cost == null && litres && price) next.cost = display(litres * price); else if (price == null && litres && cost) next.price = display(cost / litres);
    setForm(next); setMessage(language === "ro" ? "Calcul finalizat." : "Calculation complete.");
  };
  return <section className="energy-calculator"><h3>{language === "ro" ? "Alimentare combustibil" : "Fuel fill-up"}</h3><p>{language === "ro" ? "Completează două valori. A.R.I.S. o calculează pe a treia." : "Enter two values. A.R.I.S. calculates the third."}</p><div className="form-grid">
    <Field label={language === "ro" ? "Cantitate (litri)" : "Quantity (litres)"}><input type="number" min="0" step="0.01" value={form.litres} onChange={event => setForm(current => ({ ...current, litres: event.target.value }))}/></Field>
    <Field label={language === "ro" ? "Cost total (£)" : "Total cost (£)"}><input type="number" min="0" step="0.01" value={form.cost} onChange={event => setForm(current => ({ ...current, cost: event.target.value }))}/></Field>
    <Field label={language === "ro" ? "Preț pe litru (£)" : "Price per litre (£)"}><input type="number" min="0" step="0.001" value={form.price} onChange={event => setForm(current => ({ ...current, price: event.target.value }))}/></Field>
    <Field label={language === "ro" ? "Plătitor" : "Payer"}><select value={form.payer} onChange={event => setForm(current => ({ ...current, payer: event.target.value as PaymentSource }))}><option value="self">{language === "ro" ? "Plătit de mine" : "Paid by me"}</option><option value="company">{language === "ro" ? "Companie / Fuel card" : "Company / Fuel card"}</option></select></Field>
  </div><button type="button" className="secondary-button" onClick={calculate}>{language === "ro" ? "Calculează" : "Calculate"}</button>{message && <p className="calculation-note">{message}</p>}</section>;
}
