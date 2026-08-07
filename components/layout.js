import {
  renderSidebar
} from "/components/sidebar.js";

import {
  renderHeader
} from "/components/header.js";


export function renderLayout({
  activePage,
  eyebrow,
  title,
  description
}) {
  renderSidebar(activePage);

  renderHeader({
    eyebrow,
    title,
    description
  });
}


export function bindSharedLogout() {
  const logoutButton =
    document.getElementById("logoutButton");

  if (!logoutButton) {
    return;
  }

  logoutButton.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;

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
}


export function setSharedUser({
  name,
  role = "Owner"
}) {
  const sidebarUser =
    document.getElementById("sidebarUser");

  const headerUser =
    document.getElementById("headerUser");

  if (sidebarUser) {
    sidebarUser.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(role)}</span>
    `;
  }

  if (headerUser) {
    headerUser.textContent =
      name;
  }
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
