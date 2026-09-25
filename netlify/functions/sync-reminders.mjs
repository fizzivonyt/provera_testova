import { getStore } from "@netlify/blobs";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@example.com";

export const config = { schedule: "* * * * *" };

export default async () => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  const store = getStore("testovi-reminders");
  const { blobs=[] } = await store.list();
  const now = Date.now();
  for (const item of blobs) {
    const id = item.key || item;
    const record = await store.get(id, {type:"json"});
    if (!record?.subscription) continue;
    const tests = record.tests || [];
    for (const test of tests) {
      const testAt = new Date(test.date).getTime();
      for (const r of (test.reminders||[])) {
        if (r.type === "relative" && !["week","2d","1d"].includes(r.id)) continue;
        const offset = r.type === "relative" ? ({week:10080, "2d":2880, "1d":1440}[r.id]) : Number(r.offsetMinutes||0);
        let due;
        if (r.type === "relative" && r.id === "week") due = testAt - 7*86400000;
        else if (r.type === "relative" && r.id === "2d") due = testAt - 2*86400000;
        else if (r.type === "relative" && r.id === "1d") due = testAt - 86400000;
        else {
          const [hh,mm] = String(r.time||"14:30").split(":").map(Number);
          const d = new Date(testAt - offset*60000);
          d.setHours(hh,mm,0,0);
          due = d.getTime();
        }
        const dedupe = `${test.id}:${r.id}`;
        const sentKey = `${record.deviceId}:sent:${dedupe}`;
        if (Math.abs(now-due) <= 90000 && !(await store.get(sentKey))) {
          try {
            await webpush.sendNotification(record.subscription, JSON.stringify({
              title: `Test: ${test.name}`,
              body: `Test je ${r.label || "uskoro"}. ${new Intl.DateTimeFormat("sr-RS",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(testAt))}`,
              url: "/",
              tag: dedupe
            }));
            await store.set(sentKey, "1");
          } catch (e) {
            if ([404,410].includes(e.statusCode)) await store.delete(id);
          }
        }
      }
    }
  }
};