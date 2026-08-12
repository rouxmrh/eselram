const params = new URLSearchParams(location.search);
const saleId = params.get("sale_id");

async function check(attempt = 0) {
  if (!saleId) {
    document.querySelector("#title").textContent = "Purchase not found";
    document.querySelector("#message").textContent = "The package purchase reference is missing.";
    return;
  }

  try {
    const response = await fetch(
      `/api/public-packages/status?sale_id=${encodeURIComponent(saleId)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    const data = await response.json();

    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to check purchase.");

    if (data.sale.status === "paid") {
      document.querySelector("#title").textContent = "Package purchased";
      document.querySelector("#message").textContent =
        `${data.sale.package_name} has been added to your customer record.`;
      return;
    }

    if (data.sale.status === "failed" || data.sale.status === "cancelled") {
      document.querySelector("#title").textContent = "Payment not completed";
      document.querySelector("#message").textContent =
        "Your package has not been activated.";
      return;
    }

    if (attempt < 10) {
      setTimeout(() => check(attempt + 1), 1500);
      return;
    }

    document.querySelector("#title").textContent = "Payment is processing";
    document.querySelector("#message").textContent =
      "Your payment is still being confirmed. The package will appear once confirmation is received.";
  } catch (error) {
    document.querySelector("#title").textContent = "Checking payment";
    document.querySelector("#message").textContent = error.message;
  }
}
check();
