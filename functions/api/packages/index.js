import {
  readSessionToken,
  hashSessionToken
} from "../../../lib/auth.js";

async function getUserContext(request, env) {
  const token = readSessionToken(request);
  if (!token) return null;

  const tokenHash = await hashSessionToken(token);

  return await env.DB
    .prepare(`
      SELECT
        u.id AS user_id,
        u.business_id,
        b.currency
      FROM user_sessions s
      JOIN users u
        ON u.id = s.user_id
      JOIN businesses b
        ON b.id = u.business_id
      WHERE
        s.token_hash = ?
        AND s.revoked_at IS NULL
        AND datetime(s.expires_at) > datetime('now')
        AND u.is_active = 1
      LIMIT 1
    `)
    .bind(tokenHash)
    .first();
}

function unauthorized() {
  return Response.json(
    { ok: false, error: "Authentication required." },
    { status: 401 }
  );
}

function badRequest(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 400 }
  );
}

function notFound(message) {
  return Response.json(
    { ok: false, error: message },
    { status: 404 }
  );
}

async function getCustomerPackage(env, businessId, id) {
  return await env.DB
    .prepare(`
      SELECT
        cp.id,
        cp.customer_id,
        cp.package_template_id,
        cp.service_id,
        cp.name_snapshot,
        cp.sessions_total,
        cp.price_minor,
        cp.status,
        cp.starts_on,
        cp.expires_on,
        cp.notes,
        cp.created_at,

        c.first_name,
        c.last_name,
        c.email,
        c.phone,

        s.name AS service_name,
        s.duration_minutes,

        (
          SELECT COUNT(*)
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE
            cpa.customer_package_id = cp.id
            AND a.status = 'completed'
        ) AS sessions_completed,

        (
          SELECT COUNT(*)
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE
            cpa.customer_package_id = cp.id
            AND a.status IN ('confirmed', 'pending')
        ) AS sessions_booked,

        (
          SELECT COALESCE(
            SUM(
              CASE
                WHEN p.payment_type = 'refund' AND p.status = 'paid'
                  THEN -ABS(p.amount_minor)
                WHEN p.payment_type != 'refund'
                     AND p.status IN ('paid', 'partially_refunded', 'refunded')
                  THEN ABS(p.amount_minor)
                ELSE 0
              END
            ),
            0
          )
          FROM customer_package_payments cpp
          JOIN payments p
            ON p.id = cpp.payment_id
          WHERE cpp.customer_package_id = cp.id
              AND COALESCE(p.payment_method, '') != 'discount'
        ) AS paid_minor,

        (
          SELECT COALESCE(
            SUM(ps.consultation_credit_minor),
            0
          )
          FROM package_sales ps
          WHERE
            ps.business_id = cp.business_id
            AND ps.customer_package_id = cp.id
            AND ps.status = 'paid'
        ) AS consultation_credit_minor

      FROM customer_packages cp

      JOIN customers c
        ON c.id = cp.customer_id

      JOIN services s
        ON s.id = cp.service_id

      WHERE
        cp.id = ?
        AND cp.business_id = ?

      LIMIT 1
    `)
    .bind(id, businessId)
    .first();
}

