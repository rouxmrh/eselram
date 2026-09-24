(() => {
  const STORAGE_KEY = "eselram_booking_analytics_session";

  function apiUrl(path) {
    const configured = String(window.__ESELRAM_API_ORIGIN__ || "")
      .trim()
      .replace(/\/+$/, "");
    if (!configured) return path;
    try {
      return new URL(path, `${configured}/`).toString();
    } catch {
      return path;
    }
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
      // Deliberately remove query strings and fragments so referral URLs
      // cannot leak customer information or tokens into analytics.
      return `${url.origin}${url.pathname}`.slice(0, 500);
    } catch {
      return "";
    }
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
    } catch {
      return "direct";
    }
  }

  async function recordBookingPageView() {
    try {
      const params = new URLSearchParams(window.location.search);
      const payload = {
        session_token: safeStoredToken(),
        source: inferredSource(params),
        medium: String(params.get("utm_medium") || "").slice(0, 80),
        campaign: String(params.get("utm_campaign") || "").slice(0, 120),
        content: String(params.get("utm_content") || "").slice(0, 120),
        landing_page: window.location.pathname.slice(0, 300),
        referrer: safeReferrer()
      };

      await fetch(apiUrl("/api/public-booking/analytics/session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (error) {
      // Analytics is intentionally best-effort and must never affect booking.
      console.debug("Booking analytics unavailable.", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", recordBookingPageView, { once: true });
  } else {
    recordBookingPageView();
  }
})();
