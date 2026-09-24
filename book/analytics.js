(() => {
  const STORAGE_KEY = "eselram_booking_analytics_session";

  function apiUrl(path) {
    const configured = String(window.__ESELRAM_API_ORIGIN__ || "").trim().replace(/\/+$/, "");
    if (!configured) return path;
    try { return new URL(path, `${configured}/`).toString(); } catch { return path; }
  }

  function safeStoredToken() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY) || "";
      if (/^[A-Za-z0-9_-]{16,120}$/.test(existing)) return existing;
      const token = `v_${crypto.randomUUID().replace(/-/g, "")}`;
      localStorage.setItem(STORAGE_KEY, token);
      return token;
    } catch {
      return `v_${crypto.randomUUID().replace(/-/g, "")}`;
    }
  }

  function safeReferrer() {
    if (!document.referrer) return "";
    try {
      const url = new URL(document.referrer);
      return `${url.origin}${url.pathname}`.slice(0, 500);
    } catch { return ""; }
  }

  function inferredSource(params) {
    const explicit = String(params.get("utm_source") || "").trim().toLowerCase();
    if (explicit) return explicit.slice(0, 80);
    if (!document.referrer) return "direct";
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (host.includes("instagram.com") || host.includes("l.instagram.com")) return "instagram";
      if (host.includes("facebook.com") || host.includes("fb.com")) return "facebook";
      if (host.includes("google.")) return "google";
      if (host.includes("bing.com")) return "bing";
      return "referral";
    } catch { return "direct"; }
  }

  async function post(path, body) {
    try {
      await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        keepalive: true
      });
    } catch (error) {
      console.debug("Booking analytics unavailable.", error);
    }
  }

  async function recordBookingPageView() {
    const params = new URLSearchParams(window.location.search);
    await post("/api/public-booking/analytics/session", {
      session_token: safeStoredToken(),
      source: inferredSource(params),
      medium: String(params.get("utm_medium") || "").slice(0, 80),
      campaign: String(params.get("utm_campaign") || "").slice(0, 120),
      content: String(params.get("utm_content") || "").slice(0, 120),
      landing_page: window.location.pathname.slice(0, 300),
      referrer: safeReferrer()
    });
  }

  window.EselramBookingAnalytics = {
    track(eventType, details = {}) {
      return post("/api/public-booking/analytics/event", {
        session_token: safeStoredToken(),
        event_type: eventType,
        service_id: details.service_id || null,
        package_template_id: details.package_template_id || null
      });
    },
    complete(appointmentId) {
      if (!appointmentId) return Promise.resolve();
      return post("/api/public-booking/analytics/complete", {
        session_token: safeStoredToken(),
        appointment_id: appointmentId
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", recordBookingPageView, { once: true });
  } else {
    recordBookingPageView();
  }
})();
