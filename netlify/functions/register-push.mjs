import { getStore } from "@netlify/blobs";
import webpush from "web-push";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const rawSubject = process.env.VAPID_SUBJECT?.trim();
const VAPID_SUBJECT = rawSubject ? (rawSubject.includes(":") ? rawSubject : `mailto:${rawSubject}`) : "mailto:admin@example.com";

export default async (req) => {
  if (req.method === "GET") {
    if (!VAPID_PUBLIC) return Response.json({ error: "VAPID public key nije podešen." }, { status: 500 });
    return Response.json({ publicKey: VAPID_PUBLIC });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return Response.json({ ok:false, error:"VAPID ključevi nisu podešeni na Netlify-ju." }, { status:500 });
    const body = await req.json();
    if (!body.deviceId || !body.subscription) return Response.json({ ok:false, error:"Nedostaju podaci za uređaj." }, { status:400 });

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const store = getStore("testovi-reminders");
    const old = await store.get(`device-${body.deviceId}`, { type:"json" });
    const record = {
      deviceId: body.deviceId,
      subscription: body.subscription,
      tests: Array.isArray(body.tests) ? body.tests : (old?.tests || []),
      timezone: body.timezone || old?.timezone || "Europe/Belgrade",
      sentReminders: old?.sentReminders || {},
      updatedAt: new Date().toISOString()
    };

    if (body.test === true) {
      await webpush.sendNotification(body.subscription, JSON.stringify({
        title:"Testovi",
        body:"Radi! Ovo je probna notifikacija sa Testovi aplikacije. 📚",
        url:"/",
        tag:"testovi-push-test"
      }));
    }

    await store.setJSON(`device-${body.deviceId}`, record);
    return Response.json({ ok:true });
  } catch (e) {
    console.error("register-push error", e);
    return Response.json({ ok:false, error:e?.body || e?.message || "Greška pri registraciji obaveštenja." }, { status:e?.statusCode || 500 });
  }
};
