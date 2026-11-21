import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader, money } from "../components/Ui";
import { useData } from "../store/DataContext";
import { addDays, formatShortDate, mondayOf, todayIso } from "../lib/date";
import { jobMiles } from "../lib/analytics";
import { tariffForMiles } from "../lib/rates";
import { calculateConsumption } from "../lib/consumption";
import type { Job, Language } from "../types";

type Scope="week"|"month"|"custom";
type ChartDatum=Record<string,string|number>;
type ChartSpec={title:string;subtitle:string;data:ChartDatum[];keys:Array<{key:string;label:string;color:string}>;missing:string;kind?:"line"|"bar";unit?:string};
const round=(value:number)=>Math.round(value*100)/100;
const sourceDate=(job:Job)=>job.deliveryDate||job.collectionDate;
const rangeFor=(scope:Scope,anchor:string,start:string,end:string)=>{if(scope==="week"){const value=mondayOf(anchor);return{start:value,end:addDays(value,6)}}if(scope==="month")return{start:`${anchor.slice(0,7)}-01`,end:`${anchor.slice(0,7)}-31`};return{start:start||"2000-01-01",end:end||"2100-12-31"}};
const group=(rows:Array<{label:string;[key:string]:string|number}>,keys:string[])=>{const map=new Map<string,ChartDatum>();rows.forEach(row=>{const current=map.get(row.label)??{label:row.label};keys.forEach(key=>current[key]=Number(current[key]??0)+Number(row[key]??0));map.set(row.label,current)});return[...map.values()]};
const carLabel=(job:Job)=>job.registration||job.payslipRegistration||job.makeModel||job.jobRef;
const L=(language:Language,ro:string,en:string)=>language==="ro"?ro:en;

export function InsightsPage(){
 const {data,language}=useData();
 const [scope,setScope]=useState<Scope>("week");const [anchor,setAnchor]=useState(todayIso());const [customStart,setCustomStart]=useState("");const [customEnd,setCustomEnd]=useState("");
 const range=useMemo(()=>rangeFor(scope,anchor,customStart,customEnd),[scope,anchor,customStart,customEnd]);
 const jobs=useMemo(()=>data.jobs.filter(job=>job.status==="delivered"&&sourceDate(job)>=range.start&&sourceDate(job)<=range.end),[data.jobs,range]);
 const expenses=useMemo(()=>data.expenses.filter(row=>row.date>=range.start&&row.date<=range.end&&row.source==="manual"),[data.expenses,range]);
 const logs=useMemo(()=>(data.dailyLogs??[]).filter(row=>row.date>=range.start&&row.date<=range.end),[data.dailyLogs,range]);
 const carousels=useMemo(()=>buildCharts(jobs,expenses,logs,language),[jobs,expenses,logs,language]);
 return <>
  <PageHeader eyebrow="A.R.I.S. 1.5.7" title={L(language,"Analiză operațională","Operational intelligence")} subtitle={L(language,"15 grafice reale în trei carusele. Valorile lipsă sunt explicate, nu inventate.","15 real-data charts in three carousels. Missing values are explained, never invented.")}/>
  <section className="report-toolbar"><div className="segmented">{(["week","month","custom"] as Scope[]).map(value=><button key={value} className={scope===value?"active":""} onClick={()=>setScope(value)}>{value==="week"?L(language,"Săptămână","Week"):value==="month"?L(language,"Lună","Month"):L(language,"Personalizat","Custom")}</button>)}</div><div className="period-navigation"><input type="date" value={anchor} onChange={event=>setAnchor(event.target.value)}/>{scope==="custom"&&<><input type="date" value={customStart} onChange={event=>setCustomStart(event.target.value)}/><input type="date" value={customEnd} onChange={event=>setCustomEnd(event.target.value)}/></>}</div></section>
  <div className="carousel-stack">{carousels.map((charts,index)=><ChartCarousel key={index} charts={charts} label={L(language,`Carusel ${index+1}`,`Carousel ${index+1}`)} language={language}/>)}</div>
 </>;
}

