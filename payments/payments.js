const paymentFormPanel =
  document.getElementById(
    "paymentFormPanel"
  );

const paymentForm =
  document.getElementById(
    "paymentForm"
  );

const paymentCustomer =
  document.getElementById(
    "paymentCustomer"
  );

const paymentAppointment =
  document.getElementById(
    "paymentAppointment"
  );

const paymentAmount =
  document.getElementById(
    "paymentAmount"
  );

const paymentType =
  document.getElementById(
    "paymentType"
  );

const paymentProvider =
  document.getElementById(
    "paymentProvider"
  );

const paymentMethod =
  document.getElementById(
    "paymentMethod"
  );

const paymentFormStatus =
  document.getElementById(
    "paymentFormStatus"
  );

const savePaymentButton =
  document.getElementById(
    "savePaymentButton"
  );

const paymentsList =
  document.getElementById(
    "paymentsList"
  );

const paymentSearch =
  document.getElementById(
    "paymentSearch"
  );

const paymentStatusFilter =
  document.getElementById(
    "paymentStatusFilter"
  );


const paymentTypeFilter =
  document.getElementById(
    "paymentTypeFilter"
  );

const paymentSort =
  document.getElementById(
    "paymentSort"
  );

const paymentDrawer =
  document.getElementById(
    "paymentDrawer"
  );

const paymentDrawerBackdrop =
  document.getElementById(
    "paymentDrawerBackdrop"
  );

const paymentDrawerTitle =
  document.getElementById(
    "paymentDrawerTitle"
  );

const paymentDetails =
  document.getElementById(
    "paymentDetails"
  );

const paymentDrawerActions =
  document.getElementById(
    "paymentDrawerActions"
  );


const takePaymentDialog =
  document.getElementById(
    "takePaymentDialog"
  );

const closeTakePaymentDialog =
  document.getElementById(
    "closeTakePaymentDialog"
  );

const takePaymentContext =
  document.getElementById(
    "takePaymentContext"
  );

const takePaymentAmountSummary =
  document.getElementById(
    "takePaymentAmountSummary"
  );

const takePaymentStatus =
  document.getElementById(
    "takePaymentStatus"
  );

const takePaymentResult =
  document.getElementById(
    "takePaymentResult"
  );

const takePaymentQrCode =
  document.getElementById(
    "takePaymentQrCode"
  );

const takePaymentLink =
  document.getElementById(
    "takePaymentLink"
  );

const openTakePaymentLink =
  document.getElementById(
    "openTakePaymentLink"
  );

const copyTakePaymentLink =
  document.getElementById(
    "copyTakePaymentLink"
  );

const emailTakePaymentLink =
  document.getElementById(
    "emailTakePaymentLink"
  );

const recordTakePaymentManually =
  document.getElementById(
    "recordTakePaymentManually"
  );

const takePaymentDeductionType = document.getElementById("takePaymentDeductionType");
const takePaymentDeductionValueWrap = document.getElementById("takePaymentDeductionValueWrap");
const takePaymentDeductionValue = document.getElementById("takePaymentDeductionValue");
const takePaymentVoucherWrap = document.getElementById("takePaymentVoucherWrap");
const takePaymentVoucher = document.getElementById("takePaymentVoucher");
const prepareTakePayment = document.getElementById("prepareTakePayment");
const manageVouchersButton = document.getElementById("manageVouchersButton");
const vouchersDialog = document.getElementById("vouchersDialog");
const closeVouchersDialog = document.getElementById("closeVouchersDialog");
const voucherRows = document.getElementById("voucherRows");
const addVoucherButton = document.getElementById("addVoucherButton");
const saveVouchersButton = document.getElementById("saveVouchersButton");
const voucherStatus = document.getElementById("voucherStatus");


let payments = [];
let outstanding = [];
let customers = [];
let appointments = [];
let packageBalances = [];
let providers = [];
let activeView = "payments";
let activePayment = null;
let activeTakePaymentAppointment = null;
let activeTakePaymentPackage = null;
let activeTakePaymentPaymentId = null;
let activeRecordPackage = null;
let paymentVouchers = [];



function escapeVoucherHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
}

async function loadPaymentVouchers() {
  const response = await fetch("/api/vouchers", { headers:{Accept:"application/json"}, cache:"no-store" });
  handleAuthentication(response);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "Unable to load vouchers.");
  paymentVouchers = data.vouchers || [];
  takePaymentVoucher.innerHTML = paymentVouchers.filter(v => v.is_active !== false).map(v =>
    `<option value="${escapeVoucherHtml(v.id)}">${escapeVoucherHtml(v.code)} · ${escapeVoucherHtml(v.name)} (${v.discount_type === "percent" ? `${v.value}%` : formatMoney(Math.round(Number(v.value || 0) * 100))})</option>`
  ).join("") || '<option value="">No active vouchers</option>';
  return paymentVouchers;
}

