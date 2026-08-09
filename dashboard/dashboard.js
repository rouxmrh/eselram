const welcomeTitle =
  document.getElementById(
    "welcomeTitle"
  );

const dashboardDate =
  document.getElementById(
    "dashboardDate"
  );

const businessName =
  document.getElementById(
    "businessName"
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


    renderHeader(
      data
    );


    renderStats(
      data
    );


    renderTodaySchedule(
      data.today_schedule ||
      []
    );


    renderUpcomingAppointments(
      data.upcoming_appointments ||
      []
    );


    renderRecentActivity(
      data.recent_activity ||
      []
    );


    renderBusinessSnapshot(
      data.business
    );


  } catch (error) {

    console.error(
      error
    );


    statusBox.hidden =
      false;

    statusBox.className =
      "es-status error";

    statusBox.textContent =
      error.message ||
      "Unable to load dashboard.";
  }
}


function renderHeader(
  data
) {

  const firstName =
    String(
      data.user?.name ||
      ""
    )
      .trim()
      .split(/\s+/)[0] ||
    "there";


  welcomeTitle.textContent =
    `${greeting()}, ${firstName}`;


  dashboardDate.textContent =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        weekday:
          "long",
        day:
          "numeric",
        month:
          "long",
        year:
          "numeric"
      }
    ).format(
      new Date()
    );


  businessName.textContent =
    data.business?.name ||
    "Business";


  if (sidebarUser) {

  sidebarUser.innerHTML = `
    <strong>
      ${escapeHtml(
        data.user?.name ||
        ""
      )}
    </strong>

    <span>
      Owner
    </span>
  `;
}


function greeting() {

  const hour =
    new Date()
      .getHours();


  if (hour < 12) {
    return "Good morning";
  }


  if (hour < 18) {
    return "Good afternoon";
  }


  return "Good evening";
}


function renderStats(
  data
) {

  document
    .getElementById(
      "todayBookings"
    )
    .textContent =
      data.stats
        ?.today_bookings ||
      0;


  document
    .getElementById(
      "weekBookings"
    )
    .textContent =
      data.stats
        ?.week_bookings ||
      0;


  document
    .getElementById(
      "customerCount"
    )
    .textContent =
      data.stats
        ?.customers ||
      0;


  document
    .getElementById(
      "newCustomersNote"
    )
    .textContent =
      `${
        data.stats
          ?.new_customers_month ||
        0
      } new this month`;


  document
    .getElementById(
      "monthRevenue"
    )
    .textContent =
      formatMoney(
        data.stats
          ?.month_revenue_minor ||
        0,
        data.business
          ?.currency
      );


  document
    .getElementById(
      "outstandingAmount"
    )
    .textContent =
      formatMoney(
        data.stats
          ?.outstanding_minor ||
        0,
        data.business
          ?.currency
      );
}


function renderTodaySchedule(
  appointments
) {

  const container =
    document.getElementById(
      "todaySchedule"
    );


  if (
    !appointments ||
    appointments.length === 0
  ) {

    container.className =
      "es-dashboard-empty";

    container.innerHTML = `
      <strong>
        You're all caught up.
      </strong>

      <span>
        No appointments are scheduled for today.
      </span>

      <div>
        <a
          class="es-dashboard-panel-link"
          href="/bookings/"
        >
          Create a booking
        </a>
      </div>
    `;

    return;
  }


  container.className =
    "es-today-list";


  container.innerHTML =
    appointments
      .map(
        (appointment) =>
          appointmentRow(
            appointment,
            false
          )
      )
      .join("");
}


function renderUpcomingAppointments(
  appointments
) {

  const container =
    document.getElementById(
      "upcomingAppointments"
    );


  if (
    !appointments ||
    appointments.length === 0
  ) {

    container.className =
      "es-dashboard-empty";

    container.innerHTML = `
      <strong>
        No upcoming appointments.
      </strong>

      <span>
        New bookings will appear here automatically.
      </span>
    `;

    return;
  }


  container.className =
    "es-today-list";


  container.innerHTML =
    appointments
      .map(
        (appointment) =>
          appointmentRow(
            appointment,
            true
          )
      )
      .join("");
}