function enrichPackage(row) {
  if (!row) return null;

  const completed = Number(row.sessions_completed || 0);
  const booked = Number(row.sessions_booked || 0);
  const total = Number(row.sessions_total || 0);
  const paid = Number(row.paid_minor || 0);
  const consultationCredit =
    Number(row.consultation_credit_minor || 0);

  return {
    ...row,
    sessions_completed: completed,
    sessions_booked: booked,
    sessions_remaining: Math.max(total - completed - booked, 0),
    sessions_available_to_book: Math.max(total - completed - booked, 0),
    paid_minor: paid,
    consultation_credit_minor: consultationCredit,
    credited_paid_minor: paid + consultationCredit,
    outstanding_minor: Math.max(
      Number(row.price_minor || 0) -
      paid -
      consultationCredit,
      0
    )
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const url = new URL(request.url);
    const packageId = String(
      url.searchParams.get("customer_package_id") || ""
    ).trim();

    if (packageId) {
      const row = await getCustomerPackage(
        env,
        user.business_id,
        packageId
      );

      if (!row) {
        return notFound("Customer package not found.");
      }

      const appointments = await env.DB
        .prepare(`
          SELECT
            a.id,
            a.start_at,
            a.end_at,
            a.status,
            a.booking_source
          FROM customer_package_appointments cpa
          JOIN appointments a
            ON a.id = cpa.appointment_id
          WHERE cpa.customer_package_id = ?
          ORDER BY datetime(a.start_at) ASC
        `)
        .bind(packageId)
        .all();

      return Response.json({
        ok: true,
        customer_package: enrichPackage(row),
        appointments: appointments.results || []
      });
    }

    const [templates, packages, customers, services, variants] = await Promise.all([
      env.DB
        .prepare(`
          SELECT
            pt.id,
            pt.service_id,
            pt.name,
            pt.description,
            pt.sessions_total,
            pt.price_minor,
            pt.payment_rule,
            pt.deposit_minor,
            pt.validity_days,
            pt.is_active,
            pt.is_public,
            pt.created_at,
            s.name AS service_name
          FROM package_templates pt
          JOIN services s
            ON s.id = pt.service_id
          WHERE pt.business_id = ?
          ORDER BY pt.is_active DESC, pt.name COLLATE NOCASE ASC
        `)
        .bind(user.business_id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            cp.id,
            cp.customer_id,
            cp.package_template_id,
            cp.service_id,
            cp.name_snapshot,
            cp.sessions_total,
            cp.price_minor,
            cp.status,
            cp.starts_on,
            cp.expires_on,
            cp.notes,
            cp.created_at,

            c.first_name,
            c.last_name,
            s.name AS service_name,

            (
              SELECT COUNT(*)
              FROM customer_package_appointments cpa
              JOIN appointments a
                ON a.id = cpa.appointment_id
              WHERE
                cpa.customer_package_id = cp.id
                AND a.status = 'completed'
            ) AS sessions_completed,

            (
              SELECT COUNT(*)
              FROM customer_package_appointments cpa
              JOIN appointments a
                ON a.id = cpa.appointment_id
              WHERE
                cpa.customer_package_id = cp.id
                AND a.status IN ('confirmed', 'pending')
            ) AS sessions_booked,

            (
              SELECT COALESCE(
                SUM(
                  CASE
                    WHEN p.payment_type = 'refund' AND p.status = 'paid'
                      THEN -ABS(p.amount_minor)
                    WHEN p.payment_type != 'refund'
                         AND p.status IN ('paid', 'partially_refunded', 'refunded')
                      THEN ABS(p.amount_minor)
                    ELSE 0
                  END
                ),
                0
              )
              FROM customer_package_payments cpp
              JOIN payments p
                ON p.id = cpp.payment_id
              WHERE cpp.customer_package_id = cp.id
              AND COALESCE(p.payment_method, '') != 'discount'
            ) AS paid_minor,

        (
          SELECT COALESCE(
            SUM(ps.consultation_credit_minor),
            0
          )
          FROM package_sales ps
          WHERE
            ps.business_id = cp.business_id
            AND ps.customer_package_id = cp.id
            AND ps.status = 'paid'
        ) AS consultation_credit_minor

          FROM customer_packages cp

          JOIN customers c
            ON c.id = cp.customer_id

          JOIN services s
            ON s.id = cp.service_id

          WHERE cp.business_id = ?

          ORDER BY
            CASE cp.status
              WHEN 'active' THEN 0
              WHEN 'completed' THEN 1
              ELSE 2
            END,
            datetime(cp.created_at) DESC
        `)
        .bind(user.business_id)
        .all(),

      env.DB
        .prepare(`
          SELECT id, first_name, last_name, email
          FROM customers
          WHERE business_id = ?
          ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
        `)
        .bind(user.business_id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            id,
            name,
            duration_minutes,
            price_minor,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE business_id = ? AND is_active = 1
          ORDER BY sort_order, name COLLATE NOCASE
        `)
        .bind(user.business_id)
        .all(),

      env.DB
        .prepare(`
          SELECT
            pv.id,
            pv.package_template_id,
            pv.service_id,
            pv.name,
            pv.price_minor,
            pv.payment_rule,
            pv.deposit_minor,
            pv.is_active,
            pv.sort_order,
            s.name AS service_name,
            s.requires_consultation,
            s.consultation_service_id,
            s.post_consultation_booking
          FROM package_variants pv
          JOIN services s
            ON s.id = pv.service_id
           AND s.business_id = pv.business_id
          WHERE pv.business_id = ?
          ORDER BY
            pv.package_template_id,
            pv.sort_order,
            pv.name COLLATE NOCASE
        `)
        .bind(user.business_id)
        .all()
    ]);

    return Response.json({
      ok: true,
      currency: user.currency || "GBP",
      templates: templates.results || [],
      customer_packages: (packages.results || []).map(enrichPackage),
      customers: customers.results || [],
      services: services.results || [],
      variants: variants.results || []
    });
  } catch (error) {
    console.error("Packages GET failed:", error);

    return Response.json(
      { ok: false, error: "Unable to load packages." },
      { status: 500 }
    );
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    if (!user) return unauthorized();

    const body = await request.json();
    const action = String(body.action || "").trim();

    if (action === "save_template") {
      const id = String(body.id || "").trim();
      const name = String(body.name || "").trim();
      const description = String(body.description || "").trim();
      const serviceId = String(body.service_id || "").trim();
      const sessionsTotal = Number(body.sessions_total);
      let priceMinor = Number(body.price_minor);
      let depositMinor = Number(body.deposit_minor || 0);
      const validityDays =
        body.validity_days === null ||
        body.validity_days === "" ||
        body.validity_days === undefined
          ? null
          : Number(body.validity_days);

      const variants =
        Array.isArray(body.variants)
          ? body.variants
          : [];

      const paymentRule =
        ["full", "deposit", "pay_later"].includes(
          String(body.payment_rule || "full")
        )
          ? String(body.payment_rule || "full")
          : "full";

      if (!name || !serviceId) {
        return badRequest("Package name and service are required.");
      }

      if (!Number.isInteger(sessionsTotal) || sessionsTotal <= 0) {
        return badRequest("Sessions must be a positive whole number.");
      }

      if (
        validityDays !== null &&
        (!Number.isInteger(validityDays) || validityDays <= 0)
      ) {
        return badRequest("Validity must be a positive number of days.");
      }

      const cleanVariants = [];

      for (let index = 0; index < variants.length; index += 1) {
        const raw = variants[index] || {};
        const variantName = String(raw.name || "").trim();
        const variantServiceId = String(raw.service_id || "").trim();
        const variantPriceMinor = Number(raw.price_minor);
        const variantPaymentRule =
          ["full", "deposit", "pay_later"].includes(
            String(raw.payment_rule || "full")
          )
            ? String(raw.payment_rule || "full")
            : "full";
        const variantDepositMinor =
          variantPaymentRule === "deposit"
            ? Number(raw.deposit_minor || 0)
            : 0;

        if (!variantName || !variantServiceId) {
          return badRequest("Every package variant needs a name and service.");
        }

        if (!Number.isInteger(variantPriceMinor) || variantPriceMinor < 0) {
          return badRequest(`Enter a valid price for variant "${variantName}".`);
        }

        if (
          !Number.isInteger(variantDepositMinor) ||
          variantDepositMinor < 0 ||
          variantDepositMinor > variantPriceMinor
        ) {
          return badRequest(`Enter a valid deposit for variant "${variantName}".`);
        }

        const variantService = await env.DB.prepare(`
          SELECT
            id,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE id = ? AND business_id = ? AND is_active = 1
          LIMIT 1
        `).bind(variantServiceId, user.business_id).first();

        if (!variantService) {
          return badRequest(`Service for variant "${variantName}" was not found.`);
        }

        if (String(variantService.service_type || "standard") === "consultation") {
          return badRequest(`Variant "${variantName}" must use a treatment/service.`);
        }

        cleanVariants.push({
          id: String(raw.id || "").trim() || `pkv_${crypto.randomUUID()}`,
          name: variantName,
          service_id: variantServiceId,
          price_minor: variantPriceMinor,
          payment_rule: variantPaymentRule,
          deposit_minor: variantDepositMinor,
          sort_order: index,
          service: variantService
        });
      }

      if (cleanVariants.length > 0) {
        priceMinor = Math.min(
          ...cleanVariants.map(variant => variant.price_minor)
        );

        depositMinor = Math.min(
          ...cleanVariants.map(variant => variant.deposit_minor)
        );
      } else {
        if (!Number.isInteger(priceMinor) || priceMinor < 0) {
          return badRequest("Enter a valid package price.");
        }

        if (!Number.isInteger(depositMinor) || depositMinor < 0) {
          return badRequest("Enter a valid deposit amount.");
        }

        if (depositMinor > priceMinor) {
          return badRequest("Deposit cannot exceed the package price.");
        }
      }


      const service = await env.DB
        .prepare(`
          SELECT
            id,
            service_type,
            requires_consultation,
            consultation_service_id,
            post_consultation_booking
          FROM services
          WHERE id = ? AND business_id = ?
          LIMIT 1
        `)
        .bind(serviceId, user.business_id)
        .first();

      if (!service) {
        return badRequest("Selected service was not found.");
      }

      if (
        String(
          service.service_type ||
          "standard"
        ) === "consultation"
      ) {
        return badRequest(
          "Packages must be linked to a treatment/service, not to a consultation service."
        );
      }

      const practitionerManaged =
        Number(
          service.requires_consultation ||
          0
        ) === 1 &&
        String(
          service.post_consultation_booking ||
          "client_can_book"
        ) ===
          "practitioner_managed";

      const allVariantsPractitionerManaged =
        cleanVariants.length > 0 &&
        cleanVariants.every(
          variant =>
            Number(variant.service.requires_consultation || 0) === 1 &&
            String(
              variant.service.post_consultation_booking ||
              "client_can_book"
            ) === "practitioner_managed"
        );

      const variantPayLater =
        cleanVariants.some(
          variant =>
            variant.payment_rule === "pay_later"
        );

      const isPublic =
        practitionerManaged ||
        allVariantsPractitionerManaged ||
        paymentRule === "pay_later" ||
        variantPayLater
          ? 0
          : (body.is_public === 1 ? 1 : 0);

      const templateId = id || `pkg_${crypto.randomUUID()}`;

      if (id) {
        const existing = await env.DB
          .prepare(`
            SELECT id
            FROM package_templates
            WHERE id = ? AND business_id = ?
            LIMIT 1
          `)
          .bind(id, user.business_id)
          .first();

        if (!existing) {
          return notFound("Package template not found.");
        }

        await env.DB
          .prepare(`
            UPDATE package_templates
            SET
              name = ?,
              description = ?,
              service_id = ?,
              sessions_total = ?,
              price_minor = ?,
              payment_rule = ?,
              deposit_minor = ?,
              validity_days = ?,
              is_active = ?,
              is_public = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND business_id = ?
          `)
          .bind(
            name,
            description || null,
            serviceId,
            sessionsTotal,
            priceMinor,
            paymentRule,
            paymentRule === "deposit" ? depositMinor : 0,
            validityDays,
            body.is_active === 0 ? 0 : 1,
            isPublic,
            id,
            user.business_id
          )
          .run();
      } else {
        await env.DB
          .prepare(`
            INSERT INTO package_templates (
              id,
              business_id,
              service_id,
              name,
              description,
              sessions_total,
              price_minor,
              payment_rule,
              deposit_minor,
              validity_days,
              is_active,
              is_public
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            templateId,
            user.business_id,
            serviceId,
            name,
            description || null,
            sessionsTotal,
            priceMinor,
            paymentRule,
            paymentRule === "deposit" ? depositMinor : 0,
            validityDays,
            body.is_active === 0 ? 0 : 1,
            isPublic
          )
          .run();
      }

      await env.DB.prepare(`
        DELETE FROM package_variants
        WHERE package_template_id = ? AND business_id = ?
      `).bind(templateId, user.business_id).run();

      for (const variant of cleanVariants) {
        await env.DB.prepare(`
          INSERT INTO package_variants (
            id,
            business_id,
            package_template_id,
            service_id,
            name,
            price_minor,
            payment_rule,
            deposit_minor,
            is_active,
            sort_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `).bind(
          variant.id,
          user.business_id,
          templateId,
          variant.service_id,
          variant.name,
          variant.price_minor,
          variant.payment_rule,
          variant.deposit_minor,
          variant.sort_order
        ).run();
      }

      return Response.json({
        ok: true,
        template: { id: templateId }
      });
    }

    if (
      action ===
        "archive_template" ||
      action ===
        "restore_template"
    ) {
      const id =
        String(
          body.id ||
          ""
        ).trim();

      if (!id) {
        return badRequest(
          "Package template id is required."
        );
      }

      const existing =
        await env.DB
          .prepare(`
            SELECT id
            FROM package_templates
            WHERE
              id = ?
              AND business_id = ?
            LIMIT 1
          `)
          .bind(
            id,
            user.business_id
          )
          .first();

      if (!existing) {
        return notFound(
          "Package template not found."
        );
      }

      const restoring =
        action ===
        "restore_template";

      await env.DB
        .prepare(`
          UPDATE package_templates
          SET
            is_active = ?,
            is_public =
              CASE
                WHEN ? = 0
                  THEN 0
                ELSE is_public
              END,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE
            id = ?
            AND business_id = ?
        `)
        .bind(
          restoring ? 1 : 0,
          restoring ? 1 : 0,
          id,
          user.business_id
        )
        .run();

      return Response.json({
        ok: true
      });
    }


    if (action === "assign") {
      const customerId = String(body.customer_id || "").trim();
      const templateId = String(body.package_template_id || "").trim();
      const variantId = String(body.package_variant_id || "").trim();
      const startsOn = String(body.starts_on || "").trim() || null;
      const notes = String(body.notes || "").trim().slice(0, 1000) || null;

      if (!customerId || !templateId) {
        return badRequest("Customer and package are required.");
      }

      const customer = await env.DB.prepare(`
        SELECT id
        FROM customers
        WHERE id = ? AND business_id = ?
        LIMIT 1
      `).bind(customerId, user.business_id).first();

      if (!customer) {
        return badRequest("Customer not found.");
      }

      const template = await env.DB.prepare(`
        SELECT
          pt.id,
          pt.service_id,
          pt.name,
          pt.sessions_total,
          pt.price_minor,
          pt.validity_days,
          pt.is_active,
          s.requires_consultation
        FROM package_templates pt
        JOIN services s
          ON s.id = pt.service_id
         AND s.business_id = pt.business_id
        WHERE pt.id = ? AND pt.business_id = ?
        LIMIT 1
      `).bind(templateId, user.business_id).first();

      if (!template || Number(template.is_active) !== 1) {
        return badRequest("Package template is unavailable.");
      }

      const variantRows = await env.DB.prepare(`
        SELECT
          pv.id,
          pv.service_id,
          pv.name,
          pv.price_minor,
          pv.deposit_minor,
          s.requires_consultation
        FROM package_variants pv
        JOIN services s
          ON s.id = pv.service_id
         AND s.business_id = pv.business_id
        WHERE
          pv.package_template_id = ?
          AND pv.business_id = ?
          AND pv.is_active = 1
        ORDER BY pv.sort_order, pv.name COLLATE NOCASE
      `).bind(template.id, user.business_id).all();

      const variants = variantRows.results || [];

      if (variants.length > 0 && !variantId) {
        return badRequest("Choose a package variant.");
      }

      const variant =
        variantId
          ? variants.find(item => item.id === variantId)
          : null;

      if (variantId && !variant) {
        return badRequest("Selected package variant is unavailable.");
      }

      const serviceId = variant?.service_id || template.service_id;
      const priceMinor = Number(variant?.price_minor ?? template.price_minor ?? 0);
      const name = variant
        ? `${template.name} · ${variant.name}`
        : template.name;
      const requiresConsultation =
        Number(variant?.requires_consultation ?? template.requires_consultation ?? 0);

      let expiresOn = null;

      if (startsOn && Number(template.validity_days || 0) > 0) {
        const date = new Date(`${startsOn}T12:00:00Z`);
        date.setUTCDate(
          date.getUTCDate() + Number(template.validity_days)
        );
        expiresOn = date.toISOString().slice(0, 10);
      }

      const id = `cpk_${crypto.randomUUID()}`;

      await env.DB.prepare(`
        INSERT INTO customer_packages (
          id,
          business_id,
          customer_id,
          package_template_id,
          package_variant_id,
          service_id,
          name_snapshot,
          sessions_total,
          price_minor,
          status,
          starts_on,
          expires_on,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `).bind(
        id,
        user.business_id,
        customerId,
        template.id,
        variant?.id || null,
        serviceId,
        name,
        template.sessions_total,
        priceMinor,
        startsOn,
        expiresOn,
        notes
      ).run();

      return Response.json({
        ok: true,
        customer_package: { id }
      });
    }

    if (action === "set_status") {
      const id = String(body.id || "").trim();
      const status = String(body.status || "").trim();

      if (!["active", "completed", "cancelled", "expired"].includes(status)) {
        return badRequest("Invalid package status.");
      }

      const existing = await getCustomerPackage(
        env,
        user.business_id,
        id
      );

      if (!existing) {
        return notFound("Customer package not found.");
      }

      await env.DB
        .prepare(`
          UPDATE customer_packages
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND business_id = ?
        `)
        .bind(status, id, user.business_id)
        .run();

      return Response.json({ ok: true });
    }

    return badRequest("Invalid package action.");
  } catch (error) {
    console.error("Packages POST failed:", error);

    return Response.json(
      { ok: false, error: "Unable to save package." },
      { status: 500 }
    );
  }
}
