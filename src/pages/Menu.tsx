import { BarChart3, CalendarRange, FileCheck2, History, ReceiptPoundSterling, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
export function MenuPage(){const {language}=useData(),t=tFor(language);return <><PageHeader title={t("menu")}/><div className="menu-grid"><Link to="/reports"><CalendarRange/>{t("reports")}</Link><Link to="/history"><History/>{t("history")}</Link><Link to="/performance"><BarChart3/>{language==="ro"?"Performanță":"Performance"}</Link><Link to="/payslips"><FileCheck2/>{t("payslips")}</Link><Link to="/tax"><ReceiptPoundSterling/>{t("tax")}</Link><Link to="/settings"><Settings/>{t("settings")}</Link></div></>}
