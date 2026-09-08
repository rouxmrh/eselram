function eselramPublicApiUrl(path) {
  const configured = String(window.__ESELRAM_API_ORIGIN__ || "").trim().replace(/\/+$/, "");
  if (!configured) return path;
  try {
    return new URL(path, `${configured}/`).toString();
  } catch {
    return path;
  }
}
const PUBLIC_CHECKOUT_KEY = "eselram_public_checkout_pending";

// Stripe cancellation completes the provisional-booking cleanup on this page.
// Clear both browser stores so returning to /book/ cannot try to cancel the
// same already-deleted provisional booking a second time.
sessionStorage.removeItem(PUBLIC_CHECKOUT_KEY);
localStorage.removeItem(PUBLIC_CHECKOUT_KEY);

const params = new URLSearchParams(location.search);
const appointmentId = params.get("appointment_id") || "";
const paymentId = params.get("payment_id") || "";

async function init() {
  if (!appointmentId || !paymentId) return;

  try {
    const response = await fetch(eselramPublicApiUrl("/api/public-booking/cancel"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appointment_id: appointmentId, payment_id: paymentId })
    });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to release the booking slot.");
    }

    if (data.paid) {
      document.querySelector("#cancelTitle").textContent = "Your payment was received";
      document.querySelector("#cancelText").textContent = "Stripe has already confirmed payment, so your appointment has not been cancelled. Please contact the business if you need to make a change.";
    }
  } catch (error) {
    const el = document.querySelector("#cancelError");
    el.hidden = false;
    el.textContent = error.message || "Unable to release the booking slot.";
  }
}

document.addEventListener("DOMContentLoaded", init);