function renderVoucherRows() {
  voucherRows.innerHTML = paymentVouchers.map((v, i) => `
    <div class="es-voucher-row" data-voucher-index="${i}">
      <input class="voucher-code" value="${escapeVoucherHtml(v.code)}" placeholder="CODE" aria-label="Voucher code">
      <select class="voucher-type" aria-label="Voucher type">
        <option value="amount" ${v.discount_type === "amount" ? "selected" : ""}>Amount (£)</option>
        <option value="percent" ${v.discount_type === "percent" ? "selected" : ""}>Discount (%)</option>
      </select>
      <input class="voucher-value" type="number" min="0.01" step="0.01" value="${Number(v.value || 0)}" aria-label="Voucher value">
      <label style="display:flex;align-items:center;gap:6px;margin:0;"><input class="voucher-active" type="checkbox" ${v.is_active !== false ? "checked" : ""}> Active</label>
    </div>`).join("") || '<div class="es-empty-state">No vouchers yet.</div>';
}

function readVoucherRows() {
  return [...voucherRows.querySelectorAll("[data-voucher-index]")].map((row, i) => ({
    id: paymentVouchers[i]?.id || `vch_${crypto.randomUUID()}`,
    code: row.querySelector(".voucher-code").value.trim().toUpperCase(),
    name: row.querySelector(".voucher-code").value.trim().toUpperCase(),
    discount_type: row.querySelector(".voucher-type").value,
    value: Number(row.querySelector(".voucher-value").value || 0),
    is_active: row.querySelector(".voucher-active").checked
  })).filter(v => v.code && v.value > 0);
}

manageVouchersButton?.addEventListener("click", async () => {
  voucherStatus.hidden = true;
  try { await loadPaymentVouchers(); renderVoucherRows(); vouchersDialog.showModal(); }
  catch (error) { alert(error.message || "Unable to load vouchers."); }
});
closeVouchersDialog?.addEventListener("click", () => vouchersDialog.close());
addVoucherButton?.addEventListener("click", () => {
  paymentVouchers.push({id:`vch_${crypto.randomUUID()}`,code:"",name:"",discount_type:"amount",value:0,is_active:true});
  renderVoucherRows();
});
saveVouchersButton?.addEventListener("click", async () => {
  voucherStatus.hidden = false; voucherStatus.className = "es-status"; voucherStatus.textContent = "Saving vouchers…";
  try {
    const response = await fetch("/api/vouchers", {method:"PUT",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({vouchers:readVoucherRows()})});
    handleAuthentication(response); const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to save vouchers.");
    paymentVouchers = data.vouchers || []; renderVoucherRows(); await loadPaymentVouchers();
    voucherStatus.className = "es-status success"; voucherStatus.textContent = "Vouchers saved.";
  } catch (error) { voucherStatus.className = "es-status error"; voucherStatus.textContent = error.message || "Unable to save vouchers."; }
});

takePaymentDeductionType?.addEventListener("change", () => {
  const type = takePaymentDeductionType.value;
  takePaymentDeductionValueWrap.hidden = !["amount","percent"].includes(type);
  takePaymentVoucherWrap.hidden = type !== "voucher";
  if (type === "percent") { takePaymentDeductionValue.step = "1"; takePaymentDeductionValue.max = "100"; }
  else { takePaymentDeductionValue.step = "0.01"; takePaymentDeductionValue.removeAttribute("max"); }
});

function currentDeductionPayload() {
  const type = takePaymentDeductionType?.value || "none";
  if (type === "amount") return {type, amount_minor:Math.round(Number(takePaymentDeductionValue.value || 0) * 100)};
  if (type === "percent") return {type, percent:Number(takePaymentDeductionValue.value || 0)};
  if (type === "voucher") return {type, voucher_id:takePaymentVoucher.value};
  return {type:"none"};
}

async function prepareActiveTakePaymentCheckout() {
  const isPackage = Boolean(activeTakePaymentPackage);
  const item = activeTakePaymentPackage || activeTakePaymentAppointment;
  if (!item) return;

  prepareTakePayment.disabled = true;
  takePaymentResult.hidden = true;
  takePaymentStatus.hidden = false;
  takePaymentStatus.className = "es-status";
  takePaymentStatus.textContent = "Creating secure Stripe Checkout…";

  try {
    const endpoint = isPackage ? "/api/payments/stripe/package-checkout" : "/api/payments/stripe/checkout";
    const body = isPackage
      ? {customer_package_id:item.id, deduction:currentDeductionPayload()}
      : {appointment_id:item.id, deduction:currentDeductionPayload()};
    const response = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(body)});
    handleAuthentication(response); const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Unable to create payment link.");

    takePaymentLink.value = data.checkout.url;
    openTakePaymentLink.href = data.checkout.url;
    activeTakePaymentPaymentId = data.checkout.payment_id;
    if (!window.EselramQr || typeof window.EselramQr.toDataUrl !== "function") throw new Error("Eselram QR generator is unavailable.");
    const qrPaymentUrl = `${location.origin}/api/payments/stripe/checkout-redirect?payment_id=${encodeURIComponent(data.checkout.payment_id)}`;
    takePaymentQrCode.src = window.EselramQr.toDataUrl(qrPaymentUrl,{quiet:5});
    takePaymentResult.hidden = false;
    takePaymentStatus.className = "es-status success";
    const discount = Number(data.checkout.discount_minor || 0);
    takePaymentStatus.textContent = discount > 0
      ? `${formatMoney(data.checkout.amount_minor)} ready to collect · ${formatMoney(discount)} deduction applied.`
      : `${formatMoney(data.checkout.amount_minor)} ready to collect.`;
  } catch (error) {
    takePaymentStatus.className = "es-status error"; takePaymentStatus.textContent = error.message || "Unable to create payment link.";
  } finally { prepareTakePayment.disabled = false; }
}
prepareTakePayment?.addEventListener("click", prepareActiveTakePaymentCheckout);

