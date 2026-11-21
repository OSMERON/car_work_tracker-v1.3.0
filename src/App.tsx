import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Collect } from "./pages/Collect";
import { Deliver } from "./pages/Deliver";
import { Analytics } from "./pages/Analytics";
import { PerformancePage } from "./pages/Performance";
import { HistoryPage } from "./pages/History";
import { PayslipsPage } from "./pages/Payslips";
import { SettingsPage } from "./pages/Settings";
import { MenuPage } from "./pages/Menu";
import { CatchUp } from "./pages/CatchUp";
import { ReportsPage } from "./pages/Reports";
import { TaxPage } from "./pages/Tax";
import { ScanJobPage } from "./pages/ScanJob";
import { InsightsPage } from "./pages/Insights";
import { ElectricVehiclePage } from "./pages/ElectricVehicle";
import { DataTransferPage } from "./pages/DataTransfer";
import { DeleteDataPage } from "./pages/DeleteData";
import { Onboarding } from "./pages/Onboarding";
import { useData } from "./store/DataContext";

export default function App(){const {data}=useData(); if(!data.profile?.initialized) return <Onboarding/>; return <Routes><Route element={<AppShell/>}>
  <Route index element={<Dashboard/>}/><Route path="collect" element={<Collect/>}/><Route path="scan-job" element={<ScanJobPage/>}/><Route path="deliver" element={<Deliver/>}/><Route path="catch-up" element={<CatchUp/>}/>
  <Route path="reports" element={<ReportsPage/>}/><Route path="performance" element={<PerformancePage/>}/><Route path="intelligence" element={<InsightsPage/>}/><Route path="insights" element={<Navigate to="/intelligence" replace/>}/><Route path="analytics" element={<Analytics/>}/><Route path="history" element={<HistoryPage/>}/><Route path="payslips" element={<PayslipsPage/>}/><Route path="tax" element={<TaxPage/>}/>
  <Route path="settings" element={<SettingsPage/>}/><Route path="menu" element={<MenuPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  <Route path="electric" element={<ElectricVehiclePage/>}/><Route path="data-transfer" element={<DataTransferPage/>}/><Route path="delete-data" element={<DeleteDataPage/>}/>
</Route></Routes>}
