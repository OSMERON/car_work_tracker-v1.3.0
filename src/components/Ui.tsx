import type { ReactNode } from "react";

export const money = (value: number) => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(value || 0);
export const number = (value: number, digits=1) => new Intl.NumberFormat("en-GB",{maximumFractionDigits:digits}).format(value || 0);

export function PageHeader({eyebrow,title,subtitle,action}:{eyebrow?:string;title:string;subtitle?:string;action?:ReactNode}) {
  return <header className="page-header"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>;
}
export function StatCard({label,value,detail,tone="default"}:{label:string;value:string;detail?:string;tone?:"default"|"green"|"amber"|"red"}) {
  return <article className={`stat-card ${tone}`}><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</article>;
}
export function Empty({children}:{children:ReactNode}) { return <div className="empty">{children}</div>; }
export function Field({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}) { return <label className={`field ${wide?"wide":""}`}><span>{label}</span>{children}</label>; }
export function StatusPill({status}:{status:string}) { return <span className={`status-pill ${status}`}>{status}</span>; }
