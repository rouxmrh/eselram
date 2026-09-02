import {
  decryptIntegrationSecret,
  encryptIntegrationSecret
} from "./integration-crypto.js";

const DEFAULT_BROKER =
  "https://eselram-provisioner.mroschhaden.workers.dev";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function setting(env, businessId, key) {
  const row = await env.DB
    .prepare(`
      SELECT setting_value
      FROM business_settings
      WHERE business_id = ? AND setting_key = ?
      LIMIT 1
    `)
    .bind(businessId, key)
    .first();

  return String(row?.setting_value || "").trim();
}

export async function setActiveEmailProvider(
  env,
  businessId,
  provider
) {
  if (!["resend", "gmail"].includes(provider)) {
    throw new Error("Unsupported email provider.");
  }

  await env.DB
    .prepare(`
      INSERT INTO business_settings (
        id,
        business_id,
        setting_key,
        setting_value,
        value_type
      )
      VALUES (?, ?, 'email_active_provider', ?, 'string')
      ON CONFLICT(business_id, setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        value_type = 'string',
        updated_at = CURRENT_TIMESTAMP
    `)
    .bind(
      `setting_${crypto.randomUUID()}`,
      businessId,
      provider
    )
    .run();
}

async function business(env, businessId) {
  return await env.DB
    .prepare(`
      SELECT name, email
      FROM businesses
      WHERE id = ?
      LIMIT 1
    `)
    .bind(businessId)
    .first();
}

async function resendConnection(env, businessId) {
  const row = await env.DB
    .prepare(`
      SELECT id, encrypted_credentials, config_json, status
      FROM business_integrations
      WHERE
        business_id = ?
        AND integration_type = 'email'
        AND provider = 'resend'
      LIMIT 1
    `)
    .bind(businessId)
    .first();

  if (!row?.encrypted_credentials) return null;

  const credentials = parseJson(
    await decryptIntegrationSecret(
      row.encrypted_credentials,
      env.ESELRAM_ENCRYPTION_KEY
    ),
    {}
  );

  const config = parseJson(row.config_json, {});
  const apiKey = String(credentials.api_key || "").trim();
  const fromName = String(config.from_name || "").trim();
  const fromEmail = String(config.from_email || "").trim();

  return {
    provider: "resend",
    integrationId: row.id,
    status: row.status,
    ready: Boolean(apiKey && fromName && fromEmail),
    apiKey,
    managementApiKey: String(credentials.management_api_key || "").trim(),
    credentials,
    fromName,
    fromEmail
  };
}

async function rotateResendSendingKey(env, businessId, connection) {
  const managementKey =
    String(connection?.managementApiKey || "").trim();

  if (!managementKey) {
    throw new Error(
      "The saved Resend sending key is no longer valid. Reconnect Resend in Settings → Email provider to repair the connection."
    );
  }

  const response = await fetch(
    "https://api.resend.com/api-keys",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        name: `Eselram ${String(businessId || "business").slice(0, 24)} Sending`,
        permission: "sending_access"
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.token) {
    throw new Error(
      "The saved Resend connection needs repair. Reconnect Resend in Settings → Email provider."
    );
  }

  const nextCredentials = {
    ...(connection.credentials || {}),
    api_key: data.token
  };

  const encrypted = await encryptIntegrationSecret(
    JSON.stringify(nextCredentials),
    env.ESELRAM_ENCRYPTION_KEY
  );

  await env.DB.prepare(`
    UPDATE business_integrations
    SET encrypted_credentials = ?,
        status = CASE WHEN status = 'disabled' THEN status ELSE 'configured' END,
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND business_id = ?
  `).bind(
    encrypted,
    connection.integrationId,
    businessId
  ).run();

  return data.token;
}

function resendCredentialFailure(response, data) {
  if (response?.status === 401) return true;

  const message = String(
    data?.message || data?.error || ""
  ).toLowerCase();

  return (
    response?.status === 403 &&
    /(expired|revoked|invalid api key|invalid token|unauthori[sz]ed)/i.test(message)
  );
}

async function gmailRow(env, businessId) {
  return await env.DB
    .prepare(`
      SELECT
        id,
        encrypted_credentials,
        config_json,
        status,
        last_tested_at,
        last_error
      FROM business_email_connections
      WHERE business_id = ? AND provider = 'gmail'
      LIMIT 1
    `)
    .bind(businessId)
    .first();
}

