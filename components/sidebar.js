const navItems = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5v-9.7Z"/>
      </svg>
    `
  },
  {
    key: "setup",
    label: "Setup",
    href: "/setup/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>
      </svg>
    `
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h10M18 7h2M10 12h10M4 12h2M4 17h10M18 17h2"/>
        <circle cx="16" cy="7" r="2"/>
        <circle cx="8" cy="12" r="2"/>
        <circle cx="16" cy="17" r="2"/>
      </svg>
    `
  }
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
          <span class="es-sidebar-nav-icon">
            ${item.icon}
          </span>
          <span>${item.label}</span>
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

      <div
        class="es-sidebar-powered-by"
        aria-label="Powered by Eselram"
      >
        <img
          class="es-sidebar-powered-logo"
          src="/assets/eselram_logo.png"
          alt=""
        >

        <span class="es-sidebar-powered-copy">
          Powered by esel<strong>ram</strong>
        </span>
      </div>

      <a
        class="es-sidebar-signout"
        href="/auth/logout.html"
      >
        <span class="es-sidebar-nav-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/>
            <path d="M13 8l4 4-4 4"/>
            <path d="M8 12h9"/>
          </svg>
        </span>
        <span>Log out</span>
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