function buildCharts(jobs:Job[],expenses:ReturnType<typeof useData>["data"]["expenses"],logs:NonNullable<ReturnType<typeof useData>["data"]["dailyLogs"]>,language:Language):ChartSpec[][]{
 const fuel=jobs.filter(j=>Number(j.fuelEntry?.totalCost)>0).map(j=>({label:carLabel(j),value:Number(j.fuelEntry?.totalCost)}));
 const charging=jobs.filter(j=>Number(j.chargingEntry?.totalCost)>0).map(j=>({label:carLabel(j),value:Number(j.chargingEntry?.totalCost)}));
 const costMile=jobs.map(j=>{const cost=Number(j.fuelEntry?.totalCost||0)+Number(j.chargingEntry?.totalCost||0);const miles=jobMiles(j);return cost>0&&miles>0?{label:carLabel(j),value:round(cost/miles)}:null}).filter(Boolean) as ChartDatum[];
 const categories=group(expenses.filter(e=>e.actualCost>0).map(e=>({label:e.category||L(language,"Altele","Other"),value:e.actualCost})),["value"]);
 const payerRows=[{label:L(language,"Plătit de mine","Paid by me"),value:expenses.reduce((s,e)=>s+e.actualCost,0)},{label:L(language,"Companie","Company"),value:jobs.reduce((s,j)=>s+(j.fuelEntry?.payer==="company"?Number(j.fuelEntry.totalCost||0):0)+(j.chargingEntry?.payer==="company"?Number(j.chargingEntry.totalCost||0):0),0)},{label:L(language,"Rambursat","Reimbursed"),value:expenses.reduce((s,e)=>s+e.approved,0)}].filter(row=>row.value>0);
 const daily=group(jobs.map(j=>({label:formatShortDate(sourceDate(j),language),cars:1,miles:jobMiles(j),income:Number(j.tariffPaid??tariffForMiles(jobMiles(j)))})),["cars","miles","income"]);
 const hours=logs.map(log=>{const [sh,sm]=log.leftHomeTime.split(":").map(Number);const [eh,em]=log.returnedHomeTime.split(":").map(Number);let minutes=(eh*60+em)-(sh*60+sm);if(minutes<0)minutes+=1440;return{label:formatShortDate(log.date,language),hours:round(minutes/60),start:round(sh+sm/60)}}).filter(row=>row.hours>0);
 const hourly=hours.map(row=>{const income=Number(daily.find(item=>item.label===row.label)?.income??0);return income>0?{label:row.label,value:round(income/row.hours)}:null}).filter(Boolean) as ChartDatum[];
 const waiting=logs.filter(log=>log.waitingMinutes>0).map(log=>({label:formatShortDate(log.date,language),minutes:log.waitingMinutes,income:jobs.filter(job=>sourceDate(job)===log.date).reduce((s,j)=>s+Number(j.waitingPaid||0),0)}));
 const routes=jobs.map(j=>{const miles=jobMiles(j);const income=Number(j.tariffPaid??tariffForMiles(miles));return miles>0&&income>0?{label:`${j.pickupTown||"?"} → ${j.deliveryTown||"?"}`,value:round(income/miles)}:null}).filter(Boolean) as ChartDatum[];
 const milesCompare=jobs.filter(j=>j.actualMiles!==null&&j.payslipMiles!==null).map(j=>({label:carLabel(j),actual:Number(j.actualMiles),paid:Number(j.payslipMiles)}));
 const consumed=jobs.map(j=>{const result=calculateConsumption(j);return result&&!result.rangeIncreased?{label:carLabel(j),value:round(result.rangeUsed)}:null}).filter(Boolean) as ChartDatum[];
 const efficient=jobs.map(j=>{const result=calculateConsumption(j);return result&&!result.rangeIncreased?{label:carLabel(j),value:round(result.efficiency)}:null}).filter(Boolean) as ChartDatum[];
 const before9=group(jobs.filter(j=>j.firstDeliveryBefore9!==null).map(j=>({label:formatShortDate(sourceDate(j),language),success:j.firstDeliveryBefore9?1:0,total:1})),["success","total"]).map(row=>({...row,value:round(Number(row.success)/Number(row.total)*100)}));
 const spec=(title:string,subtitle:string,data:ChartDatum[],missing:string,keys=[{key:"value",label:title,color:"#51e4ff"}],unit="",kind:"line"|"bar"="bar"):ChartSpec=>({title,subtitle,data,missing,keys,unit,kind});
 return [[
  spec(L(language,"Combustibil per mașină","Fuel per car"),L(language,"Costul real introdus","Entered actual cost"),fuel,L(language,"Lipsește costul combustibilului pentru vehicule.","Vehicle fuel cost is missing."),undefined,"£"),
  spec(L(language,"Încărcare per vehicul electric","Charging cost per electric vehicle"),L(language,"Costul fiecărei încărcări","Cost of each charge"),charging,L(language,"Lipsește costul încărcării electrice.","Electric charging cost is missing."),undefined,"£"),
  spec(L(language,"Combustibil sau încărcare per milă","Fuel or charging cost per mile"),L(language,"Cost real împărțit la mile reale","Actual cost divided by actual miles"),costMile,L(language,"Lipsesc costul energiei sau milele vehiculului.","Energy cost or vehicle miles are missing."),undefined,"£/mi"),
  spec(L(language,"Cheltuieli pe categorie","Expenses by category"),L(language,"Doar cheltuieli reale","Actual expenses only"),categories,L(language,"Nu există cheltuieli introduse în perioada aleasă.","No expenses are entered for this period."),undefined,"£"),
  spec(L(language,"Plătit de mine, companie și rambursat","Paid by me, company and reimbursed"),L(language,"Sursa costului","Cost source"),payerRows,L(language,"Lipsesc costurile și rambursările.","Costs and reimbursements are missing."),undefined,"£")
 ],[
  spec(L(language,"Mașini și mile","Cars and miles"),L(language,"Activitate zilnică","Daily activity"),daily,L(language,"Nu există joburi livrate.","No delivered jobs."),[{key:"cars",label:L(language,"Mașini","Cars"),color:"#51e4ff"},{key:"miles",label:L(language,"Mile","Miles"),color:"#9b7bff"}],"","line"),
  spec(L(language,"Venit zilnic","Daily income"),L(language,"Tarif job pe zi","Job pay per day"),daily,L(language,"Lipsesc joburile sau tariful plătit.","Jobs or paid tariff are missing."),[{key:"income",label:L(language,"Venit","Income"),color:"#55e6a5"}],"£","line"),
  spec(L(language,"Câștig pe oră","Earnings per hour"),L(language,"Venit împărțit la timpul de lucru","Income divided by work time"),hourly,L(language,"Lipsește ora de început, ora de final sau venitul zilnic.","Start time, finish time or daily income is missing."),undefined,"£/h","line"),
  spec(L(language,"Așteptare și venit din așteptare","Waiting time and waiting income"),L(language,"Minute și suma plătită","Minutes and paid amount"),waiting,L(language,"Lipsesc minutele de așteptare sau plata pentru așteptare.","Waiting minutes or waiting payment is missing."),[{key:"minutes",label:L(language,"Minute","Minutes"),color:"#ffca67"},{key:"income",label:L(language,"Venit £","Income £"),color:"#55e6a5"}]),
  spec(L(language,"Ore de lucru și ora de plecare","Working hours and start time"),L(language,"Din jurnalul zilnic","From daily log"),hours,L(language,"Lipsește ora de început sau de final.","Start or finish time is missing."),[{key:"hours",label:L(language,"Ore lucrate","Hours worked"),color:"#51e4ff"},{key:"start",label:L(language,"Ora de plecare","Start time"),color:"#9b7bff"}],"h","line")
 ],[
  spec(L(language,"Rute după £ pe milă","Routes by £ per mile"),L(language,"Eficiența financiară a rutei","Route financial efficiency"),routes,L(language,"Lipsesc ruta, milele sau plata jobului.","Route, miles or job payment is missing."),undefined,"£/mi"),
  spec(L(language,"Mile reale față de mile plătite","Actual miles vs paid miles"),L(language,"Compară distanțele per vehicul","Compare distance per vehicle"),milesCompare,L(language,"Lipsesc milele finale sau milele din PDF.","Final miles or PDF paid miles are missing."),[{key:"actual",label:L(language,"Reale","Actual"),color:"#51e4ff"},{key:"paid",label:L(language,"Plătite","Paid"),color:"#55e6a5"}]),
  spec(L(language,"Range consumat per vehicul","Range consumed per vehicle"),L(language,"Range colectare minus range livrare","Collection range minus delivery range"),consumed,L(language,"Lipsește range-ul la colectare sau la livrare.","Collection or delivery range is missing."),undefined,"mi"),
  spec(L(language,"Eficiența vehiculului","Vehicle efficiency"),L(language,"Mile reale raportate la range consumat","Actual miles against range consumed"),efficient,L(language,"Lipsesc range-ul și milele reale.","Range and actual miles are missing."),undefined,"%"),
  spec(L(language,"Prima livrare înainte de 09:00","First delivery before 09:00"),L(language,"Rata de succes zilnică","Daily success rate"),before9,L(language,"Nu există răspunsuri pentru prima livrare înainte de 09:00.","No first-delivery-before-09:00 answers exist."),undefined,"%","line")
 ]];
}