function appointmentRow(
  appointment,
  showDate
) {

  return `
    <article class="es-today-row">

      <div class="es-today-time">

        <strong>
          ${formatTime(
            appointment.start_at
          )}
        </strong>

        <span>
          ${
            showDate
              ? formatShortDate(
                  appointment.start_at
                )
              : formatEndTime(
                  appointment.end_at
                )
          }
        </span>

      </div>


      <div class="es-today-main">

        <strong>
          ${escapeHtml(
            `${appointment.first_name} ${appointment.last_name}`
          )}
        </strong>

        <span>
          ${escapeHtml(
            appointment.service_name
          )}
        </span>

      </div>


      <span
        class="
          es-dashboard-status-pill
          ${escapeHtml(
            appointment.status ||
            ""
          )}
        "
      >
        ${escapeHtml(
          formatStatus(
            appointment.status
          )
        )}
      </span>

    </article>
  `;
}


function renderRecentActivity(
  activity
) {

  const container =
    document.getElementById(
      "recentActivity"
    );


  if (
    !activity ||
    activity.length === 0
  ) {

    container.className =
      "es-dashboard-empty";

    container.innerHTML = `
      <strong>
        No recent activity yet.
      </strong>

      <span>
        Bookings, customers and payments will appear here.
      </span>
    `;

    return;
  }


  container.className =
    "es-dashboard-activity";


  container.innerHTML =
    activity
      .map(
        (item) => `
          <div class="es-dashboard-activity-row">

            <span class="es-dashboard-activity-dot"></span>

            <div class="es-dashboard-activity-main">

              <strong>
                ${escapeHtml(
                  item.title
                )}
              </strong>

              <span>
                ${escapeHtml(
                  item.detail ||
                  ""
                )}
              </span>

            </div>

            <span class="es-dashboard-activity-time">
              ${formatActivityDate(
                item.occurred_at
              )}
            </span>

          </div>
        `
      )
      .join("");
}


function renderBusinessSnapshot(
  business
) {

  const container =
    document.getElementById(
      "businessSnapshot"
    );


  container.innerHTML = `
    ${businessRow(
      "Business",
      business?.name ||
      "—"
    )}

    ${businessRow(
      "Currency",
      business?.currency ||
      "GBP"
    )}

    ${businessRow(
      "Timezone",
      business?.timezone ||
      "Europe/London"
    )}
  `;
}


function businessRow(
  label,
  value
) {

  return `
    <div class="es-dashboard-business-row">

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value
        )}
      </strong>

    </div>
  `;
}


function formatMoney(
  amountMinor,
  currency
) {

  return new Intl.NumberFormat(
    "en-GB",
    {
      style:
        "currency",
      currency:
        currency ||
        "GBP"
    }
  ).format(
    Number(
      amountMinor ||
      0
    ) / 100
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


function formatEndTime(
  value
) {

  return `until ${
    formatTime(value)
  }`;
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


function formatActivityDate(
  value
) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  const today =
    new Date();


  if (
    date.toDateString() ===
    today.toDateString()
  ) {

    return formatTime(
      value
    );
  }


  return formatShortDate(
    value
  );
}


function formatStatus(
  value
) {

  const statuses = {
    pending:
      "Pending",
    confirmed:
      "Confirmed",
    completed:
      "Completed",
    cancelled:
      "Cancelled",
    no_show:
      "No show"
  };


  return statuses[value] ||
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


logoutButton?.addEventListener(
  "click",
  async () => {

    logoutButton.disabled =
      true;

    try {

      await fetch(
        "/api/auth/logout",
        {
          method:
            "POST",

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


loadDashboard();