document
  .getElementById(
    "newPaymentButton"
  )
  .addEventListener(
    "click",
    openPaymentForm
  );


document
  .getElementById(
    "closePaymentFormButton"
  )
  .addEventListener(
    "click",
    closePaymentForm
  );


document
  .getElementById(
    "closePaymentDrawer"
  )
  .addEventListener(
    "click",
    closePaymentDrawer
  );


paymentDrawerBackdrop
  .addEventListener(
    "click",
    closePaymentDrawer
  );


closeTakePaymentDialog
  ?.addEventListener(
    "click",
    () => takePaymentDialog.close()
  );


copyTakePaymentLink
  ?.addEventListener(
    "click",
    async () => {

      if (!takePaymentLink.value) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          takePaymentLink.value
        );
      } catch {
        takePaymentLink.select();
        document.execCommand("copy");
      }

      takePaymentStatus.hidden = false;
      takePaymentStatus.className =
        "es-status success";
      takePaymentStatus.textContent =
        "Payment link copied.";
    }
  );


emailTakePaymentLink
  ?.addEventListener(
    "click",
    async () => {

      if (
        !activeTakePaymentAppointment ||
        !activeTakePaymentPaymentId ||
        !takePaymentLink.value
      ) {
        return;
      }

      emailTakePaymentLink.disabled = true;

      takePaymentStatus.hidden = false;
      takePaymentStatus.className =
        "es-status";
      takePaymentStatus.textContent =
        "Sending payment link…";

      try {
        const response =
          await fetch(
            "/api/payments/email-link",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Accept:
                  "application/json"
              },
              body:
                JSON.stringify({
                  appointment_id:
                    activeTakePaymentAppointment.id,
                  payment_id:
                    activeTakePaymentPaymentId,
                  checkout_url:
                    takePaymentLink.value
                })
            }
          );

        handleAuthentication(response);

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.ok
        ) {
          throw new Error(
            data.error ||
            "Unable to email the payment link."
          );
        }

        takePaymentStatus.className =
          "es-status success";
        takePaymentStatus.textContent =
          `Payment link sent to ${data.recipient}.`;

      } catch (error) {
        takePaymentStatus.className =
          "es-status error";
        takePaymentStatus.textContent =
          error.message ||
          "Unable to email the payment link.";
      } finally {
        emailTakePaymentLink.disabled = false;
      }
    }
  );


recordTakePaymentManually
  ?.addEventListener(
    "click",
    () => {

      const appointment =
        activeTakePaymentAppointment;

      takePaymentDialog.close();

      if (!appointment) {
        return;
      }

      openPaymentForm();

      paymentCustomer.value =
        appointment.customer_id;

      renderAppointmentOptions();

      paymentAppointment.value =
        appointment.id;

      prefillOutstandingAmount();
    }
  );


paymentSearch.addEventListener(
  "input",
  renderCurrentView
);


paymentStatusFilter.addEventListener(
  "change",
  renderCurrentView
);


paymentTypeFilter.addEventListener(
  "change",
  renderCurrentView
);

paymentSort.addEventListener(
  "change",
  renderCurrentView
);


document
  .querySelectorAll(
    "[data-payment-view]"
  )
  .forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          activeView =
            button.dataset
              .paymentView;


          document
            .querySelectorAll(
              "[data-payment-view]"
            )
            .forEach(
              (item) =>
                item.classList
                  .toggle(
                    "active",
                    item === button
                  )
            );


          renderCurrentView();
        }
      );
    }
  );


paymentCustomer.addEventListener(
  "change",
  renderAppointmentOptions
);


paymentAppointment.addEventListener(
  "change",
  prefillOutstandingAmount
);


/* =======================================================
   Load
   ======================================================= */

async function loadPayments() {

  try {

    const response =
      await fetch(
        "/api/payments",
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
        }
      );


    handleAuthentication(
      response
    );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to load payments."
      );
    }


    payments =
      data.payments ||
      [];

    outstanding =
      data.outstanding ||
      [];

    customers =
      data.customers ||
      [];

    appointments =
      data.appointments ||
      [];

    packageBalances =
      data.package_balances ||
      [];

    providers =
      data.providers ||
      [];


    renderStats(
      data.stats ||
      {}
    );


    renderCustomerOptions();

    renderProviderOptions();

    renderCurrentView();

    if (
      !applyTakePaymentQuery()
    ) {
      applyPaymentQueryPrefill();
    }


  } catch (error) {

    paymentsList.className =
      "es-status error";

    paymentsList.textContent =
      error.message ||
      "Unable to load payments.";
  }
}


