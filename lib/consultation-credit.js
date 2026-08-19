async function resolveConsultationServiceId({
  env,
  businessId,
  serviceId
}) {
  const row = await env.DB
    .prepare(`
      SELECT
        service_type,
        consultation_service_id
      FROM services
      WHERE
        id = ?
        AND business_id = ?
      LIMIT 1
    `)
    .bind(
      serviceId,
      businessId
    )
    .first();

  if (!row) {
    return serviceId;
  }

  if (
    String(
      row.service_type ||
      "standard"
    ) === "consultation"
  ) {
    return serviceId;
  }

  return (
    row.consultation_service_id ||
    serviceId
  );
}


export async function findAvailableConsultationCredit({
  env,
  businessId,
  customerId,
  serviceId
}) {
  const consultationServiceId =
    await resolveConsultationServiceId({
      env,
      businessId,
      serviceId
    });

  const rows = await env.DB.prepare(`
    SELECT
      a.id AS consultation_appointment_id,
      MAX(
        0,
        COALESCE(
          SUM(
            CASE
              WHEN p.payment_type = 'refund'
                   AND p.status = 'paid'
                THEN -ABS(p.amount_minor)
              WHEN p.payment_type != 'refund'
                   AND p.status IN (
                     'paid',
                     'partially_refunded',
                     'refunded'
                   )
                THEN ABS(p.amount_minor)
              ELSE 0
            END
          ),
          0
        )
      ) AS paid_minor
    FROM appointments a
    LEFT JOIN payments p
      ON p.appointment_id = a.id
     AND p.business_id = a.business_id
    JOIN services consultation_service
      ON consultation_service.id = a.service_id
     AND consultation_service.business_id = a.business_id
    WHERE
      a.business_id = ?
      AND a.customer_id = ?
      AND a.service_id = ?
      AND (
        a.booking_kind = 'consultation'
        OR consultation_service.service_type = 'consultation'
      )
      AND a.status != 'cancelled'
    GROUP BY a.id
    HAVING paid_minor > 0
    ORDER BY datetime(a.start_at) DESC
  `).bind(
    businessId,
    customerId,
    consultationServiceId
  ).all();

  for (const row of rows.results || []) {
    const used = await env.DB.prepare(`
      SELECT 1 AS used
      FROM appointments target
      WHERE
        target.business_id = ?
        AND target.consultation_credit_source_appointment_id = ?
        AND target.status != 'cancelled'

      UNION ALL

      SELECT 1 AS used
      FROM package_sales sale
      WHERE
        sale.business_id = ?
        AND sale.consultation_credit_source_appointment_id = ?
        AND sale.status NOT IN ('failed', 'cancelled')

      LIMIT 1
    `).bind(
      businessId,
      row.consultation_appointment_id,
      businessId,
      row.consultation_appointment_id
    ).first();

    if (!used) {
      return {
        source_appointment_id:
          row.consultation_appointment_id,
        available_minor:
          Math.max(
            0,
            Number(row.paid_minor || 0)
          )
      };
    }
  }

  return {
    source_appointment_id: null,
    available_minor: 0
  };
}


export async function hasCompletedConsultation({
  env,
  businessId,
  customerId,
  serviceId
}) {
  const consultationServiceId =
    await resolveConsultationServiceId({
      env,
      businessId,
      serviceId
    });

  const row = await env.DB.prepare(`
    SELECT a.id
    FROM appointments a
    JOIN services consultation_service
      ON consultation_service.id = a.service_id
     AND consultation_service.business_id = a.business_id
    WHERE
      a.business_id = ?
      AND a.customer_id = ?
      AND a.service_id = ?
      AND (
        a.booking_kind = 'consultation'
        OR consultation_service.service_type = 'consultation'
      )
      AND a.status = 'completed'
    ORDER BY datetime(a.start_at) DESC
    LIMIT 1
  `).bind(
    businessId,
    customerId,
    consultationServiceId
  ).first();

  return Boolean(row);
}