async function refreshGmailToken(
  env,
  businessId,
  row,
  credentials
) {
  const expiresAt = Number(credentials.expires_at || 0);
  const now = Math.floor(Date.now() / 1000);

  if (
    credentials.access_token &&
    expiresAt > now + 120
  ) {
    return credentials;
  }

  const refreshToken =
    String(credentials.refresh_token || "").trim();

  if (!refreshToken) {
    throw new Error(
      "Reconnect Gmail. Google did not provide a refresh token for this connection."
    );
  }

  const broker =
    String(
      env.ESELRAM_OAUTH_BROKER_URL ||
      DEFAULT_BROKER
    ).replace(/\/$/, "");

  const response = await fetch(
    `${broker}/api/gmail/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error ||
      "Gmail authorization expired. Reconnect Gmail in Settings → Email provider."
    );
  }

  const next = {
    ...credentials,
    access_token: data.access_token,
    expires_at:
      now + Number(data.expires_in || 3600),
    scope:
      data.scope ||
      credentials.scope ||
      ""
  };

  const encrypted =
    await encryptIntegrationSecret(
      JSON.stringify(next),
      env.ESELRAM_ENCRYPTION_KEY
    );

  await env.DB
    .prepare(`
      UPDATE business_email_connections
      SET
        encrypted_credentials = ?,
        status = 'verified',
        last_error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(encrypted, row.id)
    .run();

  return next;
}

async function gmailConnection(env, businessId) {
  const row = await gmailRow(env, businessId);
  if (!row?.encrypted_credentials) return null;

  let credentials = parseJson(
    await decryptIntegrationSecret(
      row.encrypted_credentials,
      env.ESELRAM_ENCRYPTION_KEY
    ),
    {}
  );

  credentials =
    await refreshGmailToken(
      env,
      businessId,
      row,
      credentials
    );

  const config = parseJson(row.config_json, {});
  const profileEmail =
    String(
      config.email ||
      credentials.email ||
      ""
    ).trim();

  return {
    provider: "gmail",
    status: row.status,
    ready:
      Boolean(
        profileEmail &&
        credentials.access_token
      ),
    email: profileEmail,
    accessToken:
      credentials.access_token,
    senderName:
      String(config.sender_name || "").trim()
  };
}

export async function getActiveEmailConnection(
  env,
  businessId
) {
  if (
    !String(env.ESELRAM_ENCRYPTION_KEY || "").trim()
  ) {
    return {
      error:
        "ESELRAM_ENCRYPTION_KEY is not configured."
    };
  }

  const active =
    (await setting(
      env,
      businessId,
      "email_active_provider"
    )) || "resend";

  if (active === "gmail") {
    const gmail =
      await gmailConnection(env, businessId);

    if (gmail?.ready) {
      return gmail;
    }

    return {
      error:
        "Gmail is selected but is not connected. Reconnect Gmail in Settings → Email provider."
    };
  }

  const resend =
    await resendConnection(env, businessId);

  if (resend?.ready) {
    return resend;
  }

  // If Gmail is connected and Resend is not production-ready, make Gmail a
  // safe fallback for businesses that do not own a domain.
  const gmail =
    await gmailConnection(env, businessId)
      .catch(() => null);

  if (gmail?.ready) {
    return gmail;
  }

  return {
    error:
      "Automated email is not ready. Connect Gmail or finish the Resend sending-domain setup in Settings → Email provider."
  };
}

function cleanHeader(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function base64Utf8(value) {
  const bytes =
    new TextEncoder().encode(String(value || ""));

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64UrlUtf8(value) {
  return base64Utf8(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodedSubject(value) {
  return `=?UTF-8?B?${base64Utf8(value)}?=`;
}

function gmailRawMessage({
  fromName,
  fromEmail,
  to,
  replyTo,
  subject,
  html,
  text
}) {
  const boundary =
    `eselram_${crypto.randomUUID().replaceAll("-", "")}`;

  const headers = [
    `From: ${cleanHeader(fromName)} <${cleanHeader(fromEmail)}>`,
    `To: ${cleanHeader(to)}`,
    replyTo
      ? `Reply-To: ${cleanHeader(replyTo)}`
      : null,
    `Subject: ${encodedSubject(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ].filter(Boolean);

  const raw = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    String(text || ""),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    String(html || ""),
    "",
    `--${boundary}--`,
    ""
  ].join("\r\n");

  return base64UrlUtf8(raw);
}

export async function sendBusinessEmail(
  env,
  businessId,
  {
    to,
    subject,
    html,
    text,
    replyTo = ""
  }
) {
  const recipient =
    String(to || "").trim();

  if (!recipient) {
    throw new Error("Email recipient is missing.");
  }

  const connection =
    await getActiveEmailConnection(
      env,
      businessId
    );

  if (connection?.error) {
    throw new Error(connection.error);
  }

  const businessRow =
    await business(env, businessId);

  const businessName =
    String(
      businessRow?.name ||
      "Eselram"
    ).trim();

  const businessReply =
    String(
      replyTo ||
      businessRow?.email ||
      ""
    ).trim();

  if (connection.provider === "gmail") {
    const senderName =
      connection.senderName ||
      businessName;

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${connection.accessToken}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          raw: gmailRawMessage({
            fromName:
              senderName,
            fromEmail:
              connection.email,
            to:
              recipient,
            replyTo:
              businessReply,
            subject,
            html,
            text
          })
        })
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        "Gmail rejected the email."
      );
    }

    return {
      provider: "gmail",
      id: data?.id || null
    };
  }

  const payload = JSON.stringify({
    from:
      `${connection.fromName} <${connection.fromEmail}>`,
    to: [recipient],
    subject,
    html,
    text,
    ...(businessReply
      ? { reply_to: businessReply }
      : {})
  });

  const sendWithKey = async (apiKey) => {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: payload
      }
    );

    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  let attempt = await sendWithKey(connection.apiKey);

  // The Provisioner stores a buyer-owned permanent sending key and a separate
  // full-access management key. Resend API keys do not auto-expire, but if the
  // sending key is ever revoked, repair it once using the customer's own
  // management key rather than leaving client communications permanently
  // pending.
  if (
    !attempt.response.ok &&
    resendCredentialFailure(attempt.response, attempt.data)
  ) {
    const replacementKey = await rotateResendSendingKey(
      env,
      businessId,
      connection
    );
    attempt = await sendWithKey(replacementKey);
  }

  if (!attempt.response.ok) {
    throw new Error(
      attempt.data?.message ||
      attempt.data?.error ||
      "Resend rejected the email."
    );
  }

  return {
    provider: "resend",
    id: attempt.data?.id || null
  };
}