function ChartCarousel({charts,label,language}:{charts:ChartSpec[];label:string;language:Language}){const [index,setIndex]=useState(0);const start=useRef(0);const move=(amount:number)=>setIndex(current=>(current+amount+charts.length)%charts.length);return <section className="aris-carousel"><div className="carousel-head"><div><span className="eyebrow">{label}</span><h2>{charts[index].title}</h2></div><div className="carousel-nav"><button className="icon-button" onClick={()=>move(-1)} aria-label={L(language,"Grafic anterior","Previous chart")}><ChevronLeft/></button><strong>{index+1} / {charts.length}</strong><button className="icon-button" onClick={()=>move(1)} aria-label={L(language,"Grafic următor","Next chart")}><ChevronRight/></button></div></div><div className="carousel-viewport" onPointerDown={event=>{start.current=event.clientX}} onPointerUp={event=>{const delta=event.clientX-start.current;if(Math.abs(delta)>45)move(delta<0?1:-1)}}><div className="carousel-track" style={{transform:`translateX(-${index*100}%)`}}>{charts.map(chart=><div className="chart-slide" key={chart.title}><ChartCard chart={chart}/></div>)}</div></div><div className="carousel-dots">{charts.map((_,dot)=><button key={dot} className={dot===index?"active":""} onClick={()=>setIndex(dot)} aria-label={`${dot+1}`}/>)}</div></section>}

