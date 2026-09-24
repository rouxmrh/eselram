import { getPublicBusiness } from "../../../../lib/public-booking.js";

function clean(value, max = 240) {
  return String(value || "").replace(/[\r\n\t]/g, " ").trim().slice(0, max);
}

const GIF = Uint8Array.from([
  71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,255,255,255,
  33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59
]);

function pixel() {
  return new Response(GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache"
    }
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const stage = clean(url.searchParams.get("stage"), 80);
    if (!stage) return pixel();

    let businessId = null;
    try {
      const business = await getPublicBusiness(env);
      businessId = business?.id || null;
    } catch {}

    await env.DB.prepare(`
      INSERT INTO public_booking_diagnostics
        (id, business_id, stage, detail, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      `pbd_${crypto.randomUUID()}`,
      businessId,
      stage,
      clean(url.searchParams.get("detail"), 240) || null,
      clean(request.headers.get("User-Agent"), 500) || null
    ).run();
  } catch (error) {
    console.error("Public booking diagnostic write failed", error);
  }
  return pixel();
}
