import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Collect } from "./pages/Collect";
import { Deliver } from "./pages/Deliver";
import { Analytics } from "./pages/Analytics";
import { HistoryPage } from "./pages/History";
import { PayslipsPage } from "./pages/Payslips";
import { SettingsPage } from "./pages/Settings";
import { MenuPage } from "./pages/Menu";
import { CatchUp } from "./pages/CatchUp";
import { ReportsPage } from "./pages/Reports";
import { TaxPage } from "./pages/Tax";

export default function App(){return <Routes><Route element={<AppShell/>}>
  <Route index element={<Dashboard/>}/><Route path="collect" element={<Collect/>}/><Route path="deliver" element={<Deliver/>}/><Route path="catch-up" element={<CatchUp/>}/>
  <Route path="reports" element={<ReportsPage/>}/><Route path="analytics" element={<Analytics/>}/><Route path="history" element={<HistoryPage/>}/><Route path="payslips" element={<PayslipsPage/>}/><Route path="tax" element={<TaxPage/>}/>
  <Route path="settings" element={<SettingsPage/>}/><Route path="menu" element={<MenuPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Route></Routes>}
