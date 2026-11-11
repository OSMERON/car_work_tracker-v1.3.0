import { BarChart3, CalendarRange, ClipboardPlus, FileCheck2, History, Home, ListPlus, Menu, Radar, ReceiptPoundSterling, Settings, ShieldCheck, Truck, Wifi } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";

const items = [
  ["/", Home, "today"], ["/collect", ClipboardPlus, "collect"], ["/deliver", Truck, "deliver"],
  ["/catch-up", ListPlus, "catchUp"],
  ["/reports", CalendarRange, "reports"], ["/performance", BarChart3, "analytics"], ["/history", History, "history"],
  ["/payslips", FileCheck2, "payslips"], ["/tax", ReceiptPoundSterling, "tax"], ["/settings", Settings, "settings"]
] as const;

export function AppShell() {
  const { language } = useData(); const t=tFor(language);
  return <div className="app-shell">
    <div className="global-hud-grid" aria-hidden="true"/>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i/></span><div><strong>A.R.I.S.</strong><small>Adaptive Route Intelligence System</small></div></div>
      <nav>{items.map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={20}/><span>{t(key)}</span></NavLink>)}</nav>
      <div className="sidebar-core"><Radar/><span><b>NEURAL CORE</b><small>A.R.I.S. 1.4.3</small></span><i/></div>
      <div className="side-note"><div><Wifi/><span><b>{language === "ro" ? "Sistem online" : "System online"}</b><small>DATA LINK STABLE</small></span><ShieldCheck/></div><small>Standard VAT · Accrual</small></div>
    </aside>
    <main className="main"><Outlet/></main>
    <nav className="bottom-nav">{items.slice(0,4).map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={20}/><span>{t(key)}</span></NavLink>)}<NavLink to="/menu"><Menu size={20}/><span>{t("menu")}</span></NavLink></nav>
  </div>;
}
