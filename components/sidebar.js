const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard/" },
  { key: "setup", label: "Setup", href: "/setup/" },
  { key: "settings", label: "Settings", href: "/settings/" }
];


export function renderSidebar(activeKey) {
  const sidebar =
    document.getElementById("appSidebar");

  if (!sidebar) {
    return;
  }

  sidebar.innerHTML = `
    <div class="es-sidebar-brand">
      eselram
    </div>

    <nav class="es-sidebar-nav">
      ${navItems.map(item => `
        <a
          href="${item.href}"
          class="${item.key === activeKey ? "active" : ""}"
        >
          ${item.label}
        </a>
      `).join("")}
    </nav>

    <div class="es-sidebar-footer">
      <div
        id="sidebarAccount"
        class="es-sidebar-account"
      >
        <div
          id="sidebarAccountVisual"
          class="es-sidebar-account-initial"
        >
          B
        </div>

        <div class="es-sidebar-account-copy">
          <strong id="sidebarBusinessName">
            Loading…
          </strong>
          <span id="sidebarUserName">
            Owner
          </span>
        </div>
      </div>

      <a
        class="es-sidebar-signout"
        href="/auth/logout.html"
      >
        Log out
      </a>
    </div>
  `;

  loadSidebarIdentity();
}


async function loadSidebarIdentity() {
  const businessTarget =
    document.getElementById("sidebarBusinessName");

  const userTarget =
    document.getElementById("sidebarUserName");

  const visualTarget =
    document.getElementById("sidebarAccountVisual");

  if (
    !businessTarget ||
    !userTarget ||
    !visualTarget
  ) {
    return;
  }

  try {
    const [
      settingsResponse,
      userResponse,
      brandingResponse
    ] = await Promise.all([
      fetch("/api/settings", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      }),
      fetch("/api/auth/me", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      }),
      fetch("/api/branding", {
        headers: { Accept: "application/json" },
        cache: "no-store"
      })
    ]);

    const settingsData =
      settingsResponse.ok
        ? await settingsResponse.json()
        : {};

    const userData =
      userResponse.ok
        ? await userResponse.json()
        : {};

    const brandingData =
      brandingResponse.ok
        ? await brandingResponse.json()
        : {};

    const businessName =
      settingsData.business?.name ||
      brandingData.business?.name ||
      "Business";

    const userName =
      userData.user?.name ||
      "Owner";

    businessTarget.textContent =
      businessName;

    userTarget.textContent =
      userName;

    const logo =
      brandingData.branding?.logo_data_url ||
      "";

    if (logo) {
      visualTarget.className =
        "es-sidebar-account-logo";

      visualTarget.innerHTML = `
        <img
          src="${escapeAttribute(logo)}"
          alt=""
        >
      `;
    } else {
      visualTarget.className =
        "es-sidebar-account-initial";

      visualTarget.textContent =
        String(businessName)
          .trim()
          .charAt(0)
          .toUpperCase() ||
        "B";
    }

  } catch {
    businessTarget.textContent =
      "Business";

    userTarget.textContent =
      "Owner";
  }
}


function escapeAttribute(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
