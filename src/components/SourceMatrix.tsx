import { Database, FileSearch2, Layers3, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { money, number } from "./Ui";
import type { SourceTotal, SourceTotals } from "../lib/sourceTotals";

type CardProps = {
  title: string;
  subtitle: string;
  tone: "manual" | "pdf" | "combined";
  icon: LucideIcon;
  total: SourceTotal;
  badge: ReactNode;
};

function SourceCard({ title, subtitle, tone, icon: Icon, total, badge }: CardProps) {
  return <article className={`source-card ${tone}`}>
    <i className="source-card-scan"/>
    <header><span className="source-icon"><Icon/></span><div><small>{subtitle}</small><h3>{title}</h3></div><b>{badge}</b></header>
    <div className="source-primary"><span>VENIT</span><strong>{money(total.income)}</strong><small>NET {money(total.net)}</small></div>
    <div className="source-metrics">
      <div><span>Mașini</span><strong>{total.jobs}</strong></div>
      <div><span>Mile</span><strong>{number(total.miles)}</strong></div>
      <div><span>Costuri</span><strong>{money(total.costs)}</strong></div>
    </div>
  </article>;
}

export function SourceMatrix({ totals, compact = false }: { totals: SourceTotals; compact?: boolean }) {
  return <section className={`source-matrix ${compact ? "compact" : ""}`}>
    <div className="source-matrix-head"><div><span>DATA FUSION MATRIX</span><h2>Sursele tale, separate și combinate</h2></div><p>Job Ref elimină dublurile. PDF-ul are prioritate la mile și plata finală.</p></div>
    <div className="source-card-grid">
      <SourceCard title="Introduse de mine" subtitle="SURSĂ 01 · MANUAL" tone="manual" icon={Database} total={totals.manual} badge="LIVE"/>
      <SourceCard title="Extrase din PDF" subtitle="SURSĂ 02 · PAYSLIP" tone="pdf" icon={FileSearch2} total={totals.pdf} badge="PDF"/>
      <SourceCard title="Total combinat" subtitle="SURSĂ 03 · FĂRĂ DUBLURI" tone="combined" icon={Layers3} total={totals.combined} badge="SYNC"/>
    </div>
  </section>;
}
