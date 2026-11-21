import { useState } from "react";
import { PageHeader } from "../components/Ui";
import { ChargingCalculator } from "../components/EnergyCalculators";
import { useData } from "../store/DataContext";
import type { ChargingEntry } from "../types";

export function ElectricVehiclePage() { const { language } = useData(); const [result, setResult] = useState<ChargingEntry>(); return <><PageHeader eyebrow="A.R.I.S. ENERGY" title={language === "ro" ? "Vehicul electric" : "Electric vehicle"} subtitle={language === "ro" ? "Calculează o încărcare fără să o legi de un job. Rezultatul nu se salvează." : "Calculate a charge without linking it to a job. The result is not saved."}/><div className="form-card"><ChargingCalculator language={language} onChange={setResult}/>{result && <div className="calculation-result"><strong>{language === "ro" ? "Rezultat temporar" : "Temporary result"}</strong><span>£{result.totalCost?.toFixed(2) ?? "?"}</span><span>{result.durationMinutes ? `${result.durationMinutes} min` : "? min"}</span><span>{result.averageKw?.toFixed(2) ?? "?"} kW</span><span>{result.tariffPencePerKwh?.toFixed(2) ?? "?"} p/kWh</span></div>}</div></>; }
