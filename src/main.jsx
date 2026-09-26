import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const STORAGE = "testovi.v1";
const DEVICE = "testovi.deviceId";
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

const uid = () => crypto.randomUUID();
const deviceId = () => {
  let id = localStorage.getItem(DEVICE);
  if (!id) { id = uid(); localStorage.setItem(DEVICE, id); }
  return id;
};
const initialData = () => ({ tests: [], settings: { geminiKey: "", defaultReminder: "week" } });
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE)) || initialData(); } catch { return initialData(); } };
const save = d => localStorage.setItem(STORAGE, JSON.stringify(d));

function fmtDate(iso) {
  return new Intl.DateTimeFormat("sr-RS", { day:"2-digit", month:"long", year:"numeric" }).format(new Date(iso));
}
function fmtTime(iso) {
  return new Intl.DateTimeFormat("sr-RS", { hour:"2-digit", minute:"2-digit" }).format(new Date(iso));
}
function daysUntil(iso) {
  const ms = new Date(iso) - Date.now();
  return Math.ceil(ms / 86400000);
}
function countdown(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return "Prošlo";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d) return `za ${d} ${d === 1 ? "dan" : "dana"}`;
  if (h) return `za ${h} ${h === 1 ? "sat" : "sati"}`;
  return "uskoro";
}

function App() {
  const [data, setData] = useState(load);
  const [page, setPage] = useState("pregled");
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => save(data), [data]);
  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(()=>{});
    const t = setInterval(() => setData(d => ({...d})), 30000);
    return () => clearInterval(t);
  }, []);

  const upcoming = useMemo(() => [...data.tests].filter(t => new Date(t.date) >= new Date(Date.now()-3600000)).sort((a,b)=>new Date(a.date)-new Date(b.date)), [data.tests]);
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(""), 3200); };

  const syncPushData = async tests => {
    try {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      await fetch("/.netlify/functions/register-push", {
        method: "POST",
        headers: {"content-type":"application/json"},
        body: JSON.stringify({
          deviceId: deviceId(),
          subscription: sub.toJSON(),
          tests,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade"
        })
      });
    } catch {}
  };

  const addTest = test => {
    setData(d => {
      const tests = [...d.tests.filter(x=>x.id!==test.id), test];
      void syncPushData(tests);
      return {...d, tests};
    });
    setPage("pregled"); setEditing(null); notify("Test je sačuvan.");
  };
  const remove = id => {
    setData(d => {
      const tests = d.tests.filter(t=>t.id!==id);
      void syncPushData(tests);
      return {...d, tests};
    });
  };

  return <div className="app">
    <header className="topbar">
      <div className="brand" onClick={()=>setPage("pregled")}><span className="brandMark">✓</span><span>Testovi</span></div>
      <nav>
        <button className={page==="pregled"?"active":""} onClick={()=>setPage("pregled")}>Pregled</button>
        <button className={page==="kalendar"?"active":""} onClick={()=>setPage("kalendar")}>Kalendar</button>
        <button className={page==="podesavanja"?"active":""} onClick={()=>setPage("podesavanja")}>Podešavanja</button>
      </nav>
      <button className="addTop" onClick={()=>{setEditing({id:uid(),name:"",date:"",reminders:[]});setPage("novi")}}>+ Dodaj test</button>
    </header>

    <main>
      {page==="pregled" && <Dashboard
  tests={upcoming}
  onAdd={()=>{setEditing({id:uid(),name:"",date:"",reminders:[]});setPage("novi")}}
  onImport={()=>setImporting(true)}
  onEdit={t=>{setEditing(t);setPage("novi")}}
  onDelete={remove}
/>}
      {page==="kalendar" && <Calendar tests={upcoming} onEdit={t=>{setEditing(t);setPage("novi")}} />}
      {page==="novi" && <TestForm initial={editing} defaultReminder={data.settings.defaultReminder} onCancel={()=>setPage("pregled")} onSave={addTest} />}
      {page==="podesavanja" && <Settings data={data} setData={setData} notify={notify} />}
      <ImportModal open={importing} onClose={()=>setImporting(false)} apiKey={data.settings.geminiKey} onImported={tests=>{
        setData(d=>{
          const allTests=[...d.tests,...tests];
          void syncPushData(allTests);
          return {...d,tests:allTests};
        });
        setImporting(false);setPage("pregled");notify(`${tests.length} testova je uvezeno.`);
      }} />
    </main>

    {page==="pregled" && <button className="aiFab" onClick={()=>setImporting(true)}>✦ <span>Uvezi sa slike</span></button>}
    {toast && <div className="toast">{toast}</div>}
  </div>
}