function renderStats(
  stats
) {

  document
    .getElementById(
      "paidMonth"
    )
    .textContent =
      formatMoney(
        stats.paid_month_minor
      );


  document
    .getElementById(
      "outstandingTotal"
    )
    .textContent =
      formatMoney(
        stats.outstanding_minor
      );


  document
    .getElementById(
      "refundMonth"
    )
    .textContent =
      formatMoney(
        stats.refund_month_minor
      );


  document
    .getElementById(
      "transactionCount"
    )
    .textContent =
      stats.transaction_count ||
      0;
}


/* =======================================================
   Form
   ======================================================= */

function openPaymentForm() {

  activeRecordPackage = null;

  paymentForm.reset();

  paymentFormStatus.hidden =
    true;

  renderCustomerOptions();

  renderProviderOptions();

  renderAppointmentOptions();

  paymentFormPanel.hidden =
    false;


  paymentFormPanel.scrollIntoView({
    behavior:
      "smooth",
    block:
      "start"
  });
}


function openPaymentFormForAppointment(
  appointmentId
) {
  const appointment =
    appointments.find(
      (item) =>
        item.id ===
        appointmentId
    );

  if (!appointment) {
    return false;
  }

  openPaymentForm();

  paymentCustomer.value =
    appointment.customer_id;

  renderAppointmentOptions();

  paymentAppointment.value =
    appointment.id;

  prefillOutstandingAmount();

  return true;
}


function applyTakePaymentQuery() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const appointmentId =
    String(
      params.get(
        "appointment_id"
      ) ||
      ""
    ).trim();

  if (
    !appointmentId ||
    params.get("take") !==
      "1"
  ) {
    return false;
  }

  const appointment =
    appointments.find(
      item =>
        item.id ===
        appointmentId
    );

  if (!appointment) {
    return false;
  }

  createTakePaymentCheckout(
    appointment
  );

  window.history.replaceState(
    {},
    "",
    window.location.pathname
  );

  return true;
}


function applyPaymentQueryPrefill() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const appointmentId =
    String(
      params.get(
        "appointment_id"
      ) ||
      ""
    ).trim();

  if (
    !appointmentId ||
    params.get("record") !==
      "1"
  ) {
    return;
  }

  if (
    openPaymentFormForAppointment(
      appointmentId
    )
  ) {
    window.history.replaceState(
      {},
      "",
      window.location.pathname
    );
  }
}


function closePaymentForm() {

  paymentFormPanel.hidden =
    true;

  paymentForm.reset();

  paymentFormStatus.hidden =
    true;
}


function renderCustomerOptions() {

  paymentCustomer.innerHTML = `
    <option value="">
      Select customer
    </option>

    ${
      customers
        .map(
          (customer) => `
            <option
              value="${escapeHtml(
                customer.id
              )}"
            >
              ${escapeHtml(
                `${customer.first_name} ${customer.last_name}`
              )}
            </option>
          `
        )
        .join("")
    }
  `;
}


function renderProviderOptions() {

  const list =
    providers.length > 0
      ? providers
      : [
          {
            provider_key:
              "manual",
            display_name:
              "Manual / in-person"
          }
        ];


  paymentProvider.innerHTML =
    list
      .map(
        (provider) => `
          <option
            value="${escapeHtml(
              provider.provider_key
            )}"
          >
            ${escapeHtml(
              provider.display_name
            )}
          </option>
        `
      )
      .join("");


  if (
    list.some(
      (provider) =>
        provider.provider_key ===
        "manual"
    )
  ) {

    paymentProvider.value =
      "manual";
  }
}


function renderAppointmentOptions() {

  const customerId =
    paymentCustomer.value;


  const available =
    appointments.filter(
      (appointment) =>
        !customerId ||
        appointment.customer_id ===
          customerId
    );


  paymentAppointment.innerHTML = `
    <option value="">
      No appointment
    </option>

    ${
      available
        .map(
          (appointment) => `
            <option
              value="${escapeHtml(
                appointment.id
              )}"
            >
              ${escapeHtml(
                `${formatShortDate(
                  appointment.start_at
                )} · ${appointment.service_name} · ${formatMoney(
                  appointment.balance_minor
                )} outstanding`
              )}
            </option>
          `
        )
        .join("")
    }
  `;
}


function prefillOutstandingAmount() {

  const appointment =
    appointments.find(
      (item) =>
        item.id ===
        paymentAppointment.value
    );


  if (!appointment) {
    return;
  }


  paymentCustomer.value =
    appointment.customer_id;


  paymentAmount.value =
    (
      Number(
        appointment.balance_minor ||
        0
      ) / 100
    ).toFixed(2);


  if (
    Number(
      appointment.paid_minor ||
      0
    ) > 0 ||
    Number(
      appointment.consultation_credit_minor ||
      0
    ) > 0
  ) {

    paymentType.value =
      "balance";

  } else {

    paymentType.value =
      "full";
  }
}


paymentForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const amountMinor =
      Math.round(
        Number(
          paymentAmount.value
        ) * 100
      );


    if (
      !paymentCustomer.value
    ) {

      showFormError(
        "Select a customer."
      );

      return;
    }


    if (
      !Number.isFinite(
        amountMinor
      ) ||
      amountMinor <= 0
    ) {

      showFormError(
        "Enter a valid payment amount."
      );

      return;
    }


    paymentFormStatus.hidden =
      false;

    paymentFormStatus.className =
      "es-status";

    paymentFormStatus.textContent =
      "Saving payment…";

    savePaymentButton.disabled =
      true;


    try {

      const response =
        await fetch(
          "/api/payments",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json"
            },

            body:
              JSON.stringify({
                customer_id:
                  paymentCustomer.value,

                appointment_id:
                  activeRecordPackage
                    ? null
                    : (
                        paymentAppointment.value ||
                        null
                      ),

                customer_package_id:
                  activeRecordPackage?.id ||
                  null,

                amount_minor:
                  amountMinor,

                payment_type:
                  paymentType.value,

                provider:
                  paymentProvider.value,

                payment_method:
                  paymentMethod.value,

                provider_reference:
                  document
                    .getElementById(
                      "providerReference"
                    )
                    .value
                    .trim(),

                notes:
                  document
                    .getElementById(
                      "paymentNotes"
                    )
                    .value
                    .trim()
              })
          }
        );


      handleAuthentication(
        response
      );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ||
          "Unable to record payment."
        );
      }


      paymentFormStatus.className =
        "es-status success";

      paymentFormStatus.textContent =
        "Payment recorded.";


      await loadPayments()
  .then(
    applyPaymentQueryPrefill
  );


      setTimeout(
        closePaymentForm,
        500
      );


    } catch (error) {

      showFormError(
        error.message ||
        "Unable to record payment."
      );


    } finally {

      savePaymentButton.disabled =
        false;
    }
  }
);


function showFormError(
  message
) {

  paymentFormStatus.hidden =
    false;

  paymentFormStatus.className =
    "es-status error";

  paymentFormStatus.textContent =
    message;
}


/* =======================================================
   Lists
   ======================================================= */

function renderCurrentView() {

  if (
    activeView ===
    "outstanding"
  ) {

    renderOutstanding();

    return;
  }


  renderPayments();
}


function renderPayments() {

  const query =
    paymentSearch.value
      .trim()
      .toLowerCase();

  const status =
    paymentStatusFilter.value;

  const type =
    paymentTypeFilter.value;


  const filtered =
    payments
      .filter(
        (payment) => {

          if (
            status === "refund"
          ) {
            if (
              payment.payment_type !==
              "refund"
            ) {
              return false;
            }
          } else if (
            status !== "all" &&
            payment.status !== status
          ) {
            return false;
          }


          if (
            type !== "all" &&
            payment.payment_type !== type
          ) {
            return false;
          }


          if (!query) {
            return true;
          }


          const searchable = [
            payment.first_name,
            payment.last_name,
            payment.provider_reference,
            payment.provider,
            payment.payment_method,
            payment.service_name,
            payment.package_name,
            formatPaymentType(payment.payment_type),
            formatStatus(payment.status)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return searchable.includes(
            query
          );
        }
      )
      .sort(
        (a, b) => {

          if (
            paymentSort.value ===
            "oldest"
          ) {
            return paymentDateValue(a) -
              paymentDateValue(b);
          }

          if (
            paymentSort.value ===
            "highest"
          ) {
            return Number(b.amount_minor || 0) -
              Number(a.amount_minor || 0);
          }

          if (
            paymentSort.value ===
            "lowest"
          ) {
            return Number(a.amount_minor || 0) -
              Number(b.amount_minor || 0);
          }

          return paymentDateValue(b) -
            paymentDateValue(a);
        }
      );


  if (
    filtered.length === 0
  ) {

    paymentsList.className =
      "es-empty-state";

    paymentsList.innerHTML = `
      <strong>No payments found.</strong>
      <span>Try changing your search or filters.</span>
    `;

    return;
  }


  paymentsList.className =
    "es-finance-list";


  paymentsList.innerHTML =
    filtered
      .map(
        (payment) => {

          const customer =
            `${payment.first_name || ""} ${payment.last_name || ""}`.trim() ||
            "Customer";

          const context =
            payment.package_name
              ? `Package · ${payment.package_name}`
              : (
                  payment.appointment_booking_kind === "consultation" &&
                  payment.service_name
                    ? `Consultation · ${payment.service_name}`
                    : (
                        payment.service_name ||
                        "No linked appointment"
                      )
                );

          const displayStatus =
            payment.payment_type === "refund"
              ? "refunded"
              : payment.status;

          return `
            <article class="es-finance-row ${
              displayStatus === "failed"
                ? "is-failed"
                : ""
            }">

              <div class="es-finance-cell">
                <strong>${formatMoney(payment.amount_minor)}</strong>
                <span>${escapeHtml(formatPaymentType(payment.payment_type))}</span>
              </div>

              <div class="es-finance-cell">
                <strong>${escapeHtml(customer)}</strong>
                <span>${escapeHtml(context)}</span>
              </div>

              <div class="es-finance-cell">
                <strong>${escapeHtml(formatMethod(payment.payment_method))}</strong>
                <span>${escapeHtml(payment.provider_display_name || payment.provider || "—")}</span>
              </div>

              <div class="es-finance-cell">
                <strong>${escapeHtml(formatFullDateTime(payment.paid_at || payment.created_at))}</strong>
                <span>${escapeHtml(payment.provider_reference || "No reference")}</span>
              </div>

              <div>
                <span class="es-payment-status es-payment-status-${escapeHtml(displayStatus)}">
                  ${escapeHtml(
                    payment.payment_type === "refund"
                      ? "Refund"
                      : formatStatus(payment.status)
                  )}
                </span>
              </div>

              <div class="es-finance-actions">
                ${
                  payment.customer_id
                    ? `
                      <a
                        class="es-secondary-button"
                        href="/customers/?customer=${encodeURIComponent(payment.customer_id)}"
                      >
                        Customer
                      </a>
                    `
                    : ""
                }

                <button
                  class="es-payment-action"
                  type="button"
                  data-view-payment="${escapeHtml(payment.id)}"
                >
                  View
                </button>
              </div>

            </article>
          `;
        }
      )
      .join("");


  document
    .querySelectorAll(
      "[data-view-payment]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const payment =
              payments.find(
                (item) =>
                  item.id ===
                  button.dataset.viewPayment
              );


            if (payment) {
              showPaymentDetails(payment);
            }
          }
        );
      }
    );
}


