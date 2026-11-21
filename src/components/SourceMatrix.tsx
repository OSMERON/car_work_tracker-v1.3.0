import { Database, FileSearch2, Layers3, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { money, number } from "./Ui";
import type { SourceTotal, SourceTotals } from "../lib/sourceTotals";
import { useData } from "../store/DataContext";

type CardProps = {
  title: string;
  subtitle: string;
  tone: "manual" | "pdf" | "combined";
  icon: LucideIcon;
  total: SourceTotal;
  badge: ReactNode;
  language: "ro" | "en";
};

function SourceCard({ title, subtitle, tone, icon: Icon, total, badge, language }: CardProps) {
  return <article className={`source-card ${tone}`}>
    <i className="source-card-scan"/>
    <header><span className="source-icon"><Icon/></span><div><small>{subtitle}</small><h3>{title}</h3></div><b>{badge}</b></header>
    <div className="source-primary"><span>{language === "ro" ? "VENIT" : "INCOME"}</span><strong>{money(total.income)}</strong><small>NET {money(total.net)}</small></div>
    <div className="source-metrics">
      <div><span>{language === "ro" ? "Mașini" : "Cars"}</span><strong>{total.jobs}</strong></div>
      <div><span>{language === "ro" ? "Mile" : "Miles"}</span><strong>{number(total.miles)}</strong></div>
      <div><span>{language === "ro" ? "Costuri" : "Costs"}</span><strong>{money(total.costs)}</strong></div>
    </div>
  </article>;
}

export function SourceMatrix({ totals, compact = false }: { totals: SourceTotals; compact?: boolean }) {
  const { language } = useData();
  return <section className={`source-matrix ${compact ? "compact" : ""}`}>
    <div className="source-matrix-head"><div><span>{language === "ro" ? "MATRICE DE FUZIUNE A DATELOR" : "DATA FUSION MATRIX"}</span><h2>{language === "ro" ? "Sursele tale, separate și combinate" : "Your sources, separate and combined"}</h2></div><p>{language === "ro" ? "Job Ref elimină dublurile. PDF-ul are prioritate la mile și plata finală." : "Job Ref removes duplicates. The PDF has priority for miles and final payment."}</p></div>
    <div className="source-card-grid">
      <SourceCard language={language} title={language === "ro" ? "Introduse de mine" : "Entered by me"} subtitle={language === "ro" ? "SURSĂ 01 · MANUAL" : "SOURCE 01 · MANUAL"} tone="manual" icon={Database} total={totals.manual} badge="LIVE"/>
      <SourceCard language={language} title={language === "ro" ? "Extrase din PDF" : "Extracted from PDF"} subtitle={language === "ro" ? "SURSĂ 02 · FLUTURAȘ" : "SOURCE 02 · PAYSLIP"} tone="pdf" icon={FileSearch2} total={totals.pdf} badge="PDF"/>
      <SourceCard language={language} title={language === "ro" ? "Total combinat" : "Combined total"} subtitle={language === "ro" ? "SURSĂ 03 · FĂRĂ DUBLURI" : "SOURCE 03 · NO DUPLICATES"} tone="combined" icon={Layers3} total={totals.combined} badge="SYNC"/>
    </div>
  </section>;
}