function Dashboard({tests,onAdd,onEdit,onDelete}) {
  const next = tests[0];
  return <section className="page">
    <div className="hero">
      <div><p className="eyebrow">ŠKOLSKI PLANER</p><h1>Ne zaboravi nijedan test.</h1><p className="muted">Svi testovi, datumi i podsetnici na jednom mestu.</p></div>
      <button className="primary" onClick={onAdd}>+ Novi test</button>
    </div>
    {next && <div className="nextCard">
      <div><div className="label">SLEDEĆI TEST</div><h2>{next.name}</h2><p>{fmtDate(next.date)} · {fmtTime(next.date)}</p></div>
      <div className="count">{countdown(next.date)}</div>
    </div>}
    <div className="sectionHead"><div><h2>Predstojeći testovi</h2><p className="muted">{tests.length ? `${tests.length} ${tests.length===1?"test":"testova"}` : "Još nema testova"}</p></div></div>
    <div className="testList">
      {!tests.length && <Empty onAdd={onAdd}/>}
      {tests.map(t=><article className="testRow" key={t.id}>
        <div className="dateBox"><strong>{new Date(t.date).getDate()}</strong><span>{new Intl.DateTimeFormat("sr-RS",{month:"short"}).format(new Date(t.date)).replace(".","")}</span></div>
        <div className="testInfo"><h3>{t.name}</h3><p>{fmtDate(t.date)} · {fmtTime(t.date)}</p></div>
        <div className="rowRight"><span className="pill">{countdown(t.date)}</span><div className="actions"><button onClick={()=>onEdit(t)}>Izmeni</button><button className="dangerText" onClick={()=>onDelete(t.id)}>Obriši</button></div></div>
      </article>)}
    </div>
  </section>
}
function Empty({onAdd}) { return <div className="empty"><div className="emptyIcon">＋</div><h3>Još nema testova</h3><p>Dodaj prvi test i napravi podsetnike.</p><button className="secondary" onClick={onAdd}>Dodaj prvi test</button></div> }

function TestForm({initial,defaultReminder,onCancel,onSave}) {
  const [name,setName]=useState(initial?.name||"");
  const [date,setDate]=useState(initial?.date?new Date(initial.date).toISOString().slice(0,16):"");
  const [reminders,setReminders]=useState(initial?.reminders||[]);
  const [custom,setCustom]=useState({amount:2,unit:"dana",time:"14:30"});
  const toggle = r => setReminders(x=>x.some(a=>a.id===r.id)?x.filter(a=>a.id!==r.id):[...x,r]);
  const addCustom=()=>toggle({id:uid(),type:"custom",label:`${custom.amount} ${custom.unit} pre testa u ${custom.time}`,offsetMinutes:(custom.unit==="sati"?custom.amount*60:custom.amount*1440),time:custom.time});
  const valid = name.trim() && date;
  return <section className="page narrow">
    <button className="back" onClick={onCancel}>← Nazad</button>
    <div className="formHead"><p className="eyebrow">NOVI TEST</p><h1>{initial?.name ? "Izmeni test" : "Dodaj test"}</h1></div>
    <div className="formCard">
      <label>Naziv testa<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="npr. Matematika — kontrolni"/></label>
      <div className="two"><label>Datum<input type="date" value={date.slice(0,10)} onChange={e=>setDate(e.target.value+"T"+(date.slice(11,16)||"08:00"))}/></label><label>Vreme<input type="time" value={date.slice(11,16)} onChange={e=>setDate((date.slice(0,10)||new Date().toISOString().slice(0,10))+"T"+e.target.value)}/></label></div>
      <div className="reminderTitle"><div><h3>Podsetnici</h3><p className="muted">Dobićeš obaveštenje u izabrano vreme.</p></div></div>
      <div className="reminderGrid">
        {[["week","7 dana pre"],["2d","2 dana pre"],["1d","1 dan pre"]].map(([id,label])=><button key={id} className={reminders.some(r=>r.id===id)?"reminder selected":"reminder"} onClick={()=>toggle({id,type:"relative",label})}><span>{reminders.some(r=>r.id===id)?"✓":"○"}</span>{label}</button>)}
      </div>
      <div className="customReminder"><div><strong>Prilagođeni podsetnik</strong><p className="muted">Na primer: 2 dana pre u 14:30.</p></div><div className="customControls"><input type="number" min="1" max="365" value={custom.amount} onChange={e=>setCustom({...custom,amount:Number(e.target.value)})}/><select value={custom.unit} onChange={e=>setCustom({...custom,unit:e.target.value})}><option>dana</option><option>sati</option></select><input type="time" value={custom.time} onChange={e=>setCustom({...custom,time:e.target.value})}/><button className="secondary" onClick={addCustom}>Dodaj</button></div></div>
      {reminders.filter(r=>r.type==="custom").map(r=><div className="customAdded" key={r.id}><span>✓ {r.label}</span><button onClick={()=>toggle(r)}>Ukloni</button></div>)}
      <div className="formActions"><button className="secondary" onClick={onCancel}>Otkaži</button><button className="primary" disabled={!valid} onClick={()=>onSave({id:initial?.id||uid(),name:name.trim(),date:new Date(date).toISOString(),reminders})}>Sačuvaj test</button></div>
    </div>
  </section>
}

