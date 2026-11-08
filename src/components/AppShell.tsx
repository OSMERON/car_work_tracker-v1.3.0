import { BarChart3, CalendarRange, CarFront, ClipboardPlus, FileCheck2, History, Home, ListPlus, Menu, ReceiptPoundSterling, Settings, Truck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";

const items = [
  ["/", Home, "today"], ["/collect", ClipboardPlus, "collect"], ["/deliver", Truck, "deliver"],
  ["/catch-up", ListPlus, "catchUp"],
  ["/reports", CalendarRange, "reports"], ["/analytics", BarChart3, "analytics"], ["/history", History, "history"],
  ["/payslips", FileCheck2, "payslips"], ["/tax", ReceiptPoundSterling, "tax"], ["/settings", Settings, "settings"]
] as const;

export function AppShell() {
  const { language } = useData(); const t=tFor(language);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><CarFront size={25}/></span><div><strong>{t("appName")}</strong><small>Drive · Track · Verify</small></div></div>
      <nav>{items.map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={20}/><span>{t(key)}</span></NavLink>)}</nav>
      <div className="side-note"><span className="live-dot"/> Local-first<br/><small>{t("userDataNotice")}</small></div>
    </aside>
    <main className="main"><Outlet/></main>
    <nav className="bottom-nav">{items.slice(0,4).map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={20}/><span>{t(key)}</span></NavLink>)}<NavLink to="/menu"><Menu size={20}/><span>{t("menu")}</span></NavLink></nav>
  </div>;
}
