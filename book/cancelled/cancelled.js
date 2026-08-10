const params = new URLSearchParams(location.search);
const appointmentId = params.get("appointment_id") || "";
const paymentId = params.get("payment_id") || "";

async function init() {
  if (!appointmentId || !paymentId) return;

  try {
    const response = await fetch("/api/public-booking/cancel", {
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
