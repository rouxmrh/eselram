const navItems = [
  {
    key: "bookings",
    label: "Bookings",
    href: "/bookings/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M7 3v4M17 3v4M3 10h18"/>
        <path d="M7 14h3M14 14h3M7 17h3M14 17h3"/>
      </svg>
    `
  },
  {
    key: "customers",
    label: "Customers",
    href: "/customers/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3"/>
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0"/>
        <circle cx="17" cy="9" r="2.3"/>
        <path d="M15 14.5a4.5 4.5 0 0 1 5.5 4.4"/>
      </svg>
    `
  },
  {
    key: "services",
    label: "Services",
    href: "/services/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/>
        <circle cx="8" cy="7" r="2"/>
        <circle cx="15" cy="12" r="2"/>
        <circle cx="10" cy="17" r="2"/>
      </svg>
    `
  },
  {
    key: "payments",
    label: "Payments",
    href: "/payments/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="M3 9h18M7 15h4"/>
      </svg>
    `
  },
  {
    key: "communications",
    label: "Communications",
    href: "/communications/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="m4 7 8 6 8-6"/>
      </svg>
    `
  },
  {
    key: "clinical-records",
    label: "Clinical Records",
    href: "/treatment-records/",
    icon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="3" width="14" height="18" rx="2"/>
        <path d="M9 3.5h6M8 9h8M8 13h8M8 17h5"/>
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
    <div
      class="es-sidebar-brand-lockup"
      aria-label="inspired by Eselram"
    >
      <img
        class="es-sidebar-brand-logo"
        src="/assets/eselram_logo.png"
        alt=""
        width="38"
        height="38"
      >

      <div class="es-sidebar-brand-copy">
        <span class="es-sidebar-powered-label">
          inspired by
        </span>
        <span class="es-sidebar-brand-name">
          eselram
        </span>
      </div>
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
  renderMobileNavigation(activeKey);
}


function renderMobileNavigation(activeKey) {
  const layout = document.querySelector(".es-dashboard-layout");
  if (!layout) return;

  document.getElementById("esMobileNavigation")?.remove();

  const currentItem =
    navItems.find(item => item.key === activeKey);

  const mobileNav = document.createElement("div");
  mobileNav.id = "esMobileNavigation";
  mobileNav.className = "es-mobile-navigation";

  mobileNav.innerHTML = `
    <div class="es-mobile-navigation-bar">
      <button
        class="es-mobile-back"
        type="button"
        aria-label="Go back"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 5l-7 7 7 7"/>
        </svg>
        <span>Back</span>
      </button>

      <strong class="es-mobile-navigation-title">
        ${escapeAttribute(currentItem?.label || pageLabel(activeKey))}
      </strong>

      <button
        class="es-mobile-menu-button"
        type="button"
        aria-expanded="false"
        aria-controls="esMobileMenu"
      >
        <span>Menu</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16"/>
        </svg>
      </button>
    </div>

    <div
      id="esMobileMenu"
      class="es-mobile-menu"
      hidden
    >
      <nav aria-label="Mobile navigation">
        ${navItems.map(item => `
          <a
            href="${item.href}"
            class="${item.key === activeKey ? "active" : ""}"
          >
            <span class="es-mobile-menu-icon">
              ${item.icon}
            </span>
            <span>${item.label}</span>
          </a>
        `).join("")}
      </nav>

      <div class="es-mobile-menu-footer">
        <a href="/auth/logout.html" class="es-mobile-menu-logout">
          <span class="es-mobile-menu-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/>
              <path d="M13 8l4 4-4 4"/>
              <path d="M8 12h9"/>
            </svg>
          </span>
          <span>Log out</span>
        </a>
      </div>
    </div>

    <button
      class="es-mobile-menu-backdrop"
      type="button"
      aria-label="Close menu"
      hidden
    ></button>
  `;

  layout.prepend(mobileNav);

  const backButton =
    mobileNav.querySelector(".es-mobile-back");

  const menuButton =
    mobileNav.querySelector(".es-mobile-menu-button");

  const menu =
    mobileNav.querySelector(".es-mobile-menu");

  const backdrop =
    mobileNav.querySelector(".es-mobile-menu-backdrop");

  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = fallbackBackHref(activeKey);
  });

  const setMenuOpen = (open) => {
    if (!menu || !menuButton || !backdrop) return;

    menu.hidden = !open;
    backdrop.hidden = !open;
    menuButton.setAttribute(
      "aria-expanded",
      open ? "true" : "false"
    );

    document.body.classList.toggle(
      "es-mobile-menu-open",
      open
    );
  };

  menuButton?.addEventListener("click", () => {
    setMenuOpen(menu?.hidden ?? true);
  });

  backdrop?.addEventListener("click", () => {
    setMenuOpen(false);
  });

  mobileNav.querySelectorAll(".es-mobile-menu a")
    .forEach(link => {
      link.addEventListener("click", () => setMenuOpen(false));
    });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu && !menu.hidden) {
      setMenuOpen(false);
      menuButton?.focus();
    }
  });
}


function pageLabel(activeKey) {
  const labels = {
    dashboard: "Dashboard",
    packages: "Packages",
    "treatment-records": "Clinical Records"
  };

  return labels[activeKey] || "Eselram";
}


function fallbackBackHref(activeKey) {
  const parents = {
    settings: "/settings/",
    "clinical-records": "/treatment-records/",
    "treatment-records": "/treatment-records/",
    packages: "/bookings/",
    bookings: "/dashboard/"
  };

  return parents[activeKey] || "/dashboard/";
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
