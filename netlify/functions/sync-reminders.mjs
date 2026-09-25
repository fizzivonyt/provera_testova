import { getStore } from "@netlify/blobs";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const rawSubject = process.env.VAPID_SUBJECT?.trim();
const VAPID_SUBJECT = rawSubject ? (rawSubject.includes(":") ? rawSubject : `mailto:${rawSubject}`) : "mailto:admin@example.com";

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return {year:Number(get("year")),month:Number(get("month")),day:Number(get("day")),hour:Number(get("hour")),minute:Number(get("minute"))};
}
function offsetMinutesForZone(date,timeZone){
  const p=partsInZone(date,timeZone);
  const asUTC=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
  return Math.round((asUTC-date.getTime())/60000);
}
function localDateTimeToUTC({year,month,day,hour,minute},timeZone){
  let guess=Date.UTC(year,month-1,day,hour,minute);
  for(let i=0;i<3;i++){const offset=offsetMinutesForZone(new Date(guess),timeZone);guess=Date.UTC(year,month-1,day,hour,minute)-offset*60000;}
  return new Date(guess);
}
function addDaysToCalendar({year,month,day},delta){const d=new Date(Date.UTC(year,month-1,day));d.setUTCDate(d.getUTCDate()+delta);return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};}
function reminderTarget(test,reminder,timeZone){
  const testDate=new Date(test.date);
  if(Number.isNaN(testDate.getTime())) return null;
  if(reminder.type==="relative"){
    const days=reminder.id==="week"?7:reminder.id==="2d"?2:reminder.id==="1d"?1:null;
    return days?new Date(testDate.getTime()-days*86400000):null;
  }
  if(reminder.type==="custom"){
    const amount=Number(reminder.amount); if(!Number.isFinite(amount)||amount<=0)return null;
    if(reminder.unit==="sati") return new Date(testDate.getTime()-amount*3600000);
    const local=partsInZone(testDate,timeZone); const cal=addDaysToCalendar(local,-amount);
    const [hour,minute]=String(reminder.time||"14:30").split(":").map(Number);
    if(!Number.isFinite(hour)||!Number.isFinite(minute))return null;
    return localDateTimeToUTC({...cal,hour,minute},timeZone);
  }
  return null;
}

export default async () => {
  if(!VAPID_PUBLIC||!VAPID_PRIVATE){console.error("VAPID keys nisu podešeni.");return;}
  webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC,VAPID_PRIVATE);
  const store=getStore("testovi-reminders");
  const {blobs}=await store.list();
  const now=Date.now();
  let sent=0;

  for(const blob of blobs){
    if(!blob.key.startsWith("device-"))continue;
    const record=await store.get(blob.key,{type:"json"});
    if(!record?.subscription||!Array.isArray(record.tests))continue;
    const timeZone=record.timezone||"Europe/Belgrade";
    const sentReminders=record.sentReminders||{};
    let changed=false;
    let subscriptionDead=false;

    for(const test of record.tests){
      if(!test?.id||!test?.date||!Array.isArray(test.reminders))continue;
      const testDate=new Date(test.date);
      if(Number.isNaN(testDate.getTime())||testDate.getTime()<=now)continue;
      for(const reminder of test.reminders){
        const target=reminderTarget(test,reminder,timeZone); if(!target)continue;
        const key=`${test.id}:${reminder.id}`; const diff=now-target.getTime();
        if(diff<0||diff>=2*60000||sentReminders[key])continue;
        try{
          await webpush.sendNotification(record.subscription,JSON.stringify({
            title:"Podsetnik za test 📚",
            body:`${test.name} — ${new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone}).format(testDate)}`,
            url:"/", tag:`test-reminder-${key}`
          }));
          sentReminders[key]=new Date().toISOString(); changed=true; sent++;
        }catch(e){
          console.error(`Push nije poslat za ${blob.key}`,e);
          if(e?.statusCode===404||e?.statusCode===410){subscriptionDead=true;break;}
        }
      }
      if(subscriptionDead)break;
    }
    if(subscriptionDead){await store.delete(blob.key);continue;}
    if(changed)await store.setJSON(blob.key,{...record,sentReminders,updatedAt:new Date().toISOString()});
  }
  console.log(`Reminder scheduler: poslato ${sent} notifikacija.`);
};

export const config={schedule:"* * * * *"};
