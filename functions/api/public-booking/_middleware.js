function brandedOrigin(request) {
  const origin = String(request.headers.get("Origin") || "").trim();
  if (!origin) return "";
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (
      url.protocol === "https:" &&
      host.endsWith(".eselram.com") &&
      host !== "eselram.com"
    ) return url.origin;
  } catch {}
  return "";
}

export async function onRequest(context) {
  const origin = brandedOrigin(context.request);

  if (context.request.method === "OPTIONS") {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }
    });
  }

  const response = await context.next();
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
