const form = document.getElementById("forgotPasswordForm");
const statusBox = document.getElementById("formStatus");
const sendButton = document.getElementById("sendButton");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  statusBox.hidden = false;
  statusBox.className = "es-status";
  statusBox.textContent = "Sending reset instructions…";
  sendButton.disabled = true;

  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        email: document.getElementById("email").value.trim()
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Unable to request a password reset.");
    }

    statusBox.className = "es-status success";
    statusBox.textContent = data.message;
    form.querySelector("input")?.setAttribute("disabled", "disabled");
  } catch (error) {
    statusBox.className = "es-status error";
    statusBox.textContent = error.message || "Unable to request a password reset.";
    sendButton.disabled = false;
  }
});