function renderOutstanding() {

  const query =
    paymentSearch
      .value
      .trim()
      .toLowerCase();

  const filtered =
    outstanding.filter(
      item => {
        if (!query) {
          return true;
        }

        return [
          item.first_name,
          item.last_name,
          item.service_name,
          item.package_name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      }
    );

  if (filtered.length === 0) {
    paymentsList.className =
      "es-empty-state";

    paymentsList.innerHTML = `
      <strong>Nothing outstanding.</strong>
      <span>All appointment and package balances are covered.</span>
    `;

    return;
  }

  paymentsList.className =
    "es-finance-list";

  paymentsList.innerHTML =
    filtered
      .map(
        item => {
          const isPackage =
            item.outstanding_type ===
              "package";

          const label =
            isPackage
              ? item.package_name
              : item.service_name;

          const dateValue =
            isPackage
              ? item.starts_on
              : item.start_at;

          return `
            <article class="es-finance-outstanding-row">

              <div class="es-finance-cell">
                <strong>
                  ${escapeHtml(`${item.first_name} ${item.last_name}`)}
                </strong>
                <span>${escapeHtml(label || "")}</span>
                <small>${isPackage ? "Package balance" : "Appointment balance"}</small>
              </div>

              <div class="es-finance-cell">
                <strong>${formatShortDate(dateValue)}</strong>
                <span>${isPackage ? "Package starts" : formatTime(dateValue)}</span>
              </div>

              <div class="es-finance-cell">
                <strong>${formatMoney(item.price_minor)}</strong>
                <span>${isPackage ? "Package value" : "Appointment value"}</span>
              </div>

              <div class="es-finance-cell">
                <strong>${formatMoney(item.balance_minor)}</strong>
                <span>Outstanding</span>
              </div>

              <div class="es-finance-actions">
                ${
                  item.customer_id
                    ? `
                      <a
                        class="es-secondary-button"
                        href="/customers/?customer=${encodeURIComponent(item.customer_id)}"
                      >
                        Customer
                      </a>
                    `
                    : ""
                }

                <button
                  class="es-button"
                  type="button"
                  data-take-${isPackage ? "package" : "payment"}="${escapeHtml(item.id)}"
                >
                  Take payment
                </button>

                <button
                  class="es-payment-action"
                  type="button"
                  data-record-${isPackage ? "package" : "balance"}="${escapeHtml(item.id)}"
                >
                  Record payment
                </button>
              </div>

            </article>
          `;
        }
      )
      .join("");

  document
    .querySelectorAll("[data-take-payment]")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const appointment =
              appointments.find(
                item =>
                  item.id ===
                  button.dataset.takePayment
              );

            if (appointment) {
              createTakePaymentCheckout(
                appointment
              );
            }
          }
        );
      }
    );

  document
    .querySelectorAll("[data-take-package]")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const item =
              packageBalances.find(
                packageItem =>
                  packageItem.id ===
                  button.dataset.takePackage
              );

            if (item) {
              createPackagePaymentCheckout(
                item
              );
            }
          }
        );
      }
    );

  document
    .querySelectorAll("[data-record-balance]")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const appointment =
              appointments.find(
                item =>
                  item.id ===
                  button.dataset.recordBalance
              );

            if (!appointment) {
              return;
            }

            openPaymentForm();

            paymentCustomer.value =
              appointment.customer_id;

            renderAppointmentOptions();
            paymentAppointment.value =
              appointment.id;

            prefillOutstandingAmount();
          }
        );
      }
    );

  document
    .querySelectorAll("[data-record-package]")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const item =
              packageBalances.find(
                packageItem =>
                  packageItem.id ===
                  button.dataset.recordPackage
              );

            if (!item) {
              return;
            }

            openPaymentForm();
            activeRecordPackage =
              item;

            paymentCustomer.value =
              item.customer_id;

            renderAppointmentOptions();
            paymentAppointment.value = "";

            paymentAmount.value =
              (
                Number(
                  item.balance_minor ||
                  0
                ) /
                100
              ).toFixed(2);

            paymentType.value =
              "balance";
          }
        );
      }
    );
}



