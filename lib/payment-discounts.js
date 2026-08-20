const VOUCHER_SETTING_KEY = "payment_vouchers";

function cleanCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function getPaymentVouchers(env, businessId) {
  const row = await env.DB.prepare(`
    SELECT setting_value
    FROM business_settings
    WHERE business_id = ? AND setting_key = ?
    LIMIT 1
  `).bind(businessId, VOUCHER_SETTING_KEY).first();

  if (!row?.setting_value) return [];

  try {
    const parsed = JSON.parse(row.setting_value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePaymentVouchers(env, businessId, vouchers) {
  const cleaned = (Array.isArray(vouchers) ? vouchers : []).map(item => ({
    id: String(item.id || `vch_${crypto.randomUUID()}`),
    code: cleanCode(item.code),
    name: String(item.name || item.code || "Voucher").trim().slice(0, 80),
    discount_type: item.discount_type === "percent" ? "percent" : "amount",
    value: Math.max(0, Number(item.value || 0)),
    is_active: item.is_active !== false
  })).filter(item => item.code && item.value > 0);

  const seen = new Set();
  for (const item of cleaned) {
    if (seen.has(item.code)) {
      throw new Error(`Voucher code ${item.code} is duplicated.`);
    }
    seen.add(item.code);
    if (item.discount_type === "percent" && item.value > 100) {
      throw new Error(`Voucher ${item.code} cannot exceed 100%.`);
    }
  }

  await env.DB.prepare(`
    INSERT INTO business_settings (
      id, business_id, setting_key, setting_value, value_type
    ) VALUES (?, ?, ?, ?, 'json')
    ON CONFLICT(business_id, setting_key)
    DO UPDATE SET
      setting_value = excluded.setting_value,
      value_type = 'json',
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    `set_${crypto.randomUUID()}`,
    businessId,
    VOUCHER_SETTING_KEY,
    JSON.stringify(cleaned)
  ).run();

  return cleaned;
}

export async function calculatePaymentDeduction({
  env,
  businessId,
  baseAmountMinor,
  deduction
}) {
  const base = Math.max(0, Math.round(Number(baseAmountMinor || 0)));
  const raw = deduction && typeof deduction === "object" ? deduction : {};
  const type = String(raw.type || "none").trim().toLowerCase();

  if (!base || type === "none" || !type) {
    return { discountMinor: 0, type: "none", label: "", voucher: null };
  }

  let discountMinor = 0;
  let label = "";
  let voucher = null;

  if (type === "amount") {
    discountMinor = Math.max(0, Math.round(Number(raw.amount_minor || 0)));
    label = raw.label ? String(raw.label).trim().slice(0, 120) : "Manual deduction";
  } else if (type === "percent") {
    const percent = Number(raw.percent || 0);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new Error("Enter a discount percentage between 0 and 100.");
    }
    discountMinor = Math.round(base * percent / 100);
    label = `${percent}% discount`;
  } else if (type === "voucher") {
    const vouchers = await getPaymentVouchers(env, businessId);
    const voucherId = String(raw.voucher_id || "").trim();
    const voucherCode = cleanCode(raw.voucher_code);
    voucher = vouchers.find(item =>
      item.is_active !== false &&
      ((voucherId && item.id === voucherId) || (voucherCode && cleanCode(item.code) === voucherCode))
    );

    if (!voucher) {
      throw new Error("Choose an active voucher.");
    }

    if (voucher.discount_type === "percent") {
      discountMinor = Math.round(base * Number(voucher.value || 0) / 100);
      label = `${voucher.code} · ${voucher.value}% voucher`;
    } else {
      discountMinor = Math.round(Number(voucher.value || 0) * 100);
      label = `${voucher.code} · voucher`;
    }
  } else {
    throw new Error("Choose a valid deduction type.");
  }

  discountMinor = Math.min(discountMinor, base);

  if (discountMinor <= 0) {
    return { discountMinor: 0, type: "none", label: "", voucher: null };
  }

  if (discountMinor >= base) {
    throw new Error("The deduction must leave an amount to collect. For a fully discounted balance, record it manually instead.");
  }

  return { discountMinor, type, label, voucher };
}

export async function createDiscountAdjustment({
  env,
  businessId,
  paymentId,
  appointmentId = null,
  customerId,
  customerPackageId = null,
  paymentType,
  currency,
  discountMinor,
  deductionType,
  label,
  voucher = null,
  status = "pending"
}) {
  if (!discountMinor) return null;

  const id = `pay_${crypto.randomUUID()}`;
  const notes = [
    `Discount adjustment for payment=${paymentId}`,
    `source=${deductionType}`,
    voucher?.code ? `voucher=${cleanCode(voucher.code)}` : "",
    label ? `label=${String(label).replace(/[\r\n]+/g, " ")}` : ""
  ].filter(Boolean).join(" · ");

  await env.DB.prepare(`
    INSERT INTO payments (
      id, business_id, appointment_id, customer_id, provider,
      payment_type, amount_minor, currency, status,
      payment_method, notes, paid_at
    ) VALUES (?, ?, ?, ?, 'none', ?, ?, ?, ?, 'discount', ?,
      CASE WHEN ? = 'paid' THEN CURRENT_TIMESTAMP ELSE NULL END)
  `).bind(
    id, businessId, appointmentId || null, customerId,
    paymentType, discountMinor, String(currency || "GBP").toUpperCase(), status,
    notes, status
  ).run();

  if (customerPackageId) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO customer_package_payments (
        customer_package_id, payment_id
      ) VALUES (?, ?)
    `).bind(customerPackageId, id).run();
  }

  return id;
}

export async function setDiscountAdjustmentStatus({ env, businessId, paymentId, status, customerPackageId = null }) {
  const notesMatch = `Discount adjustment for payment=${paymentId}%`;
  await env.DB.prepare(`
    UPDATE payments
    SET
      status = ?,
      paid_at = CASE WHEN ? = 'paid' THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
      updated_at = CURRENT_TIMESTAMP
    WHERE business_id = ?
      AND provider = 'none'
      AND payment_method = 'discount'
      AND notes LIKE ?
      AND status IN ('pending','paid')
  `).bind(status, status, businessId, notesMatch).run();

  if (status === "paid" && customerPackageId) {
    const rows = await env.DB.prepare(`
      SELECT id FROM payments
      WHERE business_id = ?
        AND provider = 'none'
        AND payment_method = 'discount'
        AND notes LIKE ?
    `).bind(businessId, notesMatch).all();
    for (const row of rows.results || []) {
      await env.DB.prepare(`
        INSERT OR IGNORE INTO customer_package_payments (customer_package_id, payment_id)
        VALUES (?, ?)
      `).bind(customerPackageId, row.id).run();
    }
  }
}

export function discountSummaryFromNotes(notes) {
  const text = String(notes || "");
  const voucher = text.match(/voucher=([^·]+)/)?.[1]?.trim() || "";
  const label = text.match(/label=([^·]+)/)?.[1]?.trim() || "";
  return { voucher, label };
}
