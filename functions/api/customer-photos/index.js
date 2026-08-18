import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

async function getUserContext(
  request,
  env
) {
  const token =
    readSessionToken(request);

  if (!token) {
    return null;
  }

  const tokenHash =
    await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id

      FROM user_sessions s

      JOIN users u
        ON u.id = s.user_id

      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) >
            datetime('now')
        AND u.is_active = 1

      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}

function unauthorized() {
  return Response.json(
    {
      ok: false,
      error:
        "Authentication required."
    },
    {
      status: 401
    }
  );
}

function badRequest(message) {
  return Response.json(
    {
      ok: false,
      error: message
    },
    {
      status: 400
    }
  );
}

function storageUnavailable() {
  return Response.json(
    {
      ok: false,
      error:
        "Photo storage is not configured. Add the buyer-owned FORM_UPLOADS R2 binding to this installation."
    },
    {
      status: 503
    }
  );
}

async function detectImageMime(
  file
) {
  const head =
    new Uint8Array(
      await file
        .slice(
          0,
          16
        )
        .arrayBuffer()
    );

  if (
    head.length >= 3 &&
    head[0] === 0xff &&
    head[1] === 0xd8 &&
    head[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}


async function getPhoto({
  env,
  businessId,
  photoId
}) {
  return await env.DB
    .prepare(`
      SELECT
        p.*,
        s.name AS service_name,
        a.start_at AS appointment_start_at

      FROM customer_photos p

      LEFT JOIN services s
        ON s.id = p.service_id

      LEFT JOIN appointments a
        ON a.id = p.appointment_id

      WHERE
        p.id = ?
        AND p.business_id = ?

      LIMIT 1
    `)
    .bind(
      photoId,
      businessId
    )
    .first();
}

export async function onRequestGet({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return unauthorized();
    }

    const url =
      new URL(request.url);

    const photoId =
      String(
        url.searchParams.get(
          "photo_id"
        ) ||
        ""
      ).trim();

    const customerId =
      String(
        url.searchParams.get(
          "customer_id"
        ) ||
        ""
      ).trim();

    const content =
      url.searchParams.get(
        "content"
      ) === "1";

    if (photoId && content) {
      if (!env.FORM_UPLOADS) {
        return storageUnavailable();
      }

      const photo =
        await getPhoto({
          env,
          businessId:
            user.business_id,
          photoId
        });

      if (!photo) {
        return new Response(
          "Photo not found",
          {
            status: 404
          }
        );
      }

      const object =
        await env.FORM_UPLOADS.get(
          photo.storage_key
        );

      if (!object) {
        return new Response(
          "Stored photo not found",
          {
            status: 404
          }
        );
      }

      const headers =
        new Headers();

      headers.set(
        "Content-Type",
        photo.mime_type ||
        object.httpMetadata
          ?.contentType ||
        "application/octet-stream"
      );

      headers.set(
        "Cache-Control",
        "private, max-age=300"
      );

      headers.set(
        "Content-Disposition",
        `inline; filename="${String(
          photo.original_name ||
          "photo"
        ).replaceAll('"', "")}"`
      );

      return new Response(
        object.body,
        {
          headers
        }
      );
    }

    if (!customerId) {
      return badRequest(
        "customer_id is required."
      );
    }

    const customer =
      await env.DB
        .prepare(`
          SELECT id
          FROM customers
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `)
        .bind(
          customerId,
          user.business_id
        )
        .first();

    if (!customer) {
      return Response.json(
        {
          ok: false,
          error:
            "Customer not found."
        },
        {
          status: 404
        }
      );
    }

    const rows =
      await env.DB
        .prepare(`
          SELECT
            p.id,
            p.customer_id,
            p.appointment_id,
            p.service_id,
            p.treatment_record_id,
            p.photo_type,
            p.original_name,
            p.mime_type,
            p.size_bytes,
            p.taken_at,
            p.notes,
            p.created_at,

            s.name AS service_name,
            a.start_at AS appointment_start_at

          FROM customer_photos p

          LEFT JOIN services s
            ON s.id =
               p.service_id

          LEFT JOIN appointments a
            ON a.id =
               p.appointment_id

          WHERE
            p.business_id = ?
            AND p.customer_id = ?

          ORDER BY
            COALESCE(
              p.taken_at,
              p.created_at
            ) DESC
        `)
        .bind(
          user.business_id,
          customerId
        )
        .all();

    return Response.json({
      ok: true,

      photos:
        (
          rows.results ||
          []
        ).map(
          (photo) => ({
            ...photo,
            content_url:
              `/api/customer-photos?photo_id=${encodeURIComponent(
                photo.id
              )}&content=1`
          })
        )
    });
  } catch (error) {
    console.error(
      "Customer photos GET failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to load customer photos."
      },
      {
        status: 500
      }
    );
  }
}

