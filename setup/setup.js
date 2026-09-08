const setupHealthStatus =
  document.getElementById(
    "setupHealthStatus"
  );

const setupReady =
  document.getElementById(
    "setupReady"
  );

const setupReadyNote =
  document.getElementById(
    "setupReadyNote"
  );

const setupProgress =
  document.getElementById(
    "setupProgress"
  );

const setupProgressNote =
  document.getElementById(
    "setupProgressNote"
  );

const setupBusiness =
  document.getElementById(
    "setupBusiness"
  );

const setupHost =
  document.getElementById(
    "setupHost"
  );

const setupChecklist =
  document.getElementById(
    "setupChecklist"
  );


document
  .getElementById(
    "refreshSetupHealth"
  )
  .addEventListener(
    "click",
    loadSetupHealth
  );


async function loadSetupHealth() {

  setupHealthStatus.hidden =
    true;

  setupChecklist.innerHTML = `
    <div class="es-empty-state">
      Checking installation…
    </div>
  `;


  try {

    const response =
      await fetch(
        "/api/setup-health",
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
        "Unable to check installation health."
      );
    }


    renderBookingLink(
      data
    );


    renderSummary(
      data
    );


    renderSidebarUser(
      data.user
    );


    renderChecklist(
      data.items || []
    );


  } catch (error) {

    setupHealthStatus.hidden =
      false;

    setupHealthStatus.className =
      "es-status error";

    setupHealthStatus.textContent =
      error.message ||
      "Unable to check installation health.";


    setupChecklist.innerHTML = `
      <div class="es-empty-state">
        <strong>
          Health check unavailable
        </strong>

        <span>
          Check the deployment and database configuration, then try again.
        </span>
      </div>
    `;
  }
}


function renderSidebarUser(user) {

  const sidebarUser =
    document.getElementById(
      "sidebarUser"
    );

  if (!sidebarUser) {
    return;
  }

  const name =
    String(
      user?.name ||
      ""
    ).trim();

  sidebarUser.innerHTML = `
    <strong>
      ${escapeHtml(name || "Owner")}
    </strong>

    <span>
      Owner
    </span>
  `;
}


function renderSummary(data) {

  setupReady.textContent =
    data.ready
      ? "Yes"
      : "No";


  setupReadyNote.textContent =
    data.ready
      ? "Installation checks passed"
      : `${data.progress.remaining} required item${data.progress.remaining === 1 ? "" : "s"} remaining`;


  setupProgress.textContent =
    `${data.progress.complete}/${data.progress.total}`;


  setupProgressNote.textContent =
    data.ready
      ? "Required setup complete"
      : "Complete the checklist below";


  setupBusiness.textContent =
    data.business?.name ||
    "Eselram";


  const brandedHost = (() => {
    try {
      return data.environment?.public_booking_url
        ? new URL(data.environment.public_booking_url).host
        : "Branded Eselram URLs";
    } catch {
      return "Branded Eselram URLs";
    }
  })();


  setupHost.textContent =
    brandedHost;


  if (data.ready) {

    setupHealthStatus.hidden =
      false;

    setupHealthStatus.className =
      "es-status success";

    setupHealthStatus.textContent =
      "This Eselram installation is ready for day-to-day use.";
  }
}


function renderChecklist(items) {

  setupChecklist.innerHTML =
    items
      .map(
        entry => {

          const stateClass =
            entry.complete
              ? "complete"
              : entry.required
                ? "attention"
                : "optional";


          const action =
            entry.href
              ? `
                <a
                  class="es-secondary-button"
                  href="${escapeHtml(entry.href)}"
                >
                  ${
                    entry.complete
                      ? "Review"
                      : "Configure"
                  }
                </a>
              `
              : "";


          return `
            <article class="es-setup-check ${stateClass}">

              <div
                class="es-setup-check-icon"
                aria-hidden="true"
              >
                ${
                  entry.complete
                    ? "✓"
                    : entry.required
                      ? "!"
                      : "i"
                }
              </div>


              <div class="es-setup-check-main">

                <div class="es-setup-check-heading">

                  <strong>
                    ${escapeHtml(entry.label)}
                  </strong>

                  <span class="es-setup-check-status">
                    ${escapeHtml(entry.status)}
                  </span>

                </div>


                <p>
                  ${escapeHtml(entry.detail)}
                </p>

              </div>


              <div class="es-setup-check-action">
                ${action}
              </div>

            </article>
          `;
        }
      )
      .join("");
}


function escapeHtml(value) {

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

const publicBookingLink =
  document.getElementById(
    "publicBookingLink"
  );

const copyBookingLink =
  document.getElementById(
    "copyBookingLink"
  );

const openBookingLink =
  document.getElementById(
    "openBookingLink"
  );

const bookingLinkFeedback =
  document.getElementById(
    "bookingLinkFeedback"
  );


function renderBookingLink(data = {}) {

  const brandedUrl =
    String(
      data?.environment
        ?.public_booking_url ||
      ""
    ).trim();

  const bookingUrl =
    brandedUrl ||
    new URL(
      "/book/",
      window.location.origin
    ).toString();

  if (publicBookingLink) {
    publicBookingLink.value =
      bookingUrl;
  }

  if (openBookingLink) {
    openBookingLink.href =
      bookingUrl;
  }

  if (bookingLinkFeedback) {
    bookingLinkFeedback.textContent =
      brandedUrl
        ? "Your branded Eselram booking link is ready to share."
        : "Your link stays tied to this installation.";
  }
}


function initialiseBookingLink() {
  renderBookingLink();
}


async function handleCopyBookingLink() {

  const bookingUrl =
    publicBookingLink?.value ||
    new URL(
      "/book/",
      window.location.origin
    ).toString();

  try {

    await navigator.clipboard.writeText(
      bookingUrl
    );

    if (copyBookingLink) {
      copyBookingLink.textContent =
        "Copied";
    }

    if (bookingLinkFeedback) {
      bookingLinkFeedback.textContent =
        "Booking link copied — ready to paste into Instagram, Facebook or anywhere you share bookings.";
    }

    window.setTimeout(
      () => {
        if (copyBookingLink) {
          copyBookingLink.textContent =
            "Copy link";
        }
      },
      1800
    );

  } catch (error) {

    if (publicBookingLink) {
      publicBookingLink.focus();
      publicBookingLink.select();
    }

    if (bookingLinkFeedback) {
      bookingLinkFeedback.textContent =
        "Select the booking link and copy it manually.";
    }
  }
}


copyBookingLink?.addEventListener(
  "click",
  handleCopyBookingLink
);

initialiseBookingLink();


loadSetupHealth();
