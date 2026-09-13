const statusBox = document.getElementById("billingStatus");
const planTitle = document.getElementById("planTitle");
const planMessage = document.getElementById("planMessage");
const planName = document.getElementById("planName");
const planStatus = document.getElementById("planStatus");
const renewalLabel = document.getElementById("renewalLabel");
const renewalDate = document.getElementById("renewalDate");
const planPrice = document.getElementById("planPrice");
const cancelNotice = document.getElementById("cancelNotice");
const cancelNoticeText = document.getElementById("cancelNoticeText");
const graceNotice = document.getElementById("graceNotice");
const graceNoticeText = document.getElementById("graceNoticeText");
const invoiceRows = document.getElementById("invoiceRows");
const cancelPanel = document.getElementById("cancelPanel");
const cancelButton = document.getElementById("cancelSubscriptionButton");
const keepButton = document.getElementById("keepSubscriptionButton");
const paymentButton = document.getElementById("updatePaymentButton");

function showStatus(message, isError = false) {
  statusBox.hidden = false;
  statusBox.className = `es-status ${isError ? "error" : "success"}`;
  statusBox.textContent = message;
}
function hideStatus(){ statusBox.hidden = true; }
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}
function fmtDate(value){
  if(!value) return "—";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day:"numeric", month:"short", year:"numeric" }).format(date);
}
function money(amount, currency="gbp") {
  const value = Number(amount || 0) / 100;
  return new Intl.NumberFormat("en-GB", { style:"currency", currency:String(currency || "gbp").toUpperCase() }).format(value);
}
function planLabel(sub){ return sub?.billing_interval === "annual" ? "Eselram Annual" : "Eselram Monthly"; }
function priceLabel(sub){
  if(Number.isFinite(Number(sub?.unit_amount)) && Number(sub.unit_amount) > 0) return `${money(sub.unit_amount, sub.currency)}/${sub.billing_interval === "annual" ? "year" : "month"}`;
  return sub?.billing_interval === "annual" ? "£99/year" : "£9.99/month";
}
function renderInvoices(invoices){
  if(!Array.isArray(invoices) || invoices.length === 0){
    invoiceRows.innerHTML = '<tr><td colspan="5" class="es-billing-empty">No subscription invoices are available yet.</td></tr>';
    return;
  }
  invoiceRows.innerHTML = invoices.map((invoice) => {
    const safeUrl = invoice.hosted_invoice_url && /^https:\/\//i.test(invoice.hosted_invoice_url) ? invoice.hosted_invoice_url : "";
    const link = safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">View</a>` : "—";
    const description = invoice.description || (invoice.billing_reason === "subscription_create" ? "Subscription started" : "Eselram subscription");
    return `<tr><td>${escapeHtml(fmtDate(invoice.created_at))}</td><td>${escapeHtml(description)}</td><td>${escapeHtml(String(invoice.status || "—").replaceAll("_", " "))}</td><td>${escapeHtml(money(invoice.amount_paid ?? invoice.amount_due, invoice.currency))}</td><td>${link}</td></tr>`;
  }).join("");
}
function render(data){
  const sub = data?.subscription;
  if(!sub){
    planTitle.textContent = "Subscription unavailable";
    planMessage.textContent = "This installation is not linked to an Eselram subscription.";
    planName.textContent = "—"; planStatus.textContent = "—"; renewalDate.textContent = "—"; planPrice.textContent = "—";
    paymentButton.hidden = true; cancelPanel.hidden = true; keepButton.hidden = true;
    renderInvoices([]); return;
  }
  const canceled = sub.status === "canceled" || sub.license_status === "suspended";
  const scheduled = sub.cancel_at_period_end === true;
  const grace = sub.status === "grace";
  planTitle.textContent = planLabel(sub);
  planMessage.textContent = canceled ? "This Eselram subscription has ended." : scheduled ? "Your subscription remains active until the end of the paid billing period." : grace ? "Your subscription is in its payment grace period." : "Your Eselram subscription is active.";
  planName.textContent = planLabel(sub);
  planStatus.textContent = sub.status || "unknown";
  planStatus.className = `es-billing-status-pill ${sub.status || ""}`;
  renewalLabel.textContent = scheduled || canceled ? "Ends" : "Renews";
  renewalDate.textContent = fmtDate(sub.current_period_end);
  planPrice.textContent = priceLabel(sub);
  cancelNotice.hidden = !scheduled;
  cancelNoticeText.textContent = scheduled ? `Your subscription is scheduled to end on ${fmtDate(sub.current_period_end)}. You can continue using Eselram until then.` : "";
  graceNotice.hidden = !grace;
  graceNoticeText.textContent = grace ? `Please update your payment method before ${fmtDate(sub.grace_until)} to avoid subscription suspension.` : "";
  keepButton.hidden = !scheduled || canceled;
  cancelPanel.hidden = scheduled || canceled;
  paymentButton.hidden = canceled;
  renderInvoices(data.invoices);
}
async function load(){
  try{
    const response = await fetch("/api/subscription", { cache:"no-store", headers:{ Accept:"application/json" } });
    if(response.status === 401){ location.href = "/auth/login.html"; return; }
    const data = await response.json().catch(()=>({}));
    if(!response.ok || data.ok === false) throw new Error(data.error || "Unable to load subscription details.");
    render(data);
    if(new URL(location.href).searchParams.get("payment_method") === "updated") showStatus("Payment method update completed. Stripe will use your current saved payment method for future charges.");
  }catch(error){
    planTitle.textContent = "Subscription details unavailable";
    planMessage.textContent = error.message || "Unable to load subscription details.";
    showStatus(error.message || "Unable to load subscription details.", true);
  }
}
async function action(path, button, working){
  const original = button.textContent; button.disabled = true; button.textContent = working; hideStatus();
  try{
    const response = await fetch(path, { method:"POST", headers:{ Accept:"application/json" } });
    const data = await response.json().catch(()=>({}));
    if(!response.ok || data.ok === false) throw new Error(data.error || "Unable to update subscription.");
    await load(); return data;
  }catch(error){ showStatus(error.message || "Unable to update subscription.", true); throw error; }
  finally{ button.disabled = false; button.textContent = original; }
}
cancelButton.addEventListener("click", async()=>{
  if(!confirm("Cancel your Eselram subscription at the end of the current paid billing period? You will keep access until then.")) return;
  try{ await action("/api/subscription/cancel", cancelButton, "Scheduling cancellation…"); showStatus("Cancellation scheduled. Eselram will remain available until the end of your paid billing period."); }catch{}
});
keepButton.addEventListener("click", async()=>{
  try{ await action("/api/subscription/resume", keepButton, "Keeping subscription…"); showStatus("Cancellation removed. Your Eselram subscription will continue."); }catch{}
});
paymentButton.addEventListener("click", async()=>{
  const original=paymentButton.textContent; paymentButton.disabled=true; paymentButton.textContent="Opening secure payment update…"; hideStatus();
  try{
    const response=await fetch("/api/subscription/payment-method",{method:"POST",headers:{Accept:"application/json"}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false||!data.url) throw new Error(data.error||"Unable to open the secure payment-method update.");
    location.href=data.url;
  }catch(error){showStatus(error.message||"Unable to open the secure payment-method update.",true);paymentButton.disabled=false;paymentButton.textContent=original;}
});
load();