export async function onRequestPost({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return unauthorized();
    }

    if (!env.FORM_UPLOADS) {
      return storageUnavailable();
    }

    const form =
      await request.formData();

    const customerId =
      String(
        form.get(
          "customer_id"
        ) ||
        ""
      ).trim();

    let appointmentId =
      String(
        form.get(
          "appointment_id"
        ) ||
        ""
      ).trim() ||
      null;

    const treatmentRecordId =
      String(
        form.get(
          "treatment_record_id"
        ) ||
        ""
      ).trim() ||
      null;

    const photoType =
      String(
        form.get(
          "photo_type"
        ) ||
        "other"
      ).trim();

    const takenAt =
      String(
        form.get(
          "taken_at"
        ) ||
        ""
      ).trim() ||
      null;

    const notes =
      String(
        form.get(
          "notes"
        ) ||
        ""
      )
        .trim()
        .slice(0, 1000) ||
      null;

    const file =
      form.get(
        "photo"
      );

    const validTypes = [
      "before",
      "after",
      "progress",
      "consultation",
      "patch_test",
      "other"
    ];

    if (
      !customerId
    ) {
      return badRequest(
        "Customer is required."
      );
    }

    if (
      !validTypes.includes(
        photoType
      )
    ) {
      return badRequest(
        "Invalid photo type."
      );
    }

    if (
      !file ||
      typeof file.arrayBuffer !==
        "function"
    ) {
      return badRequest(
        "Choose a photo to upload."
      );
    }

    if (
      file.size <= 0
    ) {
      return badRequest(
        "The selected photo is empty."
      );
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      return badRequest(
        "Photo must be 10 MB or smaller after optimisation."
      );
    }

    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    const detectedMimeType =
      await detectImageMime(
        file
      );

    if (
      !detectedMimeType ||
      !validMimeTypes.includes(
        detectedMimeType
      )
    ) {
      return badRequest(
        "Photo content must be a genuine JPG, PNG or WebP image."
      );
    }

    if (
      file.type &&
      !validMimeTypes.includes(
        file.type
      )
    ) {
      return badRequest(
        "Photo must be JPG, PNG or WebP."
      );
    }

    const safeMimeType =
      detectedMimeType;

    const customer =
      await env.DB
        .prepare(`
          SELECT id
          FROM customers
          WHERE
            id = ?
            AND business_id = ?
          LIMIT 1
        `)
        .bind(
          customerId,
          user.business_id
        )
        .first();

    if (!customer) {
      return badRequest(
        "Customer not found."
      );
    }

    let serviceId = null;

    if (appointmentId) {
      const appointment =
        await env.DB
          .prepare(`
            SELECT
              id,
              customer_id,
              service_id

            FROM appointments

            WHERE
              id = ?
              AND business_id = ?

            LIMIT 1
          `)
          .bind(
            appointmentId,
            user.business_id
          )
          .first();

      if (
        !appointment ||
        appointment.customer_id !==
          customerId
      ) {
        return badRequest(
          "Appointment does not belong to this customer."
        );
      }

      serviceId =
        appointment.service_id ||
        null;
    }

    if (treatmentRecordId) {
      const treatment =
        await env.DB
          .prepare(`
            SELECT
              id,
              customer_id,
              appointment_id,
              service_id

            FROM treatment_records

            WHERE
              id = ?
              AND business_id = ?

            LIMIT 1
          `)
          .bind(
            treatmentRecordId,
            user.business_id
          )
          .first();

      if (
        !treatment ||
        treatment.customer_id !==
          customerId
      ) {
        return badRequest(
          "Treatment record does not belong to this customer."
        );
      }

      if (
        appointmentId &&
        treatment.appointment_id &&
        treatment.appointment_id !==
          appointmentId
      ) {
        return badRequest(
          "The selected appointment and treatment record are unrelated. Choose matching records."
        );
      }

      if (
        serviceId &&
        treatment.service_id &&
        serviceId !==
          treatment.service_id
      ) {
        return badRequest(
          "The selected appointment and treatment record belong to different services."
        );
      }

      if (
        !appointmentId &&
        treatment.appointment_id
      ) {
        appointmentId =
          treatment.appointment_id;
      }

      serviceId =
        treatment.service_id ||
        serviceId;
    }

    const safeName =
      String(
        file.name ||
        "photo"
      )
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "_"
        )
        .slice(
          0,
          100
        );

    const photoId =
      `cph_${crypto.randomUUID()}`;

    const storageKey =
      `${user.business_id}/customer-photos/${customerId}/${photoId}-${safeName}`;

    await env.FORM_UPLOADS.put(
      storageKey,
      await file.arrayBuffer(),
      {
        httpMetadata: {
          contentType:
            safeMimeType
        }
      }
    );

    try {
      await env.DB
        .prepare(`
          INSERT INTO customer_photos (
            id,
            business_id,
            customer_id,
            appointment_id,
            service_id,
            treatment_record_id,
            photo_type,
            storage_provider,
            storage_key,
            original_name,
            mime_type,
            size_bytes,
            taken_at,
            notes,
            uploaded_by_user_id
          )
          VALUES (
            ?, ?, ?, ?, ?, ?,
            ?,
            'r2',
            ?, ?, ?, ?,
            ?, ?, ?
          )
        `)
        .bind(
          photoId,
          user.business_id,
          customerId,
          appointmentId,
          serviceId,
          treatmentRecordId,
          photoType,
          storageKey,
          file.name ||
          safeName,
          safeMimeType,
          file.size,
          takenAt,
          notes,
          user.user_id
        )
        .run();
    } catch (error) {
      await env.FORM_UPLOADS.delete(
        storageKey
      );

      throw error;
    }

    return Response.json({
      ok: true,
      photo_id:
        photoId
    });
  } catch (error) {
    console.error(
      "Customer photo upload failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to upload customer photo."
      },
      {
        status: 500
      }
    );
  }
}

