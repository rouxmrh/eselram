const form = document.getElementById("resetPasswordForm");
const statusBox = document.getElementById("formStatus");
const resetButton = document.getElementById("resetButton");
const token = new URLSearchParams(window.location.search).get("token") || "";

function setStatus(message, className = "es-status") {
  statusBox.hidden = false;
  statusBox.className = className;
  statusBox.textContent = message;
}

document.querySelectorAll(".es-password-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
  });
});

if (!token) {
  setStatus("This password reset link is invalid or has expired.", "es-status error");
  resetButton.disabled = true;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password.length < 12) {
    setStatus("Password must contain at least 12 characters.", "es-status error");
    return;
  }

  if (password !== confirmPassword) {
    setStatus("The passwords do not match.", "es-status error");
    return;
  }

  setStatus("Resetting your password…");
  resetButton.disabled = true;

  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ token, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to reset your password.");
    }

    setStatus(data.message, "es-status success");
    window.setTimeout(() => {
      window.location.replace("/auth/login.html");
    }, 1800);
  } catch (error) {
    setStatus(error.message || "Unable to reset your password.", "es-status error");
    resetButton.disabled = false;
  }
});
