import { decryptIntegrationSecret } from "./integration-crypto.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function normaliseHex(value, fallback) {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}
function parseJson(value, fallback = {}) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function formatAppointment(value) {
  if (!value) return "";
  const local = String(value).replace(" ", "T");
  const [datePart,timePart=""] = local.split("T");
  const [year,month,day] = datePart.split("-").map(Number);
  const [hour,minute] = timePart.split(":").map(Number);
  try {
    const synthetic = new Date(Date.UTC(year,month-1,day,hour||0,minute||0));
    return new Intl.DateTimeFormat("en-GB", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(synthetic);
  } catch { return String(value); }
}
async function getEmailIntegration(env,businessId) {
  const integration = await env.DB.prepare(`SELECT encrypted_credentials,config_json,status FROM business_integrations WHERE business_id = ? AND integration_type = 'email' AND provider = 'resend' LIMIT 1`).bind(businessId).first();
  if (!integration?.encrypted_credentials) return {error:"Email is not configured. Connect the business's own Resend account in Settings → Email."};
  if (!String(env.ESELRAM_ENCRYPTION_KEY||"").trim()) return {error:"This Eselram installation is missing ESELRAM_ENCRYPTION_KEY."};
  let credentials={}, config={};
  try {
    credentials = parseJson(await decryptIntegrationSecret(integration.encrypted_credentials, env.ESELRAM_ENCRYPTION_KEY), {});
    config = parseJson(integration.config_json, {});
  } catch { return {error:"The saved email integration could not be read. Reconnect it in Settings → Email."}; }
  const apiKey=String(credentials.api_key||"").trim(), fromName=String(config.from_name||"").trim(), fromEmail=String(config.from_email||"").trim();
  if (!apiKey||!fromName||!fromEmail) return {error:"Email integration is incomplete. Check Settings → Email."};
  return {apiKey,fromName,fromEmail};
}
async function getContext(env,businessId,formRequestId) {
  return await env.DB.prepare(`
    SELECT r.id,r.business_id,r.template_id,r.customer_id,r.appointment_id,r.request_token,r.status,r.expires_at,r.email_status,r.email_send_count,
      t.name AS template_name,t.template_type,t.is_client_sendable,
      c.first_name,c.last_name,c.email AS customer_email,
      b.name AS business_name,b.email AS business_email,
      bb.logo_data_url,bb.primary_colour,bb.background_colour,bb.surface_colour,bb.text_colour,bb.footer_text,
      a.start_at AS appointment_start_at,s.name AS service_name
    FROM clinical_form_requests r
    JOIN clinical_templates t ON t.id=r.template_id
    JOIN customers c ON c.id=r.customer_id
    JOIN businesses b ON b.id=r.business_id
    LEFT JOIN business_branding bb ON bb.business_id=r.business_id
    LEFT JOIN appointments a ON a.id=r.appointment_id
    LEFT JOIN services s ON s.id=a.service_id
    WHERE r.id=? AND r.business_id=? LIMIT 1`).bind(formRequestId,businessId).first();
}
function buildHtml(row,formUrl) {
  const businessName=escapeHtml(row.business_name||"Your practitioner"), firstName=escapeHtml(row.first_name||"there"), formName=escapeHtml(row.template_name||"Client form");
  const primary=normaliseHex(row.primary_colour,"#365c50"), background=normaliseHex(row.background_colour,"#f5f4ef"), surface=normaliseHex(row.surface_colour,"#ffffff"), text=normaliseHex(row.text_colour,"#18221f");
  const appt=row.appointment_id ? `${escapeHtml(row.service_name||"Appointment")} · ${escapeHtml(formatAppointment(row.appointment_start_at))}` : "";
  const footer=row.footer_text?escapeHtml(row.footer_text):`Sent securely by ${businessName}`;
  const logo=row.logo_data_url?`<img src="${escapeHtml(row.logo_data_url)}" alt="${businessName}" style="max-height:64px;max-width:180px;margin:0 0 20px;">`:"";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${background};font-family:Arial,Helvetica,sans-serif;color:${text};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${background};padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:${surface};border-radius:18px;padding:34px;"><tr><td>${logo}<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${primary};font-weight:700;margin-bottom:10px;">${formName}</div><h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:${text};">Please complete your form</h1><p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${firstName},</p><p style="margin:0 0 18px;font-size:15px;line-height:1.7;">${businessName} has sent you a secure ${formName} to complete before your appointment.</p>${appt?`<p style="margin:0 0 22px;padding:14px 16px;background:${background};border-radius:12px;font-size:14px;line-height:1.6;"><strong>${appt}</strong></p>`:""}<p style="margin:26px 0;"><a href="${escapeHtml(formUrl)}" style="display:inline-block;background:${primary};color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px;">Complete ${formName}</a></p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#66706b;">This link is unique to you and expires after 30 days. Once submitted, it cannot be used again.</p><p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#7b847f;">${footer}</p></td></tr></table></td></tr></table></body></html>`;
}
function buildText(row,formUrl) {
  const appt=row.appointment_id?`\nAppointment: ${row.service_name||"Appointment"} · ${formatAppointment(row.appointment_start_at)}\n`:"";
  return [`Hi ${row.first_name||"there"},`,"",`${row.business_name||"Your practitioner"} has sent you a secure ${row.template_name||"client form"} to complete before your appointment.`,appt,`Complete your form: ${formUrl}`,"","This unique link expires after 30 days and cannot be reused after submission."].join("\n");
}
export async function ensureClientFormRequest({env,businessId,templateId,customerId,appointmentId,createdByUserId=null}) {
  const template=await env.DB.prepare(`SELECT id,name,template_type,is_client_sendable FROM clinical_templates WHERE id=? AND business_id=? AND is_active=1 AND is_published=1 AND is_client_sendable=1 LIMIT 1`).bind(templateId,businessId).first();
  if (!template) return {ok:false,error:"The assigned client form template is unavailable."};
  const existing=await env.DB.prepare(`SELECT id,request_token,status,expires_at,email_status FROM clinical_form_requests WHERE business_id=? AND template_id=? AND customer_id=? AND appointment_id=? AND status IN ('created','opened','submitted') ORDER BY datetime(created_at) DESC LIMIT 1`).bind(businessId,templateId,customerId,appointmentId).first();
  if (existing) {
    if (existing.status==='submitted') return {ok:true,reused:true,completed:true,request:existing};
    const expiry=new Date(String(existing.expires_at||"").replace(" ","T")+"Z").getTime();
    if (expiry>Date.now()) return {ok:true,reused:true,completed:false,request:existing};
  }
  const id=`cfr_${crypto.randomUUID()}`;
  const requestToken=`frq_${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;
  await env.DB.prepare(`INSERT INTO clinical_form_requests (id,business_id,template_id,customer_id,appointment_id,request_token,status,created_by_user_id,expires_at) VALUES (?,?,?,?,?,?,'created',?,datetime('now','+30 days'))`).bind(id,businessId,templateId,customerId,appointmentId,requestToken,createdByUserId).run();
  return {ok:true,reused:false,completed:false,request:{id,request_token:requestToken,status:'created',email_status:'not_sent'}};
}
export async function sendClientFormRequestEmail({env,businessId,formRequestId,baseUrl}) {
  const row=await getContext(env,businessId,formRequestId);
  if (!row) return {ok:false,error:"Form request not found."};
  if (Number(row.is_client_sendable||0)!==1) return {ok:false,error:"This form is not available for clients."};
  if (!['created','opened'].includes(String(row.status||""))) return {ok:true,skipped:true,reason:'inactive'};
  if (row.email_status==='sent') return {ok:true,duplicate:true};
  const email=String(row.customer_email||"").trim();
  if (!email) return {ok:false,error:"This customer does not have an email address."};
  const integration=await getEmailIntegration(env,businessId);
  if (integration.error) return {ok:false,error:integration.error};
  const origin=String(baseUrl||env.ESELRAM_BASE_URL||"").trim().replace(/\/+$/,'');
  if (!origin) return {ok:false,error:"Unable to build the secure client form URL."};
  const formUrl=`${origin}/forms/view.html?request_token=${encodeURIComponent(row.request_token)}`;
  const payload={from:`${integration.fromName} <${integration.fromEmail}>`,to:[email],subject:`${row.business_name} — ${row.template_name}`,html:buildHtml(row,formUrl),text:buildText(row,formUrl)};
  if (row.business_email) payload.reply_to=row.business_email;
  try {
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${integration.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let data={}; try { data=await response.json(); } catch {}
    if (!response.ok) throw new Error(String(data?.message||data?.error||'Email provider rejected the message.'));
    await env.DB.prepare(`UPDATE clinical_form_requests SET email_status='sent',email_to=?,email_sent_at=CURRENT_TIMESTAMP,email_provider_id=?,email_error=NULL,email_send_count=email_send_count+1 WHERE id=? AND business_id=?`).bind(email,String(data?.id||"")||null,formRequestId,businessId).run();
    return {ok:true,provider_id:data?.id||null};
  } catch(error) {
    const msg=String(error?.message||'Unable to send client form email.').slice(0,1000);
    await env.DB.prepare(`UPDATE clinical_form_requests SET email_status='failed',email_to=?,email_error=?,email_send_count=email_send_count+1 WHERE id=? AND business_id=?`).bind(email,msg,formRequestId,businessId).run();
    return {ok:false,error:msg};
  }
}
export async function runServiceFormAutomation({env,businessId,appointmentId,triggerEvent,baseUrl,createdByUserId=null}) {
  const trigger=String(triggerEvent||"").trim();
  if (!['payment_received','booking_confirmed'].includes(trigger)) return {ok:true,created:0,sent:0,skipped:0,failed:0};
  const appointment=await env.DB.prepare(`SELECT id,customer_id,service_id,status FROM appointments WHERE id=? AND business_id=? LIMIT 1`).bind(appointmentId,businessId).first();
  if (!appointment) return {ok:false,error:'Appointment not found.'};
  const rules=await env.DB.prepare(`SELECT r.template_id,t.name AS template_name FROM service_form_rules r JOIN clinical_templates t ON t.id=r.template_id AND t.business_id=r.business_id WHERE r.business_id=? AND r.service_id=? AND r.trigger_event=? AND r.is_active=1 AND t.is_active=1 AND t.is_published=1 AND t.is_client_sendable=1 ORDER BY t.name COLLATE NOCASE ASC`).bind(businessId,appointment.service_id,trigger).all();
  let created=0,sent=0,skipped=0,failed=0;
  for (const rule of rules.results||[]) {
    const req=await ensureClientFormRequest({env,businessId,templateId:rule.template_id,customerId:appointment.customer_id,appointmentId,createdByUserId});
    if (!req.ok) { failed++; console.error('Automatic client form request failed:',appointmentId,rule.template_id,req.error); continue; }
    if (req.completed) { skipped++; continue; }
    if (!req.reused) created++;
    const mail=await sendClientFormRequestEmail({env,businessId,formRequestId:req.request.id,baseUrl});
    if (mail.ok) { if (mail.duplicate||mail.skipped) skipped++; else sent++; }
    else { failed++; console.error('Automatic client form email failed:',appointmentId,rule.template_id,mail.error); }
  }
  return {ok:failed===0,created,sent,skipped,failed};
}
