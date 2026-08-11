export default {
  async scheduled(
    controller,
    env,
    ctx
  ) {
    const baseUrl =
      String(
        env.ESELRAM_BASE_URL ||
        ""
      )
        .trim()
        .replace(/\/+$/, "");

    const secret =
      String(
        env.ESELRAM_CRON_SECRET ||
        ""
      ).trim();

    if (
      !baseUrl ||
      !secret
    ) {
      console.error(
        "ESELRAM_BASE_URL and ESELRAM_CRON_SECRET are required."
      );
      return;
    }

    const response =
      await fetch(
        `${baseUrl}/api/communications/reminders`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${secret}`,
            Accept:
              "application/json"
          }
        }
      );

    if (!response.ok) {
      console.error(
        "Eselram reminder run failed:",
        response.status,
        await response.text()
      );
    }
  }
};
