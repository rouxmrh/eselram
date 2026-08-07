const businessName =
  document.getElementById(
    "businessName"
  );

const headerUser =
  document.getElementById(
    "headerUser"
  );

const sidebarUser =
  document.getElementById(
    "sidebarUser"
  );

const statusBox =
  document.getElementById(
    "dashboardStatus"
  );

const logoutButton =
  document.getElementById(
    "logoutButton"
  );


async function loadDashboard() {

  try {

    const response =
      await fetch(
        "/api/dashboard",
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    if (
      response.status === 401
    ) {

      window.location.href =
        "/auth/login.html";

      return;
    }


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.ok
    ) {

      throw new Error(
        data.error ||
        "Unable to load dashboard."
      );
    }


    businessName.textContent =
      data.business.name;


    headerUser.textContent =
      data.user.name;


    sidebarUser.innerHTML = `
      <strong>
        ${escapeHtml(data.user.name)}
      </strong>

      <span>
        Owner
      </span>
    `;


    document
      .getElementById(
        "todayBookings"
      )
      .textContent =
        data.stats.today_bookings;


    document
      .getElementById(
        "upcomingBookings"
      )
      .textContent =
        data.stats.upcoming_bookings;


    document
      .getElementById(
        "customerCount"
      )
      .textContent =
        data.stats.customers;


    document
      .getElementById(
        "revenue"
      )
      .textContent =
        formatMoney(
          data.stats.revenue_minor,
          data.business.currency
        );


    renderAppointments(
      data.appointments
    );


  } catch (error) {

    console.error(error);

    statusBox.hidden = false;

    statusBox.className =
      "es-status error";

    statusBox.textContent =
      error.message ||
      "Unable to load dashboard.";
  }
}


function renderAppointments(
  appointments
) {

  const container =
    document.getElementById(
      "appointmentsList"
    );


  if (
    !appointments ||
    appointments.length === 0
  ) {

    container.className =
      "es-empty-state";

    container.innerHTML = `
      <strong>
        No upcoming appointments.
      </strong>

      <span>
        New bookings will appear here.
      </span>
    `;

    return;
  }


  container.className =
    "es-appointment-list";


  container.innerHTML =
    appointments
      .map(
        (appointment) => `
          <article class="es-appointment-row">

            <div>
              <strong>
                ${escapeHtml(
                  appointment.first_name
                )}
                ${escapeHtml(
                  appointment.last_name
                )}
              </strong>

              <span>
                ${escapeHtml(
                  appointment.service_name
                )}
              </span>
            </div>

            <div>
              ${formatDateTime(
                appointment.start_at
              )}
            </div>

          </article>
        `
      )
      .join("");
}


function formatMoney(
  amountMinor,
  currency
) {

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency:
        currency || "GBP"
    }
  ).format(
    amountMinor / 100
  );
}


function formatDateTime(value) {

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(
    new Date(value)
  );
}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


logoutButton.addEventListener(
  "click",
  async () => {

    logoutButton.disabled =
      true;


    try {

      await fetch(
        "/api/auth/logout",
        {
          method: "POST",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    } finally {

      window.location.href =
        "/auth/login.html";
    }
  }
);


loadDashboard();
