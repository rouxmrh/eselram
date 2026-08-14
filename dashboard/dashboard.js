const welcomeTitle =
  document.getElementById("welcomeTitle");

const dashboardDate =
  document.getElementById("dashboardDate");

const statusBox =
  document.getElementById("dashboardStatus");


async function loadDashboard() {
  try {
    const response =
      await fetch(
        "/api/dashboard",
        {
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

    if (response.status === 401) {
      window.location.href =
        "/auth/login.html";
      return;
    }

    const data =
      await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Unable to load dashboard."
      );
    }

    renderHeader(data);
    renderStats(data);
    renderTodaySchedule(
      data.today_schedule || []
    );
    renderUpcomingAppointments(
      data.upcoming_appointments || []
    );
    renderRecentActivity(
      data.recent_activity || []
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


function renderHeader(data) {
  const firstName =
    String(data.user?.name || "")
      .trim()
      .split(/\s+/)[0] ||
    "there";

  welcomeTitle.textContent =
    `${greeting()}, ${firstName}`;

  dashboardDate.textContent =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    ).format(new Date());
}


function greeting() {
  const hour =
    new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}


function renderStats(data) {
  document
    .getElementById("todayBookings")
    .textContent =
      data.stats?.today_bookings || 0;

  document
    .getElementById("weekBookings")
    .textContent =
      data.stats?.week_bookings || 0;

  document
    .getElementById("monthRevenue")
    .textContent =
      formatMoney(
        data.stats?.month_revenue_minor || 0,
        data.business?.currency
      );

  document
    .getElementById("outstandingAmount")
    .textContent =
      formatMoney(
        data.stats?.outstanding_minor || 0,
        data.business?.currency
      );

  document
    .getElementById("customerCount")
    .textContent =
      data.stats?.customers || 0;

  document
    .getElementById("newCustomersMonth")
    .textContent =
      data.stats?.new_customers_month || 0;
}


function renderTodaySchedule(appointments) {
  const container =
    document.getElementById("todaySchedule");

  if (!appointments.length) {
    container.className =
      "es-overview-empty";

    container.innerHTML = `
      <strong>No appointments today.</strong>
      <span>Your schedule is clear.</span>
    `;
    return;
  }

  container.className =
    "es-overview-schedule";

  container.innerHTML =
    appointments
      .map(
        appointment =>
          appointmentCard(
            appointment,
            false
          )
      )
      .join("");
}


function renderUpcomingAppointments(appointments) {
  const container =
    document.getElementById(
      "upcomingAppointments"
    );

  const now =
    new Date();

  const future =
    appointments.filter(
      appointment =>
        new Date(
          appointment.start_at
        ) >= now
    );

  if (!future.length) {
    container.className =
      "es-overview-empty";

    container.innerHTML = `
      <strong>No upcoming appointments.</strong>
      <span>New bookings will appear here automatically.</span>
    `;
    return;
  }

  container.className =
    "es-overview-week";

  container.innerHTML =
    future
      .slice(0, 5)
      .map(
        appointment => `
          <div class="es-overview-week-row">
            <div class="es-overview-week-date">
              <strong>${escapeHtml(
                formatTime(
                  appointment.start_at
                )
              )}</strong>
              <span>${escapeHtml(
                formatShortDate(
                  appointment.start_at
                )
              )}</span>
            </div>

            <div class="es-overview-week-main">
              <strong>${escapeHtml(
                `${appointment.first_name} ${appointment.last_name}`
              )}</strong>
              <span>${escapeHtml(
                appointment.service_name
              )}</span>
            </div>

            <a
              class="es-overview-panel-link"
              href="/bookings/?view=bookings&booking=${encodeURIComponent(
                appointment.id
              )}"
            >
              View
            </a>
          </div>
        `
      )
      .join("");
}


function appointmentCard(
  appointment,
  showDate
) {
  return `
    <a
      class="es-overview-appointment"
      href="/bookings/?view=bookings&booking=${encodeURIComponent(
        appointment.id
      )}"
    >
      <div class="es-overview-time">
        <strong>${escapeHtml(
          formatTime(
            appointment.start_at
          )
        )}</strong>
        <span>${escapeHtml(
          showDate
            ? formatShortDate(
                appointment.start_at
              )
            : `until ${formatTime(
                appointment.end_at
              )}`
        )}</span>
      </div>

      <div class="es-overview-appointment-main">
        <strong>${escapeHtml(
          `${appointment.first_name} ${appointment.last_name}`
        )}</strong>
        <span>${escapeHtml(
          appointment.service_name
        )}</span>
      </div>

      <span class="es-overview-status ${escapeHtml(
        appointment.status || ""
      )}">
        ${escapeHtml(
          formatStatus(
            appointment.status
          )
        )}
      </span>
    </a>
  `;
}


function renderRecentActivity(activity) {
  const container =
    document.getElementById(
      "recentActivity"
    );

  if (!activity.length) {
    container.className =
      "es-overview-empty";

    container.innerHTML = `
      <strong>No recent activity yet.</strong>
      <span>Bookings, customers and payments will appear here.</span>
    `;
    return;
  }

  container.className =
    "es-overview-activity";

  container.innerHTML =
    activity
      .slice(0, 5)
      .map(
        item => `
          <div class="es-overview-activity-row">
            <span class="es-overview-activity-dot"></span>

            <div class="es-overview-activity-main">
              <strong>${escapeHtml(
                item.title
              )}</strong>
              <span>${escapeHtml(
                item.detail || ""
              )}</span>
            </div>

            <span class="es-overview-activity-time">
              ${escapeHtml(
                formatActivityDate(
                  item.occurred_at
                )
              )}
            </span>
          </div>
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
      currency: currency || "GBP"
    }
  ).format(
    Number(amountMinor || 0) / 100
  );
}


function formatTime(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(new Date(value));
}


function formatShortDate(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "short"
    }
  ).format(new Date(value));
}


function formatActivityDate(value) {
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
    return formatTime(value);
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short"
    }
  ).format(date);
}


function formatStatus(value) {
  return {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No show"
  }[value] || value || "—";
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


loadDashboard();