function Calendar({tests,onEdit}) {
  const [month,setMonth]=useState(new Date());
  const y=month.getFullYear(), m=month.getMonth(), first=new Date(y,m,1).getDay(), offset=(first+6)%7, days=new Date(y,m+1,0).getDate();
  const cells=Array.from({length:offset+days},(_,i)=>i<offset?null:i-offset+1);
  return <section className="page"><div className="calendarTop"><div><p className="eyebrow">KALENDAR</p><h1>{new Intl.DateTimeFormat("sr-RS",{month:"long",year:"numeric"}).format(month)}</h1></div><div><button className="iconBtn" onClick={()=>setMonth(new Date(y,m-1,1))}>‹</button><button className="iconBtn" onClick={()=>setMonth(new Date(y,m+1,1))}>›</button></div></div><div className="calendar"><div className="weekdays">{["Pon","Uto","Sre","Čet","Pet","Sub","Ned"].map(x=><span key={x}>{x}</span>)}</div><div className="days">{cells.map((d,i)=>{const ts=d&&tests.filter(t=>{const z=new Date(t.date);return z.getFullYear()===y&&z.getMonth()===m&&z.getDate()===d});return <div className={"day "+(d===new Date().getDate()&&m===new Date().getMonth()&&y===new Date().getFullYear()?"today":"")} key={i}>{d&&<><b>{d}</b>{ts.slice(0,3).map(t=><button key={t.id} className="dayTest" onClick={()=>onEdit(t)}>{t.name}</button>)}</>}</div>})}</div></div></section>
}

function Settings({data,setData,notify}) {
  const [key,setKey]=useState(data.settings.geminiKey);
  const [push,setPush]=useState(typeof Notification !== "undefined" && Notification.permission==="granted");
  const [testingPush,setTestingPush]=useState(false);
  const saveKey=()=>{setData(d=>({...d,settings:{...d.settings,geminiKey:key.trim()}}));notify("Podešavanja su sačuvana.");};

  async function getSubscription(){
    const reg=await navigator.serviceWorker.ready;
    const existing=await reg.pushManager.getSubscription();
    if(existing) return existing;

    const keyResponse=await fetch("/.netlify/functions/register-push");
    if(!keyResponse.ok) throw new Error("Server nije dostupan.");
    const {publicKey}=await keyResponse.json();
    if(!publicKey) throw new Error("VAPID public ključ nije podešen na Netlify-ju.");

    return reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(publicKey)
    });
  }

  async function enablePush(){
    if(!window.isSecureContext) return notify("Obaveštenja zahtevaju HTTPS.");
    if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)) return notify("Ovaj uređaj/pregledač ne podržava web push.");

    try {
      const p=Notification.permission==="granted" ? "granted" : await Notification.requestPermission();
      if(p!=="granted") return notify("Dozvola za obaveštenja nije odobrena.");
      const sub=await getSubscription();
      const res=await fetch("/.netlify/functions/register-push",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          deviceId:deviceId(),
          subscription:sub.toJSON(),
          tests:data.tests,
          timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade"
        })
      });
      if(!res.ok) throw new Error("Registracija obaveštenja nije uspela.");
      setPush(true);
      notify("Obaveštenja su uključena.");
    } catch(e) {
      notify(e.message||"Greška pri uključivanju obaveštenja.");
    }
  }

  async function sendTestNotification(){
    if(testingPush) return;
    setTestingPush(true);
    try {
      if(!window.isSecureContext) throw new Error("Obaveštenja zahtevaju HTTPS.");
      if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)) throw new Error("Ovaj uređaj/pregledač ne podržava web push.");
      if(Notification.permission!=="granted") throw new Error("Prvo uključi obaveštenja.");

      const sub=await getSubscription();
      const res=await fetch("/.netlify/functions/register-push",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          deviceId:deviceId(),
          subscription:sub.toJSON(),
          tests:data.tests,
          timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade",
          test:true
        })
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok || !result.ok) throw new Error(result.error||"Test notifikacija nije poslata.");
      notify("Test notifikacija je poslata. 📱");
    } catch(e) {
      notify(e.message||"Greška pri slanju test notifikacije.");
    } finally {
      setTestingPush(false);
    }
  }

  return <section className="page narrow"><p className="eyebrow">PODEŠAVANJA</p><h1>Podešavanja</h1>
    <div className="settingsCard">
      <div className="setting"><div><h3>Gemini API ključ</h3><p className="muted">Ključ se čuva samo na ovom uređaju. Koristi se za prepoznavanje testova sa slike.</p></div><input className="apiInput" type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="AIza..."/><button className="secondary" onClick={saveKey}>Sačuvaj</button></div>
      <div className="setting"><div><h3>Obaveštenja</h3><p className="muted">{push?"Dozvoljena su na ovom uređaju.":"Uključi podsetnike za testove."}</p></div><button className="primary" onClick={enablePush}>{push?"Obaveštenja uključena":"Uključi obaveštenja"}</button></div>
      {push && <div className="setting"><div><h3>Testiraj obaveštenje</h3><p className="muted">Pošalji odmah jednu probnu push notifikaciju na ovaj uređaj.</p></div><button className="secondary" disabled={testingPush} onClick={sendTestNotification}>{testingPush?"Šaljem…":"Pošalji test notifikaciju"}</button></div>}
      <div className="setting"><div><h3>Podrazumevani podsetnik</h3><p className="muted">Predlog koji se automatski bira pri dodavanju testa.</p></div><select value={data.settings.defaultReminder} onChange={e=>setData(d=>({...d,settings:{...d.settings,defaultReminder:e.target.value}}))}><option value="week">7 dana pre</option><option value="2d">2 dana pre</option><option value="1d">1 dan pre</option></select></div>
    </div>
    <div className="note"><strong>iPhone</strong><p>Za iPhone: otvori sajt u Safari-ju → Share → Add to Home Screen → Open as Web App. Zatim uključi obaveštenja iz aplikacije.</p></div>
  </section>
}

