import { useEffect, useState } from "react";
import { Cloud, Download, Upload } from "lucide-react";
import { Field, PageHeader } from "../components/Ui";
import { useData } from "../store/DataContext";
import { tFor } from "../i18n";
import { downloadAll, getCloudConfig, getSupabase, saveCloudConfig, uploadAll } from "../lib/supabase";

const download=(name:string,content:string,type:string)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)};
const csv=(rows:Record<string,unknown>[])=>{if(!rows.length)return"";const keys=Object.keys(rows[0]);const esc=(v:unknown)=>`"${String(v??"").replace(/"/g,'""')}"`;return[keys.map(esc).join(","),...rows.map(r=>keys.map(k=>esc(r[k])).join(","))].join("\n")};
export function SettingsPage() {
  const { data, language, setLanguage, replaceData, restoreSeed } = useData();
  const t = tFor(language);
  const [config, setConfig] = useState(getCloudConfig());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { getSupabase()?.auth.getUser().then(({ data }) => setUser(data.user?.email || "")); }, []);
  const auth = async (mode: "in" | "up") => {
    const client = getSupabase();
    if (!client) { setMessage(t("onlineMissing")); return; }
    const result = mode === "in" ? await client.auth.signInWithPassword({ email, password }) : await client.auth.signUp({ email, password });
    setMessage(result.error?.message || t("syncDone")); setUser(result.data.user?.email || "");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try { const next = JSON.parse(await file.text()); if (!Array.isArray(next.jobs) || !Array.isArray(next.expenses)) throw new Error(); replaceData(next); setMessage(t("saved")); }
    catch { setMessage(t("invalidBackup")); }
  };
  const signOut = async () => { const client = getSupabase(); if (client) await client.auth.signOut(); setUser(""); };
  const syncUp = async () => { try { const client = getSupabase(); if (!client) throw new Error(t("onlineMissing")); await uploadAll(client, data); setMessage(t("syncDone")); } catch (error) { setMessage(String(error)); } };
  const syncDown = async () => { try { const client = getSupabase(); if (!client) throw new Error(t("onlineMissing")); replaceData(await downloadAll(client)); setMessage(t("syncDone")); } catch (error) { setMessage(String(error)); } };

  return <>
    <PageHeader title={t("settings")}/>
    <section className="settings-card"><h2>{t("language")}</h2><div className="segmented"><button className={language === "ro" ? "active" : ""} onClick={() => setLanguage("ro")}>Română</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button></div></section>
    <section className="settings-card">
      <div className="settings-title"><Cloud/><div><h2>{t("cloudSync")}</h2><p>{config.url && config.anonKey ? t("onlineReady") : t("onlineMissing")}</p></div></div>
      <div className="form-grid"><Field label={t("supabaseUrl")}><input value={config.url} onChange={e => setConfig({...config,url:e.target.value})} placeholder="https://...supabase.co"/></Field><Field label={t("supabaseKey")}><input type="password" value={config.anonKey} onChange={e => setConfig({...config,anonKey:e.target.value})}/></Field></div>
      <button className="secondary-button" onClick={() => { saveCloudConfig(config); setMessage(t("saved")); location.reload(); }}>{t("saveConfig")}</button>
      <div className="form-grid auth-grid"><Field label={t("email")}><input type="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label={t("password")}><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></Field></div>
      {user ? <div className="sync-actions"><span>{user}</span><button onClick={signOut}>{t("signOut")}</button><button className="primary-button" onClick={syncUp}><Upload size={17}/>{t("syncUp")}</button><button className="secondary-button" onClick={syncDown}><Download size={17}/>{t("syncDown")}</button></div> : <div className="sync-actions"><button className="primary-button" onClick={()=>auth("in")}>{t("signIn")}</button><button className="secondary-button" onClick={()=>auth("up")}>{t("signUp")}</button></div>}
    </section>
    <section className="settings-card"><h2>{t("backup")}</h2><div className="sync-actions"><button className="secondary-button" onClick={()=>download(`car-work-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),"application/json")}>{t("exportJson")}</button><button className="secondary-button" onClick={()=>download("car-work-jobs.csv",csv(data.jobs as unknown as Record<string,unknown>[]),"text/csv")}>{t("exportCsv")}</button><label className="secondary-button upload-button">{t("importJson")}<input type="file" accept="application/json" onChange={e=>importFile(e.target.files?.[0])}/></label><button className="danger-button" onClick={()=>{if(confirm(language==="ro"?"Restaurezi datele inițiale?":"Restore initial data?"))restoreSeed();}}>{t("restoreSeed")}</button></div></section>
    {message && <div className="toast-message">{message}</div>}<p className="settings-note">{t("installHint")}<br/>{t("userDataNotice")}</p>
  </>;
}
