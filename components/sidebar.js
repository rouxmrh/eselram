export function renderSidebar(activePage) {
  const sidebar = document.getElementById("appSidebar");

  if (!sidebar) {
    return;
  }

const items = [
  { key: "dashboard", label: "Overview", href: "/dashboard/" },
  { key: "bookings", label: "Bookings", href: "/bookings/" },
  { key: "customers", label: "Customers", href: "/customers/" },
  { key: "services", label: "Services", href: "/services/" },
  { key: "packages", label: "Packages & Courses", href: "/packages/" },
  { key: "clinical-records", label: "Clinical Records", href: "/clinical-submissions/" },
  { key: "payments", label: "Payments", href: "/payments/" },
  { key: "communications", label: "Communications", href: "/communications/" },
  { key: "setup", label: "Setup", href: "/setup/" },
  { key: "settings", label: "Settings", href: "/settings/" }
];

  sidebar.innerHTML = `
    <div class="es-sidebar-brand">
      ESELRAM
    </div>

    <nav class="es-sidebar-nav">
      ${items
        .map(
          (item) => `
            <a
              href="${item.href}"
              class="${item.key === activePage ? "active" : ""}"
            >
              ${item.label}
            </a>
          `
        )
        .join("")}
    </nav>

    <div class="es-sidebar-footer">
      <div id="sidebarUser">
        Loading…
      </div>

      <button
        id="logoutButton"
        class="es-logout-button"
        type="button"
      >
        Sign out
      </button>
    </div>
  `;
}