function ImportModal({open,onClose,apiKey,onImported}) {
  const [file,setFile]=useState(null), [busy,setBusy]=useState(false), [error,setError]=useState("");
  if(!open) return null;
  async function run(){
    if(!file) return setError("Izaberi sliku.");
    if(!apiKey) return setError("Prvo unesi Gemini API ključ u Podešavanjima.");
    setBusy(true); setError("");
    try {
      const b64=await toBase64(file);
      const prompt=`Sa slike školskog rasporeda/testova izvuci SVE testove koje možeš pouzdano da pročitaš. Vrati ISKLJUČIVO JSON niz bez markdowna. Svaki element mora imati: name (string), date (ISO lokalni datum/vreme bez vremenske zone, format YYYY-MM-DDTHH:mm), confidence (0-1). Ako vreme nije navedeno, koristi 08:00. Današnji datum je ${new Date().toISOString().slice(0,10)}. Ako je godina očigledna iz datuma ili konteksta, koristi je. Ne izmišljaj testove.`;
      const res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:file.type,data:b64}}]}],generationConfig:{responseMimeType:"application/json"}})});
      if(!res.ok) throw new Error("Gemini nije prihvatio zahtev ("+res.status+").");
      const json=await res.json(); const txt=json.candidates?.[0]?.content?.parts?.[0]?.text||"[]"; const arr=JSON.parse(txt);
      const tests=arr.filter(x=>x.name&&x.date&&new Date(x.date).toString()!=="Invalid Date").map(x=>({id:uid(),name:x.name,date:new Date(x.date).toISOString(),reminders:[{id:"week",type:"relative",label:"7 dana pre"},{id:"2d",type:"relative",label:"2 dana pre"},{id:"1d",type:"relative",label:"1 dan pre"}]}));
      if(!tests.length) throw new Error("Nisam pronašao pouzdane testove na slici.");
      onImported(tests);
    } catch(e){setError(e.message||"Greška pri uvozu.");} finally{setBusy(false);}
  }
  return <div className="modalBack"><div className="modal"><button className="modalClose" onClick={onClose}>×</button><p className="eyebrow">GEMINI UVOZ</p><h2>Uvezi testove sa slike</h2><p className="muted">Slikaj raspored ili list papira sa više testova. Gemini će pokušati da prepozna nazive i datume.</p><label className="drop">{file?<><strong>{file.name}</strong><span>Spremno za obradu</span></>:<><strong>Izaberi fotografiju</strong><span>JPG, PNG ili HEIC koji telefon može da prosledi</span></>}<input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{error&&<div className="error">{error}</div>}<div className="formActions"><button className="secondary" onClick={onClose}>Otkaži</button><button className="primary" disabled={busy} onClick={run}>{busy?"Prepoznajem…":"Prepoznaj testove"}</button></div></div></div>
}
const toBase64=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(",")[1]);r.onerror=reject;r.readAsDataURL(file)});
function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4);const raw=atob((base64String+padding).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}

createRoot(document.getElementById("root")).render(<App/>);
