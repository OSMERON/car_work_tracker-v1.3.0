import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { readBackup, readWorkbook } from "../lib/dataTransfer";
import { useData } from "../store/DataContext";
import type { ThemeMode } from "../types";

export function Onboarding(){
 const {data,language,replaceData,saveProfile,setThemeMode}=useData();
 const [name,setName]=useState("");const [theme,setTheme]=useState<ThemeMode>("dark");const [message,setMessage]=useState("");
 const start=()=>{if(!name.trim()){setMessage(language==="ro"?"Introdu numele tău.":"Enter your name.");return}setThemeMode(theme);saveProfile({name:name.trim(),initialized:true})};
 const importFile=async(file?:File)=>{if(!file)return;try{const imported=file.name.toLowerCase().endsWith(".zip")?await readBackup(file):await readWorkbook(file);replaceData({...imported,profile:{name:imported.profile?.name||name.trim()||"Driver",initialized:true}});setThemeMode(imported.themeMode==="light"?"light":"dark")}catch{setMessage(language==="ro"?"Fișierul nu este un backup A.R.I.S. valid.":"This is not a valid A.R.I.S. backup.")}};
 return <main className="onboarding"><div className="onboarding-card"><span className="brand-mark"><i/></span><h1>A.R.I.S. 1.5.7</h1><p>{language==="ro"?"Configurează aplicația pe acest dispozitiv.":"Set up the app on this device."}</p><label>{language==="ro"?"Numele șoferului":"Driver name"}<input value={name} onChange={event=>setName(event.target.value)} autoFocus placeholder={language==="ro"?"Numele tău":"Your name"}/></label><div className="theme-choice"><button className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")} type="button">{language==="ro"?"Temă întunecată":"Dark theme"}</button><button className={theme==="light"?"active":""} onClick={()=>setTheme("light")} type="button">{language==="ro"?"Temă luminoasă":"Light theme"}</button></div><button className="primary-button" type="button" onClick={start}><Download/>{language==="ro"?"Începe de la zero":"Start fresh"}</button><label className="secondary-button file-button"><Upload/>{language==="ro"?"Importă un backup":"Import a backup"}<input type="file" accept=".xlsx,.zip" onChange={event=>void importFile(event.target.files?.[0])}/></label>{message&&<p className="error-message">{message}</p>}<small>{data.jobs.length?`${data.jobs.length} ${language==="ro"?"joburi":"jobs"}`:language==="ro"?"Nu există date pe acest dispozitiv.":"No data exists on this device."}</small></div></main>;
}
