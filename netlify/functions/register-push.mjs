import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", {status:405});
  try {
    const body = await req.json();
    if (!body.deviceId || !body.subscription) return new Response("Missing data", {status:400});
    const store = getStore("testovi-reminders");
    await store.setJSON(`device-${body.deviceId}`, {
      deviceId: body.deviceId,
      subscription: body.subscription,
      tests: body.tests || [],
      updatedAt: new Date().toISOString()
    });
    return Response.json({ok:true});
  } catch (e) {
    return Response.json({ok:false,error:e.message},{status:500});
  }
};