async function createPackagePaymentCheckout(
  item
) {
  activeTakePaymentAppointment =
    null;

  activeTakePaymentPackage =
    item;

  activeTakePaymentPaymentId =
    null;

  takePaymentResult.hidden =
    true;

  takePaymentStatus.hidden =
    false;

  takePaymentStatus.className =
    "es-status";

  takePaymentStatus.textContent =
    "Creating secure Stripe Checkout…";

  takePaymentContext.textContent =
    `${item.first_name} ${item.last_name} · ${item.package_name}`;

  takePaymentAmountSummary.innerHTML = `
    <strong>${formatMoney(
      item.balance_minor
    )} outstanding</strong>
    <span>
      Package value ${formatMoney(
        item.price_minor
      )}
      · Paid ${formatMoney(
        item.paid_minor || 0
      )}
      ${
        Number(
          item.consultation_credit_minor ||
          0
        ) > 0
          ? ` · Consultation credit ${formatMoney(
              item.consultation_credit_minor
            )}`
          : ""
      }
    </span>
  `;

  if (
    typeof takePaymentDialog.showModal ===
    "function"
  ) {
    takePaymentDialog.showModal();
  }

  takePaymentDeductionType.value = "none";
  takePaymentDeductionValue.value = "";
  takePaymentDeductionValueWrap.hidden = true;
  takePaymentVoucherWrap.hidden = true;
  takePaymentResult.hidden = true;
  activeTakePaymentPaymentId = null;
  try { await loadPaymentVouchers(); } catch {}
  takePaymentStatus.hidden = false;
  takePaymentStatus.className = "es-status";
  takePaymentStatus.textContent = "Choose a deduction if needed, then select Prepare payment.";
}

async function createTakePaymentCheckout(
  appointment
) {

  activeTakePaymentPackage =
    null;

  activeTakePaymentAppointment =
    appointment;

  activeTakePaymentPaymentId =
    null;

  takePaymentResult.hidden =
    true;

  takePaymentStatus.hidden =
    false;

  takePaymentStatus.className =
    "es-status";

  takePaymentStatus.textContent =
    "Creating secure Stripe Checkout…";

  takePaymentContext.textContent =
    `${appointment.first_name} ${appointment.last_name} · ${appointment.service_name}`;

  takePaymentAmountSummary.innerHTML = `
    <strong>${formatMoney(
      appointment.balance_minor
    )} outstanding</strong>
    <span>
      Appointment value ${formatMoney(
        appointment.price_minor
      )}
      · Paid ${formatMoney(
        appointment.paid_minor || 0
      )}
      ${
        Number(
          appointment.consultation_credit_minor ||
          0
        ) > 0
          ? ` · Consultation credit ${formatMoney(
              appointment.consultation_credit_minor
            )}`
          : ""
      }
    </span>
  `;

  if (
    typeof takePaymentDialog.showModal ===
    "function"
  ) {
    takePaymentDialog.showModal();
  }

  takePaymentDeductionType.value = "none";
  takePaymentDeductionValue.value = "";
  takePaymentDeductionValueWrap.hidden = true;
  takePaymentVoucherWrap.hidden = true;
  takePaymentResult.hidden = true;
  activeTakePaymentPaymentId = null;
  try { await loadPaymentVouchers(); } catch {}
  takePaymentStatus.hidden = false;
  takePaymentStatus.className = "es-status";
  takePaymentStatus.textContent = "Choose a deduction if needed, then select Prepare payment.";
}

/* =======================================================
   Drawer / refunds
   ======================================================= */

function showPaymentDetails(
  payment
) {

  activePayment =
    payment;


  paymentDrawerTitle.textContent =
    formatMoney(
      payment.amount_minor
    );


  paymentDetails.innerHTML = `
    ${detailItem(
      "Customer",
      `${payment.first_name || ""} ${payment.last_name || ""}`.trim() ||
      "—"
    )}

    ${detailItem(
      "Status",
      payment.payment_type ===
        "refund"
        ? "Refund"
        : formatStatus(
            payment.status
          )
    )}

    ${detailItem(
      "Provider",
      payment.provider_display_name ||
      payment.provider
    )}

    ${detailItem(
      "Method",
      formatMethod(
        payment.payment_method
      )
    )}

    ${detailItem(
      "Payment type",
      formatPaymentType(
        payment.payment_type
      )
    )}

    ${detailItem(
      "Date",
      formatFullDateTime(
        payment.paid_at ||
        payment.created_at
      )
    )}

    ${detailItem(
      "Appointment",
      payment.appointment_booking_kind ===
        "consultation" &&
      payment.service_name
        ? `Consultation · ${
            payment.service_name
          }`
        : (
            payment.service_name ||
            "No linked appointment"
          )
    )}

    ${
      payment.package_name
        ? detailItem(
            "Package",
            payment.package_name
          )
        : ""
    }

    ${detailItem(
      "Reference",
      payment.provider_reference ||
      "—"
    )}

    ${detailItem(
      "Notes",
      payment.notes ||
      "No notes",
      true
    )}
  `;


  paymentDrawerActions.innerHTML = `
    ${
      payment.payment_type !==
        "refund" &&
      payment.status ===
        "paid" &&
      Number(
        payment.refundable_minor ||
        0
      ) > 0
        ? `
          <button
            id="refundPaymentButton"
            class="es-secondary-button"
            type="button"
          >
            Record refund
          </button>
        `
        : ""
    }

    ${
      payment.customer_id
        ? `
          <a
            class="es-button"
            href="/customers/?customer=${encodeURIComponent(
              payment.customer_id
            )}"
          >
            Open customer
          </a>
        `
        : ""
    }

    ${
      payment.appointment_id
        ? `
          <a
            class="es-secondary-button"
            href="/bookings/?view=bookings&booking=${encodeURIComponent(
              payment.appointment_id
            )}"
          >
            Open booking
          </a>
        `
        : ""
    }

    ${
      payment.customer_package_id
        ? `
          <a
            class="es-secondary-button"
            href="/packages/"
          >
            Open packages
          </a>
        `
        : ""
    }
  `;


  const refundButton =
    document.getElementById(
      "refundPaymentButton"
    );


  if (refundButton) {

    refundButton.addEventListener(
      "click",
      () =>
        recordRefund(
          payment
        )
    );
  }


  openPaymentDrawer();
}


