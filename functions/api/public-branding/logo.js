import {
  getPublicBusiness
} from "../../../lib/public-booking.js";


function decodeBase64(value) {
  const binary =
    atob(value);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let index = 0;
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index);
  }

  return bytes;
}


export async function onRequestGet({
  env
}) {
  try {
    const business =
      await getPublicBusiness(env);

    if (!business) {
      return new Response(
        "Not found",
        {
          status: 404
        }
      );
    }

    const row =
      await env.DB.prepare(`
        SELECT logo_data_url
        FROM business_branding
        WHERE business_id = ?
        LIMIT 1
      `).bind(
        business.id
      ).first();

    const value =
      String(
        row?.logo_data_url ||
        ""
      ).trim();

    const match =
      value.match(
        /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i
      );

    if (!match) {
      return new Response(
        "Not found",
        {
          status: 404
        }
      );
    }

    const bytes =
      decodeBase64(
        match[2]
      );

    return new Response(
      bytes,
      {
        status: 200,
        headers: {
          "Content-Type":
            match[1].toLowerCase(),
          "Cache-Control":
            "public, max-age=3600",
          "X-Content-Type-Options":
            "nosniff"
        }
      }
    );
  } catch (error) {
    console.error(
      "Public branding logo failed:",
      error
    );

    return new Response(
      "Not found",
      {
        status: 404
      }
    );
  }
}
