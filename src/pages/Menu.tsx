import { BarChart3, BrainCircuit, CalendarRange, Camera, FileCheck2, History, ReceiptPoundSterling, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
export function MenuPage(){const {language}=useData(),t=tFor(language);return <><PageHeader title={t("menu")}/><div className="menu-grid"><Link className="menu-aris-card" to="/intelligence"><BrainCircuit/><span><strong>A.R.I.S. Intelligence</strong><small>{language==="ro"?"Panou separat, numai grafice și calcule":"Separate panel with charts and calculations only"}</small></span></Link><Link to="/scan-job"><Camera/>{language==="ro"?"Încarcă poze job":"Upload job photos"}</Link><Link to="/reports"><CalendarRange/>{t("reports")}</Link><Link to="/history"><History/>{t("history")}</Link><Link to="/performance"><BarChart3/>{language==="ro"?"Performanță":"Performance"}</Link><Link to="/payslips"><FileCheck2/>{t("payslips")}</Link><Link to="/tax"><ReceiptPoundSterling/>{t("tax")}</Link><Link to="/settings"><Settings/>{t("settings")}</Link></div></>}
