export function renderHeader({
  eyebrow = "",
  title = "",
  description = ""
}) {
  const header = document.getElementById("appHeader");

  if (!header) {
    return;
  }

  header.innerHTML = `
    <div>
      ${
        eyebrow
          ? `
            <p class="es-eyebrow">
              ${eyebrow}
            </p>
          `
          : ""
      }

      <h1>
        ${title}
      </h1>

      ${
        description
          ? `
            <p class="es-lead">
              ${description}
            </p>
          `
          : ""
      }
    </div>

    <div
      id="headerUser"
      class="es-header-user"
    ></div>
  `;
}
