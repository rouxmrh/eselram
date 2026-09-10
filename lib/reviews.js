import { getActiveEmailConnection, sendBusinessEmail } from "./email-delivery.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function normaliseHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}
async function setting(env, businessId, key) {
  const row = await env.DB.prepare(`SELECT setting_value FROM business_settings WHERE business_id = ? AND setting_key = ? LIMIT 1`).bind(businessId, key).first();
  return row?.setting_value ?? null;
}
export async function getGoogleReviewUrl(env, businessId) {
  return String(await setting(env, businessId, "reviews.google_url") || "").trim();
}
function reviewHtml({business, branding, customerName, reviewUrl}) {
  const primary = normaliseHex(branding?.primary_colour, "#365178");
  const background = normaliseHex(branding?.background_colour, "#f5f4ef");
  const surface = normaliseHex(branding?.surface_colour, "#ffffff");
  const text = normaliseHex(branding?.text_colour, "#18221f");
  const logoUrl = business.base_url && branding?.logo_data_url ? `${business.base_url}/api/public-branding/logo` : "";
  const logo = logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(business.name)}" style="display:block;max-width:180px;max-height:64px;width:auto;height:auto;margin:0 0 20px;">` : "";
  const footer = branding?.footer_text || `Sent by ${business.name}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:${background};font-family:Arial,sans-serif;color:${text};"><div style="max-width:620px;margin:0 auto;padding:28px 18px;"><div style="background:${surface};border:1px solid rgba(24,34,31,.14);border-radius:18px;padding:30px;">${logo}<div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:${primary};text-transform:uppercase;">${escapeHtml(business.name)}</div><h1 style="margin:10px 0 14px;font-size:28px;line-height:1.15;">We'd love your feedback</h1><p style="margin:0 0 22px;line-height:1.6;color:#66706b;">Hi ${escapeHtml(customerName || "there")}, thank you for choosing ${escapeHtml(business.name)}. If you have a moment, we'd really appreciate you sharing your experience.</p><div style="margin-top:24px;"><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;">Leave a Google review</a><p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#66706b;">If the button above does not work, <a href="${escapeHtml(reviewUrl)}" style="color:${primary};text-decoration:underline;font-weight:600;">open the Google review page</a>.</p></div><p style="margin:22px 0 0;line-height:1.6;">Thank you for your support.</p></div><p style="margin:14px 0 0;text-align:center;color:#7b837f;font-size:12px;">${escapeHtml(footer)}</p></div></body></html>`;
}
function reviewText({businessName, customerName, reviewUrl}) {
  return [`We'd love your feedback`, "", `Hi ${customerName || "there"}, thank you for choosing ${businessName}. If you have a moment, we'd really appreciate you sharing your experience.`, "", "Leave a Google review:", reviewUrl, "", "Thank you for your support.", "", `Sent by ${businessName}`].join("\n");
}
async function businessEmailContext(env, businessId, baseUrl="") {
  const row = await env.DB.prepare(`SELECT b.name,b.email,bb.logo_data_url,bb.primary_colour,bb.background_colour,bb.surface_colour,bb.text_colour,bb.footer_text FROM businesses b LEFT JOIN business_branding bb ON bb.business_id=b.id WHERE b.id=? LIMIT 1`).bind(businessId).first();
  if (!row) return null;
  return {business:{name:row.name || "Your business",email:row.email || "",base_url:String(baseUrl||"").replace(/\/+$/,"")},branding:row};
}
async function deliverReview({env,businessId,recipient,customerName,reviewUrl,appointmentId=null,customerId=null,customerPackageId=null,uniqueKey,baseUrl=""}) {
  const context = await businessEmailContext(env,businessId,baseUrl);
  if (!context) return {ok:false,error:"Business not found."};
  const subject = `How was your experience with ${context.business.name}?`;
  let communicationId = `com_${crypto.randomUUID()}`;
  if (uniqueKey) {
    const insert = await env.DB.prepare(`INSERT OR IGNORE INTO customer_communications (id,business_id,appointment_id,customer_id,customer_package_id,communication_type,recipient,subject,status,provider,unique_key) VALUES (?,?,?,?,?,'google_review_request',?,?,'pending','resend',?)`).bind(communicationId,businessId,appointmentId,customerId,customerPackageId,recipient,subject,uniqueKey).run();
    if (!insert.meta?.changes) return {ok:true,duplicate:true};
  }
  const integration = await getActiveEmailConnection(env,businessId);
  if (integration.error) {
    if (uniqueKey) await env.DB.prepare(`UPDATE customer_communications SET status='failed',error_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(integration.error,communicationId).run();
    return {ok:false,error:integration.error};
  }
  try {
    const delivery = await sendBusinessEmail(env,businessId,{to:recipient,subject,html:reviewHtml({...context,customerName,reviewUrl}),text:reviewText({businessName:context.business.name,customerName,reviewUrl})});
    if (uniqueKey) await env.DB.prepare(`UPDATE customer_communications SET status='sent',provider=?,provider_reference=?,sent_at=CURRENT_TIMESTAMP,error_details=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(delivery?.provider||integration.provider||"resend",delivery?.id||null,communicationId).run();
    return {ok:true,provider_id:delivery?.id||null};
  } catch(error) {
    if (uniqueKey) await env.DB.prepare(`UPDATE customer_communications SET status='failed',error_details=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(String(error?.message||"Unable to send review request.").slice(0,1000),communicationId).run();
    return {ok:false,error:String(error?.message||"Unable to send review request.")};
  }
}
export async function sendReviewRequestForCompletedAppointment({env,businessId,appointmentId,baseUrl=""}) {
  const reviewUrl = await getGoogleReviewUrl(env,businessId);
  if (!reviewUrl) return {ok:true,skipped:true,reason:"no_review_url"};
  const row = await env.DB.prepare(`SELECT a.id,a.customer_id,a.service_id,a.booking_kind,a.status,c.first_name,c.email,s.service_type,cpa.customer_package_id,cp.package_template_id,cpa.linked_at FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN services s ON s.id=a.service_id LEFT JOIN customer_package_appointments cpa ON cpa.appointment_id=a.id LEFT JOIN customer_packages cp ON cp.id=cpa.customer_package_id AND cp.business_id=a.business_id WHERE a.id=? AND a.business_id=? LIMIT 1`).bind(appointmentId,businessId).first();
  if (!row) return {ok:true,skipped:true,reason:"appointment_not_found"};
  if (String(row.status)!=="completed") return {ok:true,skipped:true,reason:"not_completed"};
  if (String(row.booking_kind||"")==="consultation" || String(row.service_type||"")==="consultation") return {ok:true,skipped:true,reason:"consultation"};
  const recipient=String(row.email||"").trim().toLowerCase();
  if (!recipient) return {ok:true,skipped:true,reason:"no_email"};
  let shouldSend=false, sessionNumber=null;
  if (row.customer_package_id && row.package_template_id) {
    let sessions=[]; try { sessions=JSON.parse(await setting(env,businessId,`reviews.package.${row.package_template_id}`)||"[]"); } catch {}
    sessions=(Array.isArray(sessions)?sessions:[]).map(Number).filter(Number.isInteger);
    const seq=await env.DB.prepare(`SELECT COUNT(*) AS n FROM customer_package_appointments cpa2 WHERE cpa2.customer_package_id=? AND (datetime(cpa2.linked_at)<datetime(?) OR (datetime(cpa2.linked_at)=datetime(?) AND cpa2.appointment_id<=?))`).bind(row.customer_package_id,row.linked_at,row.linked_at,appointmentId).first();
    sessionNumber=Math.max(1,Number(seq?.n||1));
    shouldSend=sessions.includes(sessionNumber);
  } else {
    shouldSend=String(await setting(env,businessId,`reviews.service.${row.service_id}`)||"0")==="1";
  }
  if (!shouldSend) return {ok:true,skipped:true,reason:"not_configured",session_number:sessionNumber};
  return deliverReview({env,businessId,recipient,customerName:row.first_name||"there",reviewUrl,appointmentId,customerId:row.customer_id,customerPackageId:row.customer_package_id||null,uniqueKey:`google_review_request:${appointmentId}`,baseUrl});
}
export async function sendReviewTestEmail({env,businessId,recipient,baseUrl=""}) {
  const reviewUrl=await getGoogleReviewUrl(env,businessId);
  if (!reviewUrl) return {ok:false,error:"Add and save a Google review link first."};
  const clean=String(recipient||"").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(clean)) return {ok:false,error:"Enter a valid test email address."};
  return deliverReview({env,businessId,recipient:clean,customerName:"Test customer",reviewUrl,baseUrl});
}
