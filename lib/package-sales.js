export async function finalizePackageSale({
  env,
  session,
  paid
}) {
  const saleId = String(
    session?.metadata?.package_sale_id || ""
  ).trim();

  const businessId = String(
    session?.metadata?.business_id || ""
  ).trim();

  if (!saleId || !businessId) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_metadata"
    };
  }

  const sale = await env.DB.prepare(`
    SELECT
      ps.id,
      ps.customer_id,
      ps.package_template_id,
      ps.payment_id,
      ps.customer_package_id,
      ps.status,
      ps.consultation_credit_minor,
      ps.package_variant_id,
      COALESCE(pv.service_id, pt.service_id) AS service_id,
      CASE
        WHEN pv.id IS NOT NULL
          THEN pt.name || ' · ' || pv.name
        ELSE pt.name
      END AS name,
      pt.sessions_total,
      COALESCE(pv.price_minor, pt.price_minor) AS price_minor,
      pt.validity_days
    FROM package_sales ps
    JOIN package_templates pt
      ON pt.id = ps.package_template_id
    LEFT JOIN package_variants pv
      ON pv.id = ps.package_variant_id
     AND pv.package_template_id = pt.id
    WHERE
      ps.id = ?
      AND ps.business_id = ?
    LIMIT 1
  `).bind(
    saleId,
    businessId
  ).first();

  if (!sale) {
    return {
      ok: false,
      skipped: true,
      reason: "sale_not_found"
    };
  }

  if (!paid) {
    await env.DB.prepare(`
      UPDATE package_sales
      SET
        status = 'failed',
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = ?
        AND business_id = ?
        AND status = 'pending'
    `).bind(
      saleId,
      businessId
    ).run();

    return {
      ok: true,
      paid: false,
      sale_id: saleId
    };
  }

  let customerPackageId =
    String(
      sale.customer_package_id || ""
    ).trim();

  if (!customerPackageId) {
    customerPackageId =
      `cpk_${crypto.randomUUID()}`;

    const validityDays =
      Number(
        sale.validity_days || 0
      );

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
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active',
        date('now'),
        CASE
          WHEN ? > 0
            THEN date('now', '+' || ? || ' days')
          ELSE NULL
        END,
        'Created automatically from paid package sale'
      )
    `).bind(
      customerPackageId,
      businessId,
      sale.customer_id,
      sale.package_template_id,
      sale.package_variant_id || null,
      sale.service_id,
      sale.name,
      sale.sessions_total,
      Math.max(
        0,
        Number(
          sale.price_minor || 0
        )
      ),
      validityDays,
      validityDays
    ).run();
  }

  if (sale.payment_id) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO customer_package_payments (
        customer_package_id,
        payment_id
      )
      VALUES (?, ?)
    `).bind(
      customerPackageId,
      sale.payment_id
    ).run();
  }

  await env.DB.prepare(`
    UPDATE package_sales
    SET
      status = 'paid',
      customer_package_id = ?,
      paid_at =
        COALESCE(
          paid_at,
          CURRENT_TIMESTAMP
        ),
      updated_at =
        CURRENT_TIMESTAMP
    WHERE
      id = ?
      AND business_id = ?
  `).bind(
    customerPackageId,
    saleId,
    businessId
  ).run();

  return {
    ok: true,
    paid: true,
    sale_id: saleId,
    payment_id:
      sale.payment_id || null,
    customer_package_id:
      customerPackageId
  };
}