async function recordRefund(
  payment
) {

  const max =
    Number(
      payment.refundable_minor ||
      0
    ) / 100;


  const entered =
    window.prompt(
      `Refund amount (maximum ${formatMoney(
        payment.refundable_minor
      )}):`,
      max.toFixed(2)
    );


  if (entered === null) {
    return;
  }


  const amountMinor =
    Math.round(
      Number(entered) *
      100
    );


  if (
    !Number.isFinite(
      amountMinor
    ) ||
    amountMinor <= 0 ||
    amountMinor >
      Number(
        payment.refundable_minor ||
        0
      )
  ) {

    window.alert(
      "Enter a valid refund amount."
    );

    return;
  }


  const notes =
    window.prompt(
      "Refund note (optional):",
      ""
    );


  if (notes === null) {
    return;
  }


  try {

    const response =
      await fetch(
        "/api/payments",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json"
          },

          body:
            JSON.stringify({
              action:
                "refund",

              payment_id:
                payment.id,

              amount_minor:
                amountMinor,

              notes
            })
        }
      );


    handleAuthentication(
      response
    );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to record refund."
      );
    }


    closePaymentDrawer();

    await loadPayments();


  } catch (error) {

    window.alert(
      error.message ||
      "Unable to record refund."
    );
  }
}


function detailItem(
  label,
  value,
  full = false
) {

  return `
    <div
      class="
        es-payment-detail
        ${
          full
            ? "es-payment-detail-full"
            : ""
        }
      "
    >
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value ??
          "—"
        )}
      </strong>
    </div>
  `;
}


function openPaymentDrawer() {

  paymentDrawer
    .classList
    .add(
      "is-open"
    );


  paymentDrawerBackdrop
    .classList
    .add(
      "is-open"
    );


  paymentDrawer
    .setAttribute(
      "aria-hidden",
      "false"
    );
}


function closePaymentDrawer() {

  activePayment =
    null;


  paymentDrawer
    .classList
    .remove(
      "is-open"
    );


  paymentDrawerBackdrop
    .classList
    .remove(
      "is-open"
    );


  paymentDrawer
    .setAttribute(
      "aria-hidden",
      "true"
    );
}


/* =======================================================
   Helpers
   ======================================================= */

function handleAuthentication(
  response
) {

  if (
    response.status === 401
  ) {

    window.location.href =
      "/auth/login.html";

    throw new Error(
      "Authentication required."
    );
  }
}


function paymentDateValue(
  payment
) {

  const value =
    payment.paid_at ||
    payment.created_at ||
    "";

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


function formatMoney(
  amountMinor
) {

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        "GBP"
    }
  ).format(
    Number(
      amountMinor ||
      0
    ) / 100
  );
}


function formatShortDate(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short"
    }
  ).format(
    new Date(value)
  );
}


function formatFullDateTime(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle:
        "medium",
      timeStyle:
        "short"
    }
  ).format(
    new Date(value)
  );
}


function formatTime(
  value
) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour:
        "2-digit",
      minute:
        "2-digit"
    }
  ).format(
    new Date(value)
  );
}


function formatStatus(
  value
) {

  const values = {
    pending:
      "Pending",
    paid:
      "Paid",
    failed:
      "Failed",
    refunded:
      "Refunded",
    partially_refunded:
      "Partially refunded",
    due:
      "Due"
  };


  return values[value] ||
    value ||
    "—";
}


function formatPaymentType(
  value
) {

  const values = {
    full:
      "Full payment",
    deposit:
      "Deposit",
    balance:
      "Balance",
    pay_at_appointment:
      "Pay at appointment",
    refund:
      "Refund"
  };


  return values[value] ||
    value ||
    "—";
}


function formatMethod(
  value
) {

  const values = {
    paypal:
      "PayPal",
    apple_pay:
      "Apple Pay",
    google_pay:
      "Google Pay",
    card:
      "Card",
    cash:
      "Cash",
    bank_transfer:
      "Bank transfer",
    other:
      "Other"
  };


  return values[value] ||
    value ||
    "—";
}


function escapeHtml(
  value
) {

  return String(
    value ??
    ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


loadPayments();
