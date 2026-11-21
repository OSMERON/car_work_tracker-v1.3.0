import { BarChart3, BrainCircuit, CalendarRange, ClipboardPlus, FileCheck2, History, Home, ListPlus, Menu, Moon, Radar, ReceiptPoundSterling, Settings, ShieldCheck, Sun, Truck, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";

const items = [
  ["/", Home, "today"], ["/collect", ClipboardPlus, "collect"], ["/deliver", Truck, "deliver"],
  ["/catch-up", ListPlus, "catchUp"],
  ["/reports", CalendarRange, "reports"], ["/performance", BarChart3, "analytics"], ["/intelligence", BrainCircuit, "insights"], ["/history", History, "history"],
  ["/payslips", FileCheck2, "payslips"], ["/tax", ReceiptPoundSterling, "tax"], ["/settings", Settings, "settings"]
] as const;

const mobileItems = [
  ["/", Home, "today"], ["/collect", ClipboardPlus, "collect"], ["/intelligence", BrainCircuit, "insights"], ["/deliver", Truck, "deliver"]
] as const;

function ThemeSwitch({ language }: { language: "ro" | "en" }) {
  const { data, setThemeMode } = useData();
  const [mode, setMode] = useState<"light" | "dark">(data.themeMode === "light" ? "light" : "dark");

  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.dataset.theme = mode;
      document.documentElement.dataset.themeMode = mode;
      setThemeMode(mode);
    };
    applyTheme();
  }, [mode]);

  const labels = language === "ro"
    ? { group: "Temă vizuală", light: "Zi", dark: "Noapte" }
    : { group: "Visual theme", light: "Day", dark: "Night" };
  const options: Array<["light" | "dark", typeof Sun, string]> = [["light", Sun, labels.light], ["dark", Moon, labels.dark]];

  return <div className="theme-switch" role="group" aria-label={labels.group}>
    <span>{labels.group}</span>
    <div>{options.map(([value, Icon, label]) => <button key={value} type="button" className={mode === value ? "active" : ""} onClick={() => setMode(value)} aria-pressed={mode === value} title={label}><Icon/><small>{label}</small></button>)}</div>
  </div>;
}

export function AppShell() {
  const { language } = useData(); const t=tFor(language);
  return <div className="app-shell">
    <div className="global-hud-grid" aria-hidden="true"/>
    <ThemeSwitch language={language}/>
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i/></span><div><strong>A.R.I.S.</strong><small>Adaptive Route Intelligence System</small></div></div>
      <nav>{items.map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>isActive?"active":""}><Icon size={20}/><span>{t(key)}</span></NavLink>)}</nav>
      <div className="sidebar-core"><Radar/><span><b>NEURAL CORE</b><small>A.R.I.S. 1.5.6</small></span><i/></div>
      <div className="side-note"><div><Wifi/><span><b>{language === "ro" ? "Sistem online" : "System online"}</b><small>DATA LINK STABLE</small></span><ShieldCheck/></div><small>Standard VAT · Accrual</small></div>
    </aside>
    <main className="main"><Outlet/></main>
    <nav className="bottom-nav">{mobileItems.map(([to,Icon,key])=><NavLink key={to} to={to} end={to==="/"} className={({isActive})=>`${isActive?"active":""} ${to==="/intelligence"?"aris-center-nav":""}`.trim()}><Icon size={20}/><span>{to === "/intelligence" ? "A.R.I.S." : t(key)}</span></NavLink>)}<NavLink to="/menu"><Menu size={20}/><span>{t("menu")}</span></NavLink></nav>
  </div>;
}
