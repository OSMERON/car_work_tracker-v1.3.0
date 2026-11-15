import { Shield } from "lucide-react";
import { PROTOCOLS } from "../lib/jobProtocols";
import type { JobProtocol, Language } from "../types";

export function ProtocolBadge({ protocol, language, compact = false }: { protocol?: JobProtocol; language: Language; compact?: boolean }) {
  if (!protocol) return null;
  const item = PROTOCOLS[protocol];
  return <div className={`protocol-badge ${protocol} ${compact ? "compact" : ""}`} title={item[language]}><Shield/><span><strong>{item.code}</strong><small>{item.name}</small></span></div>;
}
