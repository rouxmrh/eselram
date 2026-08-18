export async function onRequestGet({ env }) {
  try {
    const installation = await env.DB
      .prepare(`
        SELECT current_step, is_complete
        FROM installer_state
        WHERE id = 1
      `)
      .first();

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
        installation_required:
          !installation || installation.is_complete !== 1,

        installation: {
          current_step:
            installation?.current_step || "welcome",

          is_complete:
            installation?.is_complete === 1
        },

        business: business || null
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error(
      "Eselram status check failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to check the Eselram installation status."
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
