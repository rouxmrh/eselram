const daysContainer =
  document.getElementById("daysContainer");

const form =
  document.getElementById("hoursForm");

const statusBox =
  document.getElementById("formStatus");

const continueButton =
  document.getElementById("continueButton");

const days = [
  { weekday: 1, name: "Monday", open: true },
  { weekday: 2, name: "Tuesday", open: true },
  { weekday: 3, name: "Wednesday", open: true },
  { weekday: 4, name: "Thursday", open: true },
  { weekday: 5, name: "Friday", open: true },
  { weekday: 6, name: "Saturday", open: false },
  { weekday: 7, name: "Sunday", open: false }
];

function renderDays() {
  daysContainer.innerHTML = days.map((day) => `
    <div class="es-hours-row" data-weekday="${day.weekday}">

      <div class="es-hours-day">
        <strong>${day.name}</strong>
      </div>

      <label class="es-hours-toggle">
        <input
          type="checkbox"
          class="day-open"
          ${day.open ? "checked" : ""}
        >
        Open
      </label>

      <input
        type="time"
        class="open-time"
        value="09:00"
        ${day.open ? "" : "disabled"}
      >

      <span class="es-hours-separator">to</span>

      <input
        type="time"
        class="close-time"
        value="17:00"
        ${day.open ? "" : "disabled"}
      >

    </div>
  `).join("");

  document
    .querySelectorAll(".day-open")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", (event) => {
        const row =
          event.target.closest(".es-hours-row");

        const openTime =
          row.querySelector(".open-time");

        const closeTime =
          row.querySelector(".close-time");

        openTime.disabled = !event.target.checked;
        closeTime.disabled = !event.target.checked;
      });
    });
}

function collectHours() {
  return Array.from(
    document.querySelectorAll(".es-hours-row")
  ).map((row) => {
    const isOpen =
      row.querySelector(".day-open").checked;

    return {
      weekday: Number(row.dataset.weekday),
      is_open: isOpen,
      open_time: isOpen
        ? row.querySelector(".open-time").value
        : null,
      close_time: isOpen
        ? row.querySelector(".close-time").value
        : null
    };
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusBox.hidden = false;
  statusBox.className = "es-status";
  statusBox.textContent =
    "Saving your business hours…";

  continueButton.disabled = true;

  const payload = {
    booking_interval_minutes:
      Number(
        document.getElementById("bookingInterval").value
      ),

    hours: collectHours()
  };

  try {
    const response =
      await fetch("/api/install/hours", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "Unable to save business hours."
      );
    }

    statusBox.classList.add("success");
    statusBox.textContent =
      "Business hours saved.";

    window.location.href =
      "/installer/branding.html";

  } catch (error) {
    console.error(error);

    statusBox.classList.add("error");
    statusBox.textContent =
      error.message || "Something went wrong.";

    continueButton.disabled = false;
  }
});

renderDays();
