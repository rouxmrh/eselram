const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard/" },
  { key: "setup", label: "Setup", href: "/setup/" },
  { key: "settings", label: "Settings", href: "/settings/" }
];


export function renderSidebar(
  activeKey
) {

  const sidebar =
    document.getElementById(
      "appSidebar"
    );


  if (!sidebar) {
    return;
  }


  sidebar.innerHTML = `
    <div class="es-sidebar-brand">
      ESELRAM
    </div>

    <nav class="es-sidebar-nav">
      ${navItems
        .map(
          (item) => `
            <a
              href="${item.href}"
              class="${
                item.key === activeKey
                  ? "active"
                  : ""
              }"
            >
              ${item.label}
            </a>
          `
        )
        .join("")}
    </nav>

    <div class="es-sidebar-footer">
      <div id="sidebarBusinessName">
        Loading…
      </div>

      <a href="/auth/logout.html">
        Sign out
      </a>
    </div>
  `;


  loadSidebarBusinessName();
}


async function loadSidebarBusinessName() {

  const target =
    document.getElementById(
      "sidebarBusinessName"
    );


  if (!target) {
    return;
  }


  try {

    const response =
      await fetch(
        "/api/me",
        {
          headers: {
            Accept:
              "application/json"
          },
          cache:
            "no-store"
        }
      );


    if (!response.ok) {
      return;
    }


    const data =
      await response.json();


    target.textContent =
      data.business?.name ||
      data.business_name ||
      "";

  } catch {
    // Keep sidebar navigation usable if business-name lookup fails.
  }
}
