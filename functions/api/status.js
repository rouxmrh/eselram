export async function onRequestGet({ env }) {
  try {
    const business = await env.DB
      .prepare(`
        SELECT id, name
        FROM businesses
        LIMIT 1
      `)
      .first();

    return Response.json(
      {
        ok: true,
        installation_required: !business,
        business: business || null
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Eselram status check failed:", error);

    return Response.json(
      {
        ok: false,
        error: "Unable to check the Eselram installation status."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