function ChartCard({chart}:{chart:ChartSpec}){return <article className="chart-card"><header><div><h3>{chart.title}</h3><p>{chart.subtitle}</p></div></header>{chart.data.length?<ResponsiveContainer width="100%" height={260}>{chart.kind==="line"?<LineChart data={chart.data} margin={{left:0,right:12,bottom:24}}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="label" angle={-20} textAnchor="end" height={58}/><YAxis/><Tooltip formatter={(value:number)=>`${moneyOrNumber(value,chart.unit)}`}/><Legend/>{chart.keys.map(item=><Line type="monotone" key={item.key} dataKey={item.key} name={item.label} stroke={item.color} strokeWidth={3}/>)}</LineChart>:<BarChart data={chart.data} margin={{left:0,right:12,bottom:24}}><CartesianGrid strokeDasharray="3 3" opacity={.2}/><XAxis dataKey="label" angle={-20} textAnchor="end" height={58}/><YAxis/><Tooltip formatter={(value:number)=>`${moneyOrNumber(value,chart.unit)}`}/><Legend/>{chart.keys.map(item=><Bar key={item.key} dataKey={item.key} name={item.label} fill={item.color} radius={[6,6,0,0]}/>)}</BarChart>}</ResponsiveContainer>:<div className="chart-empty"><div><strong>{chart.missing}</strong><p>{chart.subtitle}</p></div></div>}</article>}
const moneyOrNumber=(value:number,unit="")=>unit.startsWith("£")?`${money(value)}${unit==="£"?"":unit.slice(1)}`:`${round(value)}${unit?` ${unit}`:""}`;