export async function onRequestDelete({
  request,
  env
}) {
  try {
    const user =
      await getUserContext(
        request,
        env
      );

    if (!user) {
      return unauthorized();
    }

    const body =
      await request.json();

    const photoId =
      String(
        body.photo_id ||
        ""
      ).trim();

    if (!photoId) {
      return badRequest(
        "photo_id is required."
      );
    }

    const photo =
      await getPhoto({
        env,
        businessId:
          user.business_id,
        photoId
      });

    if (!photo) {
      return Response.json(
        {
          ok: false,
          error:
            "Photo not found."
        },
        {
          status: 404
        }
      );
    }

    await env.DB
      .prepare(`
        DELETE FROM customer_photos
        WHERE
          id = ?
          AND business_id = ?
      `)
      .bind(
        photoId,
        user.business_id
      )
      .run();

    if (
      env.FORM_UPLOADS &&
      photo.storage_key
    ) {
      try {
        await env.FORM_UPLOADS.delete(
          photo.storage_key
        );
      } catch (error) {
        console.error(
          "Unable to delete customer photo object:",
          error
        );
      }
    }

    return Response.json({
      ok: true
    });
  } catch (error) {
    console.error(
      "Customer photo delete failed:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          "Unable to delete customer photo."
      },
      {
        status: 500
      }
    );
  }
}
