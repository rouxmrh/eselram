const CF_API = "https://api.cloudflare.com/client/v4";
const GH_API = "https://api.github.com";
const RESEND_API = "https://api.resend.com";

const COOKIE = {
  cloudflare: "eselram_cf",
  github: "eselram_gh",
  resend: "eselram_resend",
  stripe: "eselram_stripe",
  cfAccount: "eselram_cf_account",
  install: "eselram_install_state"
};

const OAUTH_COOKIE_PREFIX = "eselram_oauth_";
const CONNECTED_MAX_AGE = 60 * 60 * 2; // temporary authorisation only
const STATE_MAX_AGE = 60 * 10;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/status" && request.method === "GET") return await statusResponse(request, env);
      if (url.pathname.startsWith("/api/connect/") && request.method === "GET") return await startProvider(request, env, url.pathname.split("/").pop());
      if (url.pathname.startsWith("/oauth/") && url.pathname.endsWith("/callback") && request.method === "GET") {
        return await providerCallback(request, env, url.pathname.split("/")[2]);
      }
      if (url.pathname === "/api/cloudflare/account" && request.method === "POST") return await selectCloudflareAccount(request, env);
      if (url.pathname === "/api/provision" && request.method === "POST") return await provision(request, env);
      if (url.pathname === "/api/reset" && request.method === "POST") return resetResponse();
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Provisioner request failed", error);
      return json({ ok: false, error: error?.message || "Unexpected provisioner error." }, 500);
    }
  }
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function redirect(location, headers = {}) {
  return new Response(null, { status: 302, headers: { Location: location, ...headers } });
}

function cookieHeader(name, value, maxAge = CONNECTED_MAX_AGE) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function randomUrlSafe(bytes = 24) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const str = String(value || "");
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
}

async function sha256Text(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}

async function cookieKey(env) {
  if (!env.PROVISIONER_COOKIE_KEY) throw new Error("PROVISIONER_COOKIE_KEY is not configured.");
  const digest = await sha256Text(env.PROVISIONER_COOKIE_KEY);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function seal(env, value) {
  const key = await cookieKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  return `${base64Url(iv)}.${base64Url(encrypted)}`;
}

async function unseal(env, value) {
  if (!value) return null;
  try {
    const [ivPart, dataPart] = String(value).split(".");
    if (!ivPart || !dataPart) return null;
    const key = await cookieKey(env);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBase64Url(ivPart) }, key, decodeBase64Url(dataPart));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

async function providerCredential(request, env, provider) {
  return unseal(env, readCookie(request, COOKIE[provider]));
}

async function selectedAccount(request, env) {
  const data = await unseal(env, readCookie(request, COOKIE.cfAccount));
  return data?.account_id || null;
}

async function installState(request, env) {
  return (await unseal(env, readCookie(request, COOKIE.install))) || {};
}

function callbackUrl(env, provider) {
  const base = String(env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_BASE_URL is not configured.");
  return `${base}/oauth/${provider}/callback`;
}

async function statusResponse(request, env) {
  const creds = {};
  for (const provider of ["cloudflare", "github", "resend", "stripe"]) {
    creds[provider] = await providerCredential(request, env, provider);
  }

  let accounts = [];
  if (creds.cloudflare?.access_token) {
    accounts = await cloudflareAccounts(creds.cloudflare.access_token).catch(() => []);
  }

  let selected = await selectedAccount(request, env);
  let install = await installState(request, env);
  const responseHeaders = new Headers();

  if (!selected && accounts.length === 1) {
    selected = accounts[0].id;
    responseHeaders.append(
      "Set-Cookie",
      cookieHeader(COOKIE.cfAccount, await seal(env, { account_id: selected }))
    );
  }

  if (install.status === "deploying" && creds.cloudflare?.access_token) {
    const updated = await refreshDeploymentState(install, creds.cloudflare.access_token).catch((error) => {
      console.error("Deployment status refresh failed", error);
      return install;
    });

    if (JSON.stringify(updated) !== JSON.stringify(install)) {
      install = updated;
      responseHeaders.append(
        "Set-Cookie",
        cookieHeader(COOKIE.install, await seal(env, install))
      );
    }
  }

  const defaultSteps = {
    repository: { status: "pending", message: "Your private GitHub copy will be created during installation." },
    database: { status: "pending", message: "Your D1 database will be created in your Cloudflare account." },
    storage: { status: "pending", message: "Your private R2 storage will be created in your Cloudflare account." },
    security: { status: "pending", message: "Your installation-specific secrets will be generated and injected directly into your Cloudflare application." },
    email: { status: creds.resend ? "complete" : "pending", message: creds.resend ? "Email account connected temporarily for setup." : "Connect email to continue." },
    payments: { status: creds.stripe ? "complete" : "pending", message: creds.stripe ? "Stripe connected temporarily for setup." : "Stripe is optional when Pay in person is selected." },
    migrations: { status: "pending", message: "Database migrations will be applied automatically." },
    application: { status: "pending", message: "Your Cloudflare Pages application will be created and deployed automatically." },
    verify: { status: "pending", message: "Eselram will verify the deployed application before setup is handed over to you." }
  };

  const steps = { ...defaultSteps, ...(install.steps || {}) };
  const body = {
    ok: true,
    session: {
      status: install.status || "connecting",
      installation_url: install.installation_url || null,
      message: install.message || "",
      can_resume: !!(
        install?.resources?.github_owner &&
        install?.resources?.github_repo &&
        install?.resources?.cloudflare_account_id &&
        install?.resources?.d1_database_id &&
        install?.resources?.r2_bucket_name
      )
    },
    providers: {
      cloudflare: { connected: !!creds.cloudflare, available: !!env.CLOUDFLARE_CLIENT_ID && !!env.CLOUDFLARE_CLIENT_SECRET },
      github: { connected: !!creds.github, available: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET },
      resend: { connected: !!creds.resend, available: !!env.RESEND_CLIENT_ID && !!env.RESEND_CLIENT_SECRET },
      stripe: { connected: !!creds.stripe, available: !!env.STRIPE_CONNECT_CLIENT_ID && !!env.STRIPE_SECRET_KEY }
    },
    cloudflare_accounts: accounts,
    selected_cloudflare_account_id: selected,
    steps
  };

  const response = json(body);
  for (const value of responseHeaders.getSetCookie?.() || []) {
    response.headers.append("Set-Cookie", value);
  }
  if (!responseHeaders.getSetCookie && responseHeaders.has("Set-Cookie")) {
    response.headers.append("Set-Cookie", responseHeaders.get("Set-Cookie"));
  }
  return response;
}


async function discoverCloudflarePagesOAuthScope(accessToken) {
  if (!accessToken) return null;

  // Cloudflare's OAuth client UI shows human-readable permission names, while
  // authorization requests must use the catalog's exact scope `id`.
  // Discover that ID from Cloudflare instead of hard-coding pages.write.
  for (let page = 1; page <= 25; page++) {
    const response = await fetch(`${CF_API}/oauth/scopes?page=${page}&per_page=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.errors?.[0]?.message ||
        "Cloudflare could not list its OAuth scope catalog. Reconnect Cloudflare with the existing base permissions first."
      );
    }

    const scopes = Array.isArray(data?.result) ? data.result : [];
    const candidate = scopes.find((item) => {
      const name = String(item?.name || "").toLowerCase();
      const category = String(item?.category || "").toLowerCase();
      return (
        item?.id &&
        name.includes("pages") &&
        (name.includes("write") || name.includes("edit")) &&
        (!category || category.includes("developer") || category.includes("platform"))
      );
    }) || scopes.find((item) => {
      const name = String(item?.name || "").toLowerCase();
      return item?.id && name.includes("pages") && (name.includes("write") || name.includes("edit"));
    });

    if (candidate?.id) return String(candidate.id);

    const info = data?.result_info || {};
    const totalPages = Math.ceil(Number(info.total_count || 0) / Math.max(Number(info.per_page || 100), 1));
    if (!scopes.length || (totalPages && page >= totalPages)) break;
  }

  throw new Error(
    "Cloudflare's OAuth catalog did not return a Pages Edit/Write scope. Check that Pages → Edit is enabled on the Eselram Provisioner OAuth client."
  );
}

function mergeOAuthScopes(baseScopes, extraScope) {
  const values = String(baseScopes || "")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value !== "pages.write"); // remove the previously guessed invalid ID

  if (extraScope && !values.includes(extraScope)) values.push(extraScope);
  return values.join(" ");
}

async function startProvider(request, env, provider) {
  const state = randomUrlSafe(24);
  const redirectUri = callbackUrl(env, provider);
  let verifier = null;
  let target;

  if (provider === "cloudflare") {
    requireOAuth(env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET, "Cloudflare");

    const existingCloudflare = await providerCredential(request, env, "cloudflare");
    let pagesScope = null;

    if (existingCloudflare?.access_token) {
      pagesScope = await discoverCloudflarePagesOAuthScope(existingCloudflare.access_token);
    }

    // First-time users can authorize the proven base scopes. Once connected,
    // Reconnect Cloudflare discovers and requests the exact Pages scope ID from
    // Cloudflare's live OAuth catalog.
    const requestedScopes = mergeOAuthScopes(env.CLOUDFLARE_OAUTH_SCOPES || "", pagesScope);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.CLOUDFLARE_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: requestedScopes,
      state
    });
    target = `https://dash.cloudflare.com/oauth2/auth?${params}`;
  } else if (provider === "github") {
    requireOAuth(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET, "GitHub");
    const params = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: redirectUri, scope: env.GITHUB_OAUTH_SCOPES || "repo read:user user:email", state });
    target = `https://github.com/login/oauth/authorize?${params}`;
  } else if (provider === "resend") {
    requireOAuth(env.RESEND_CLIENT_ID, env.RESEND_CLIENT_SECRET, "Resend");
    verifier = randomUrlSafe(64);
    const challenge = base64Url(await sha256Text(verifier));
    const params = new URLSearchParams({ client_id: env.RESEND_CLIENT_ID, response_type: "code", redirect_uri: redirectUri, scope: env.RESEND_OAUTH_SCOPE || "full_access", state, code_challenge: challenge, code_challenge_method: "S256" });
    target = `${RESEND_API}/oauth/authorize?${params}`;
  } else if (provider === "stripe") {
    requireOAuth(env.STRIPE_CONNECT_CLIENT_ID, env.STRIPE_SECRET_KEY, "Stripe");
    const params = new URLSearchParams({ response_type: "code", client_id: env.STRIPE_CONNECT_CLIENT_ID, scope: env.STRIPE_OAUTH_SCOPE || "read_write", redirect_uri: redirectUri, state });
    target = `https://connect.stripe.com/oauth/authorize?${params}`;
  } else {
    return json({ ok: false, error: "Unknown provider." }, 404);
  }

  const oauthCookie = await seal(env, { state, verifier, redirect_uri: redirectUri, created_at: Date.now() });
  return redirect(target, { "Set-Cookie": cookieHeader(`${OAUTH_COOKIE_PREFIX}${provider}`, oauthCookie, STATE_MAX_AGE) });
}

function requireOAuth(id, secret, provider) {
  if (!id || !secret) throw new Error(`${provider} OAuth is not configured on the provisioner.`);
}

async function providerCallback(request, env, provider) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const oauthError = url.searchParams.get("error") || "";
  const oauthErrorDescription = url.searchParams.get("error_description") || "";
  const oauthErrorUri = url.searchParams.get("error_uri") || "";

  if (oauthError) {
    const description = oauthErrorDescription
      ? decodeURIComponent(oauthErrorDescription.replace(/\+/g, " "))
      : "";
    const detail = [
      `${provider} authorization failed: ${oauthError}`,
      description,
      oauthErrorUri ? `More information: ${oauthErrorUri}` : ""
    ].filter(Boolean).join(" — ");
    throw new Error(detail);
  }

  if (!state || !code) {
    const returnedParams = [...url.searchParams.keys()]
      .filter((key) => !["code", "state"].includes(key))
      .join(", ");
    throw new Error(
      `OAuth callback is missing ${!state && !code ? "state and code" : !state ? "state" : "code"}${returnedParams ? `. Returned parameters: ${returnedParams}` : "."}`
    );
  }

  const oauth = await unseal(env, readCookie(request, `${OAUTH_COOKIE_PREFIX}${provider}`));
  if (!oauth || oauth.state !== state || (Date.now() - Number(oauth.created_at || 0)) > STATE_MAX_AGE * 1000) {
    throw new Error("This authorization request has expired or is invalid.");
  }

  let secret;
  if (provider === "cloudflare") {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: oauth.redirect_uri });
    secret = await fetchFormJson(
      "https://dash.cloudflare.com/oauth2/token",
      body,
      {},
      basicAuth(env.CLOUDFLARE_CLIENT_ID, env.CLOUDFLARE_CLIENT_SECRET)
    );
  } else if (provider === "github") {
    const body = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: oauth.redirect_uri });
    secret = await fetchFormJson("https://github.com/login/oauth/access_token", body, { Accept: "application/json" });
  } else if (provider === "resend") {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: oauth.redirect_uri, code_verifier: oauth.verifier || "" });
    secret = await fetchFormJson(`${RESEND_API}/oauth/token`, body, {}, basicAuth(env.RESEND_CLIENT_ID, env.RESEND_CLIENT_SECRET));
  } else if (provider === "stripe") {
    const body = new URLSearchParams({ grant_type: "authorization_code", code });
    secret = await fetchFormJson("https://connect.stripe.com/oauth/token", body, {}, basicAuth(env.STRIPE_SECRET_KEY, ""));
  } else {
    throw new Error("Unknown OAuth provider.");
  }

  const sealed = await seal(env, secret);
  const headers = new Headers();
  headers.append("Location", "/");
  headers.append("Set-Cookie", cookieHeader(COOKIE[provider], sealed));
  headers.append("Set-Cookie", clearCookie(`${OAUTH_COOKIE_PREFIX}${provider}`));
  return new Response(null, { status: 302, headers });
}

function basicAuth(user, pass) {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

async function fetchFormJson(url, body, extraHeaders = {}, authorization = "") {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...extraHeaders, ...(authorization ? { Authorization: authorization } : {}) }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error_description || data.error || `OAuth token exchange failed (${response.status}).`);
  return data;
}

async function cloudflareAccounts(accessToken) {
  const response = await fetch(`${CF_API}/accounts?per_page=50`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error("Unable to load Cloudflare accounts.");
  return (data.result || []).map((item) => ({ id: item.id, name: item.name }));
}

async function selectCloudflareAccount(request, env) {
  const body = await request.json().catch(() => ({}));
  const accountId = String(body.account_id || "").trim();
  const cf = await providerCredential(request, env, "cloudflare");
  if (!cf?.access_token) return json({ ok: false, error: "Connect Cloudflare first." }, 409);
  const accounts = await cloudflareAccounts(cf.access_token);
  if (!accounts.some((item) => item.id === accountId)) return json({ ok: false, error: "That Cloudflare account is not authorized." }, 400);
  return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(COOKIE.cfAccount, await seal(env, { account_id: accountId })) });
}

async function githubRequest(token, path, options = {}) {
  const requestHeaders = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "Eselram-Provisioner",
    ...(options.headers || {})
  };

  if (options.body && !requestHeaders["Content-Type"] && !requestHeaders["content-type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: requestHeaders
  });

  if (options.raw && response.ok) return response.text();

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(data.errors)
      ? data.errors.map((item) => item?.message || item?.code || JSON.stringify(item)).join("; ")
      : "";
    const docs = data.documentation_url ? ` ${data.documentation_url}` : "";
    throw new Error(
      `GitHub request failed (${response.status}) for ${options.method || "GET"} ${path}: ${data.message || "Unknown GitHub error"}${detail ? ` — ${detail}` : ""}.${docs}`
    );
  }
  return data;
}


async function readTemplateMigrationsFromArchive(token, owner, repo, ref) {
  const archiveResponse = await fetch(
    `${GH_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "Eselram-Provisioner"
      },
      redirect: "follow"
    }
  );

  if (!archiveResponse.ok) {
    let detail = "";
    try {
      const data = await archiveResponse.json();
      detail = data?.message ? `: ${data.message}` : "";
    } catch {}
    throw new Error(`Unable to download Eselram template archive (${archiveResponse.status})${detail}.`);
  }

  if (!archiveResponse.body) {
    throw new Error("GitHub returned an empty Eselram template archive.");
  }

  const decompressed = archiveResponse.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(decompressed).arrayBuffer());

  const migrations = [];
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    const empty = header.every((value) => value === 0);
    if (empty) break;

    const readString = (start, length) =>
      decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/, "").trim();

    const name = readString(0, 100);
    const prefix = readString(345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const sizeText = readString(124, 12);
    const size = parseInt(sizeText || "0", 8) || 0;
    const typeFlag = readString(156, 1) || "0";

    offset += 512;
    if (offset + size > bytes.length) {
      throw new Error("The Eselram template archive was truncated while reading migrations.");
    }

    if (
      (typeFlag === "0" || typeFlag === "") &&
      /\/database\/migrations\/[^/]+\.sql$/i.test(fullName)
    ) {
      const sql = decoder.decode(bytes.subarray(offset, offset + size));
      const fileName = fullName.split("/").pop();
      migrations.push({ name: fileName, sql });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  migrations.sort((a, b) => a.name.localeCompare(b.name));

  if (!migrations.length) {
    throw new Error("No Eselram database migrations were found in the template archive.");
  }

  return migrations;
}

async function applyD1MigrationBatch(accessToken, accountId, databaseId, migrations) {
  const combinedSql = migrations
    .map(({ name, sql }) => `-- ESELRAM MIGRATION: ${name}\n${sql.trim()}\n`)
    .join("\n");

  const response = await fetch(
    `${CF_API}/accounts/${accountId}/d1/database/${databaseId}/raw`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql: combinedSql })
    }
  );

  const data = await response.json().catch(() => ({}));
  const failed =
    !response.ok ||
    data?.success === false ||
    (Array.isArray(data?.result) && data.result.some((entry) => entry?.success === false)) ||
    (Array.isArray(data) && data.some((entry) => entry?.success === false));

  if (failed) {
    const detail =
      data?.errors?.[0]?.message ||
      data?.message ||
      data?.result?.find?.((entry) => entry?.success === false)?.error ||
      "Unknown D1 migration error";
    throw new Error(`Database migration batch failed: ${detail}`);
  }

  return data;
}

async function cfRequest(token, accountId, path, options = {}) {
  const response = await fetch(`${CF_API}/accounts/${accountId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const detail = data.errors?.[0]?.message || data.messages?.[0]?.message || `Cloudflare request failed (${response.status}).`;
    throw new Error(`Cloudflare request failed for ${options.method || "GET"} ${path}: ${detail}`);
  }
  return data.result ?? data;
}

async function cfFormRequest(token, accountId, path, formData) {
  const response = await fetch(`${CF_API}/accounts/${accountId}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const detail = data.errors?.[0]?.message || data.messages?.[0]?.message || `Cloudflare request failed (${response.status}).`;
    throw new Error(`Cloudflare deployment request failed for ${path}: ${detail}`);
  }
  return data.result ?? data;
}

async function d1Query(token, accountId, databaseId, sql, params = []) {
  const response = await fetch(`${CF_API}/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql, params })
  });
  const data = await response.json().catch(() => ({}));
  const failed =
    !response.ok ||
    data?.success === false ||
    (Array.isArray(data?.result) && data.result.some((entry) => entry?.success === false));
  if (failed) {
    const detail = data?.errors?.[0]?.message || data?.result?.find?.((entry) => entry?.success === false)?.error || "D1 query failed.";
    throw new Error(detail);
  }
  return data.result ?? data;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptIntegrationCredential(value, installationSecret) {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(installationSecret || ""))
  );
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(String(value || ""))
    )
  );
  return ["v1", bytesToBase64(iv), bytesToBase64(ciphertext)].join(":");
}

async function refreshResendCredential(env, resendCredential) {
  const refreshToken = String(resendCredential?.refresh_token || "").trim();

  // Resend OAuth access tokens are intentionally short-lived. If we have a
  // refresh token, rotate it immediately before provisioning so long setup
  // sessions cannot fail with an expired JWT.
  if (!refreshToken) {
    const accessToken = String(resendCredential?.access_token || "").trim();
    if (!accessToken) throw new Error("Reconnect Email: the Resend OAuth session has no usable access or refresh token.");
    return resendCredential;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  try {
    const refreshed = await fetchFormJson(
      `${RESEND_API}/oauth/token`,
      body,
      {},
      basicAuth(env.RESEND_CLIENT_ID, env.RESEND_CLIENT_SECRET)
    );
    return refreshed;
  } catch (error) {
    throw new Error(`Reconnect Email: the Resend authorization has expired and could not be refreshed. ${error?.message || ""}`.trim());
  }
}

async function createResendApiKey(resendCredential, slug, permission = "sending_access", suffix = "") {
  const accessToken = String(resendCredential?.access_token || "").trim();
  if (!accessToken) throw new Error("Reconnect Email: the Resend OAuth connection does not contain an access token.");

  const label = suffix ? `Eselram ${slug} ${suffix}` : `Eselram ${slug}`;
  const response = await fetch(`${RESEND_API}/api-keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: label.slice(0, 50),
      permission
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token) {
    const message = data?.message || data?.error || "Unable to create the buyer-owned Resend API key.";
    throw new Error(`Resend setup failed: ${message}`);
  }
  return { id: data.id || null, token: data.token, permission };
}

async function seedConnectedIntegrations({
  cfToken,
  accountId,
  databaseId,
  installationSecret,
  resendSendingKey,
  resendSetupKey,
  stripeCredential,
  paymentMode
}) {
  const businessId = "biz_provisioned";

  await d1Query(
    cfToken,
    accountId,
    databaseId,
    `INSERT OR IGNORE INTO businesses (id, name, country_code, timezone, currency, locale)
     VALUES (?, ?, 'GB', 'Europe/London', 'GBP', 'en-GB')`,
    [businessId, "Eselram setup"]
  );

  const encryptedEmail = await encryptIntegrationCredential(
    JSON.stringify({
      api_key: resendSendingKey?.token || "",
      management_api_key: resendSetupKey?.token || "",
      management_api_key_id: resendSetupKey?.id || null
    }),
    installationSecret
  );

  await d1Query(
    cfToken,
    accountId,
    databaseId,
    `INSERT INTO business_integrations (
       id, business_id, integration_type, provider,
       encrypted_credentials, config_json, status
     )
     VALUES (?, ?, 'email', 'resend', ?, ?, 'configured')
     ON CONFLICT(business_id, integration_type) DO UPDATE SET
       provider = excluded.provider,
       encrypted_credentials = excluded.encrypted_credentials,
       config_json = excluded.config_json,
       status = 'configured',
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      `bi_${crypto.randomUUID()}`,
      businessId,
      encryptedEmail,
      JSON.stringify({
        from_name: "",
        from_email: "",
        sending_domain_id: null,
        sending_domain_name: "",
        sending_domain_status: "not_configured"
      })
    ]
  );

  const stripeAccessToken = String(stripeCredential?.access_token || "").trim();
  const stripeConnected = Boolean(stripeAccessToken);

  if (paymentMode === "stripe" && !stripeConnected) {
    throw new Error("Stripe was selected but the Stripe authorization is no longer available. Reconnect Stripe.");
  }

  if (stripeConnected) {
    const stripeMode =
      stripeCredential?.livemode === true || stripeAccessToken.includes("_live_")
        ? "live"
        : "sandbox";

    const encryptedStripe = await encryptIntegrationCredential(
      JSON.stringify({
        secret_key: stripeAccessToken,
        webhook_secret: null,
        credential_source: "stripe_connect_oauth"
      }),
      installationSecret
    );

    const stripeConfig = JSON.stringify({
      publishable_key: stripeCredential?.stripe_publishable_key || "",
      currency: "GBP",
      mode: stripeMode,
      has_webhook_secret: false,
      connected_account_id: stripeCredential?.stripe_user_id || null,
      connected_via: "provisioner"
    });

    await d1Query(
      cfToken,
      accountId,
      databaseId,
      `INSERT INTO business_integrations (
         id, business_id, integration_type, provider,
         encrypted_credentials, config_json, status
       )
       VALUES (?, ?, 'payments', 'stripe', ?, ?, 'configured')
       ON CONFLICT(business_id, integration_type) DO UPDATE SET
         provider = excluded.provider,
         encrypted_credentials = excluded.encrypted_credentials,
         config_json = excluded.config_json,
         status = 'configured',
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [`bi_${crypto.randomUUID()}`, businessId, encryptedStripe, stripeConfig]
    );

    await d1Query(
      cfToken,
      accountId,
      databaseId,
      `INSERT INTO business_payment_providers (
         id, business_id, provider_key, is_enabled, is_default,
         connection_status, environment, external_account_reference, webhook_status
       )
       VALUES (?, ?, 'stripe', 1, ?, 'connected', ?, ?, 'not_configured')
       ON CONFLICT(business_id, provider_key) DO UPDATE SET
         is_enabled = 1,
         is_default = excluded.is_default,
         connection_status = 'connected',
         environment = excluded.environment,
         external_account_reference = excluded.external_account_reference,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `payprov_${crypto.randomUUID()}`,
        businessId,
        paymentMode === "stripe" ? 1 : 0,
        stripeMode,
        stripeCredential?.stripe_user_id || null
      ]
    );
  }

  if (paymentMode === "manual") {
    await d1Query(
      cfToken,
      accountId,
      databaseId,
      `INSERT INTO business_payment_providers (
         id, business_id, provider_key, is_enabled, is_default,
         connection_status, environment, webhook_status
       )
       VALUES (?, ?, 'manual', 1, 1, 'connected', 'manual', 'configured')
       ON CONFLICT(business_id, provider_key) DO UPDATE SET
         is_enabled = 1,
         is_default = 1,
         connection_status = 'connected',
         environment = 'manual',
         webhook_status = 'configured',
         updated_at = CURRENT_TIMESTAMP`,
      [`payprov_${crypto.randomUUID()}`, businessId]
    );

    if (stripeConnected) {
      await d1Query(
        cfToken,
        accountId,
        databaseId,
        `UPDATE business_payment_providers
         SET is_default = 0
         WHERE business_id = ? AND provider_key = 'stripe'`,
        [businessId]
      );
    }
  } else if (paymentMode === "stripe") {
    await d1Query(
      cfToken,
      accountId,
      databaseId,
      `UPDATE business_payment_providers
       SET is_default = CASE WHEN provider_key = 'stripe' THEN 1 ELSE 0 END
       WHERE business_id = ?`,
      [businessId]
    );
  }
}

function pagesDeploymentConfig({ baseUrl, d1Id, bucketName, encryptionKey, cronSecret }) {
  return {
    compatibility_date: "2026-08-18",
    fail_open: false,
    env_vars: {
      ESELRAM_BASE_URL: { type: "plain_text", value: baseUrl },
      ESELRAM_ENCRYPTION_KEY: { type: "secret_text", value: encryptionKey },
      ESELRAM_CRON_SECRET: { type: "secret_text", value: cronSecret }
    },
    d1_databases: {
      DB: { id: d1Id }
    },
    r2_buckets: {
      FORM_UPLOADS: { name: bucketName }
    }
  };
}

function pagesSourceConfig(repo, branch, productionDeploymentsEnabled = false) {
  return {
    type: "github",
    config: {
      owner: repo.owner.login,
      owner_id: String(repo.owner.id),
      repo_name: repo.name,
      repo_id: String(repo.id),
      production_branch: branch,
      production_deployments_enabled: productionDeploymentsEnabled,
      preview_deployment_setting: "none",
      pr_comments_enabled: false
    }
  };
}

async function getPagesProjectIfExists(cfToken, accountId, projectName) {
  try {
    return await cfRequest(
      cfToken,
      accountId,
      `/pages/projects/${encodeURIComponent(projectName)}`
    );
  } catch (error) {
    const message = String(error?.message || error);
    if (/\b404\b|not found/i.test(message)) return null;
    throw error;
  }
}

function pagesProjectMatchesRepo(project, repo) {
  const config = project?.source?.config || {};
  const wantedOwner = String(repo?.owner?.login || "").toLowerCase();
  const wantedRepo = String(repo?.name || "").toLowerCase();
  const actualOwner = String(config?.owner || "").toLowerCase();
  const actualRepo = String(config?.repo_name || "").toLowerCase();

  if (!project?.source) return false;
  if (String(project.source.type || "").toLowerCase() !== "github") return false;

  // Prefer immutable GitHub IDs when Cloudflare returns them.
  if (config?.repo_id && repo?.id && String(config.repo_id) !== String(repo.id)) return false;
  if (config?.owner_id && repo?.owner?.id && String(config.owner_id) !== String(repo.owner.id)) return false;

  return actualOwner === wantedOwner && actualRepo === wantedRepo;
}

function isPagesAuthorizationError(message) {
  return /authentication error|authorization|unauthori[sz]ed|forbidden|permission|not authorized|access denied/i.test(
    String(message || "")
  );
}

async function createAndDeployPagesProject({
  cfToken,
  accountId,
  repo,
  branch,
  projectName,
  d1Id,
  bucketName,
  encryptionKey,
  cronSecret
}) {
  const predictedBaseUrl = `https://${projectName}.pages.dev`;
  const deploymentConfig = pagesDeploymentConfig({
    baseUrl: predictedBaseUrl,
    d1Id,
    bucketName,
    encryptionKey,
    cronSecret
  });

  // A failed earlier installation can leave a Pages project behind that still
  // points at a temporary GitHub repository which the buyer later deleted.
  // Reuse the project only when it is linked to THIS installation's repository.
  let existingProject = await getPagesProjectIfExists(cfToken, accountId, projectName);

  if (existingProject && !pagesProjectMatchesRepo(existingProject, repo)) {
    await cfRequest(
      cfToken,
      accountId,
      `/pages/projects/${encodeURIComponent(projectName)}`,
      { method: "DELETE" }
    );
    existingProject = null;
  }

  let project;
  try {
    if (existingProject) {
      project = await cfRequest(
        cfToken,
        accountId,
        `/pages/projects/${encodeURIComponent(projectName)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            production_branch: branch,
            build_config: {
              build_command: "exit 0",
              destination_dir: ".",
              root_dir: "/",
              build_caching: false
            },
            deployment_configs: {
              preview: deploymentConfig,
              production: deploymentConfig
            },
            source: pagesSourceConfig(repo, branch, false)
          })
        }
      );
    } else {
      project = await cfRequest(cfToken, accountId, "/pages/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          production_branch: branch,
          build_config: {
            build_command: "exit 0",
            destination_dir: ".",
            root_dir: "/",
            build_caching: false
          },
          deployment_configs: {
            preview: deploymentConfig,
            production: deploymentConfig
          },
          source: pagesSourceConfig(repo, branch, false)
        })
      });
    }
  } catch (error) {
    const message = String(error?.message || error);

    // Only show the OAuth/Pages permission instruction for genuine auth errors.
    if (isPagesAuthorizationError(message)) {
      throw new Error(
        `${message} Cloudflare denied the Pages API request. Reconnect Cloudflare and confirm Pages → Edit is granted.`
      );
    }

    if (/linked to a repository that no longer exists/i.test(message)) {
      throw new Error(
        `${message} The installer detected a stale Cloudflare Pages/GitHub link but Cloudflare would not repair it automatically.`
      );
    }

    if (/github|repository|source/i.test(message)) {
      throw new Error(
        `${message} Cloudflare Pages must have GitHub access to the current buyer-owned repository ${repo?.owner?.login}/${repo?.name}.`
      );
    }

    throw error;
  }

  const baseUrl = project?.subdomain
    ? `https://${String(project.subdomain).replace(/^https?:\/\//, "")}`
    : predictedBaseUrl;

  if (baseUrl !== predictedBaseUrl) {
    const correctedConfig = pagesDeploymentConfig({
      baseUrl,
      d1Id,
      bucketName,
      encryptionKey,
      cronSecret
    });
    await cfRequest(cfToken, accountId, `/pages/projects/${encodeURIComponent(projectName)}`, {
      method: "PATCH",
      body: JSON.stringify({
        deployment_configs: {
          preview: correctedConfig,
          production: correctedConfig
        }
      })
    });
  }

  const form = new FormData();
  form.set("branch", branch);
  form.set("commit_message", "Initial Eselram deployment");

  const deployment = await cfFormRequest(
    cfToken,
    accountId,
    `/pages/projects/${encodeURIComponent(projectName)}/deployments`,
    form
  );

  return { project, deployment, baseUrl };
}

async function enableAutomaticPagesDeployments(cfToken, accountId, projectName, repo, branch) {
  await cfRequest(cfToken, accountId, `/pages/projects/${encodeURIComponent(projectName)}`, {
    method: "PATCH",
    body: JSON.stringify({ source: pagesSourceConfig(repo, branch, true) })
  });
}

async function refreshDeploymentState(install, cfToken) {
  const resources = install?.resources || {};
  const steps = { ...(install?.steps || {}) };
  const accountId = resources.cloudflare_account_id;
  const projectName = resources.pages_project_name;
  const deploymentId = resources.pages_deployment_id;
  const baseUrl = resources.pages_base_url;

  if (!accountId || !projectName || !deploymentId || !baseUrl) return install;

  const deployment = await cfRequest(
    cfToken,
    accountId,
    `/pages/projects/${encodeURIComponent(projectName)}/deployments/${encodeURIComponent(deploymentId)}`
  );
  const stage = deployment?.latest_stage || {};
  const status = stage.status || "active";

  if (status === "failure" || status === "canceled") {
    steps.application = {
      status: "error",
      message: `Cloudflare Pages deployment ${status}. Open the ${projectName} Pages project to review its build logs.`
    };
    return {
      ...install,
      status: "error",
      message: steps.application.message,
      steps
    };
  }

  if (status !== "success" || stage.name !== "deploy") {
    steps.application = {
      status: "running",
      message: `Cloudflare Pages is ${stage.name || "deploying"} (${status}).`
    };
    return { ...install, steps };
  }

  steps.application = { status: "complete", message: "Your Eselram application is deployed on Cloudflare Pages." };
  steps.security = { status: "complete", message: "Installation-specific secrets and DB/R2 bindings are configured in your Cloudflare account." };
  steps.verify = { status: "running", message: "Checking that your Eselram application can reach its database." };

  try {
    const response = await fetch(`${baseUrl}/api/status`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      return {
        ...install,
        steps,
        message: "Deployment is live. Waiting for the application health check to become ready."
      };
    }
  } catch {
    return {
      ...install,
      steps,
      message: "Deployment is live. Waiting for the Pages URL to become reachable."
    };
  }

  steps.verify = { status: "complete", message: "Your Eselram application responded successfully and can access its database." };

  if (!resources.auto_deploy_enabled) {
    try {
      await enableAutomaticPagesDeployments(
        cfToken,
        accountId,
        projectName,
        {
          owner: { login: resources.github_owner, id: resources.github_owner_id },
          name: resources.github_repo,
          id: resources.github_repo_id
        },
        resources.github_branch || "main"
      );
      resources.auto_deploy_enabled = true;
    } catch (error) {
      console.warn("Unable to enable automatic Pages deployments", error);
    }
  }

  return {
    ...install,
    status: "complete",
    message: "Your Eselram installation is ready.",
    installation_url: `${baseUrl}/installer/`,
    resources,
    steps
  };
}

function slugify(value) {
  return String(value || "eselram").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "eselram";
}

async function provision(request, env) {
  const body = await request.json().catch(() => ({}));
  const paymentMode = body.payment_mode === "stripe" ? "stripe" : "manual";
  const cf = await providerCredential(request, env, "cloudflare");
  const gh = await providerCredential(request, env, "github");
  let resend = await providerCredential(request, env, "resend");
  let refreshedResendCredential = null;
  const stripe = await providerCredential(request, env, "stripe");

  if (!cf?.access_token || !gh?.access_token || !resend?.access_token || (paymentMode === "stripe" && !stripe)) {
    return json({ ok: false, error: "Connect all required accounts before installing Eselram." }, 409);
  }

  const previous = await installState(request, env);
  if (["deploying", "complete"].includes(previous?.status)) {
    return json({ ok: true, ...previous }, 200);
  }

  const resumable = ["blocked", "error", "connecting"].includes(previous?.status) &&
    previous?.resources?.github_owner &&
    previous?.resources?.github_repo &&
    previous?.resources?.cloudflare_account_id &&
    previous?.resources?.d1_database_id &&
    previous?.resources?.r2_bucket_name;

  let accountId = resumable ? previous.resources.cloudflare_account_id : await selectedAccount(request, env);
  const accounts = await cloudflareAccounts(cf.access_token);
  if (!accountId && accounts.length === 1) accountId = accounts[0].id;
  if (!accountId) {
    return json({ ok: false, error: "Choose the Cloudflare account where Eselram should be installed." }, 409);
  }

  const steps = resumable ? JSON.parse(JSON.stringify(previous.steps || {})) : {};
  const resources = resumable ? { ...(previous.resources || {}) } : {};
  const setStep = (key, status, message) => { steps[key] = { status, message }; };

  try {
    let repo;
    let slug;
    let branch;
    let d1Id;
    let d1Name;
    let bucket;

    if (resumable) {
      // IMPORTANT: a previous base provisioning run already created the buyer-owned
      // GitHub repository, D1 database, R2 bucket and migrations. Continue from those
      // exact resources instead of generating duplicates.
      repo = await githubRequest(
        gh.access_token,
        `/repos/${encodeURIComponent(resources.github_owner)}/${encodeURIComponent(resources.github_repo)}`
      );
      slug = repo.name;
      branch = resources.github_branch || repo.default_branch || "main";
      d1Id = resources.d1_database_id;
      d1Name = resources.d1_database_name || `${slug}-db`;
      bucket = resources.r2_bucket_name;

      setStep("repository", "complete", "Using the GitHub copy already created for this installation.");
      setStep("database", "complete", "Using the D1 database already created for this installation.");
      setStep("storage", "complete", "Using the secure file storage already created for this installation.");
      setStep("migrations", "complete", steps.migrations?.message || "Database migrations were already applied.");
    } else {
      const ghUser = await githubRequest(gh.access_token, "/user");
      slug = slugify(body.slug || `eselram-${randomUrlSafe(4).toLowerCase()}`);

      setStep("repository", "running", "Checking the Eselram template and creating your private GitHub copy.");
      const templatePath = `/repos/${encodeURIComponent(env.ESELRAM_TEMPLATE_OWNER)}/${encodeURIComponent(env.ESELRAM_TEMPLATE_REPO)}`;
      const template = await githubRequest(gh.access_token, templatePath);
      if (!template?.is_template) {
        throw new Error(`GitHub template ${env.ESELRAM_TEMPLATE_OWNER}/${env.ESELRAM_TEMPLATE_REPO} is reachable but is not marked as a template repository.`);
      }

      repo = await githubRequest(gh.access_token, `${templatePath}/generate`, {
        method: "POST",
        body: JSON.stringify({
          owner: ghUser.login,
          name: slug,
          description: "Independent Eselram installation",
          private: true,
          include_all_branches: false
        })
      });
      branch = repo.default_branch || "main";
      resources.github_owner = repo.owner.login;
      resources.github_owner_id = repo.owner.id;
      resources.github_repo = repo.name;
      resources.github_repo_id = repo.id;
      resources.github_branch = branch;
      resources.cloudflare_account_id = accountId;
      setStep("repository", "complete", "Your own GitHub copy is ready.");

      setStep("database", "running", "Creating your private D1 database.");
      d1Name = `${slug}-db`;
      const d1 = await cfRequest(cf.access_token, accountId, "/d1/database", {
        method: "POST",
        body: JSON.stringify({ name: d1Name })
      });
      d1Id = d1.uuid || d1.id;
      resources.d1_database_id = d1Id;
      resources.d1_database_name = d1Name;
      setStep("database", "complete", "Database created in your Cloudflare account.");

      setStep("storage", "running", "Creating secure file storage.");
      bucket = `${slug}-form-uploads`.slice(0, 63);
      await cfRequest(cf.access_token, accountId, "/r2/buckets", {
        method: "POST",
        body: JSON.stringify({ name: bucket })
      });
      resources.r2_bucket_name = bucket;
      setStep("storage", "complete", "Secure file storage is ready in your Cloudflare account.");

      setStep("migrations", "running", "Applying the Eselram database schema in one batched operation.");
      const migrations = await readTemplateMigrationsFromArchive(
        gh.access_token,
        env.ESELRAM_TEMPLATE_OWNER,
        env.ESELRAM_TEMPLATE_REPO,
        branch
      );
      await applyD1MigrationBatch(cf.access_token, accountId, d1Id, migrations);
      setStep("migrations", "complete", `${migrations.length} database migrations applied.`);
    }

    setStep("security", "pending", "Installation-only encryption and scheduler secrets are ready to be injected during application setup.");
    const encryptionKey = randomUrlSafe(48);
    const cronSecret = randomUrlSafe(48);

    setStep("email", "running", "Refreshing the temporary Resend authorization and creating a buyer-owned sending key.");
    resend = await refreshResendCredential(env, resend);
    refreshedResendCredential = resend;
    const resendSendingKey = await createResendApiKey(
      resend,
      slug,
      "sending_access",
      "Sending"
    );

    const resendSetupKey = await createResendApiKey(
      resend,
      slug,
      "full_access",
      "Domain setup"
    );

    setStep(
      "payments",
      "running",
      paymentMode === "stripe"
        ? "Saving the connected Stripe account securely in the new database."
        : "Configuring Pay in person while preserving any connected Stripe account."
    );

    await seedConnectedIntegrations({
      cfToken: cf.access_token,
      accountId,
      databaseId: d1Id,
      installationSecret: encryptionKey,
      resendSendingKey,
      resendSetupKey,
      stripeCredential: stripe,
      paymentMode
    });

    resources.resend_api_key_id = resendSendingKey.id;
    resources.resend_setup_api_key_id = resendSetupKey.id;

    setStep(
      "email",
      "complete",
      "Buyer-owned Resend sending and guided-domain credentials were created and encrypted in D1."
    );

    setStep(
      "payments",
      "complete",
      stripe?.access_token
        ? (paymentMode === "stripe"
            ? "Stripe is connected and is the default payment method."
            : "Pay in person is the default; the connected Stripe account is also available.")
        : "Pay in person is configured as the default payment method."
    );

    setStep("security", "running", "Injecting installation-only secrets directly into your Cloudflare Pages project.");
    setStep("application", "running", "Creating your Cloudflare Pages application, bindings and first deployment.");
    const pages = await createAndDeployPagesProject({
      cfToken: cf.access_token,
      accountId,
      repo,
      branch,
      projectName: slug,
      d1Id,
      bucketName: bucket,
      encryptionKey,
      cronSecret
    });
    setStep("security", "complete", "Installation-specific secrets were written directly to your Cloudflare Pages project and were not stored by Eselram.");
    setStep("verify", "pending", "Verification will begin automatically as soon as Cloudflare finishes the deployment.");

    Object.assign(resources, {
      github_owner: repo.owner.login,
      github_owner_id: repo.owner.id,
      github_repo: repo.name,
      github_repo_id: repo.id,
      github_branch: branch,
      cloudflare_account_id: accountId,
      d1_database_id: d1Id,
      d1_database_name: d1Name,
      r2_bucket_name: bucket,
      pages_project_name: slug,
      pages_deployment_id: pages.deployment?.id,
      pages_base_url: pages.baseUrl,
      auto_deploy_enabled: false
    });

    const state = {
      status: "deploying",
      message: "Cloudflare is deploying your Eselram application. This page will update automatically.",
      resources,
      steps
    };

    const responseHeaders = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    responseHeaders.append("Set-Cookie", cookieHeader(COOKIE.install, await seal(env, state)));
    if (refreshedResendCredential) {
      responseHeaders.append("Set-Cookie", cookieHeader(COOKIE.resend, await seal(env, refreshedResendCredential)));
    }
    return new Response(JSON.stringify({ ok: true, ...state }), {
      status: 200,
      headers: responseHeaders
    });
  } catch (error) {
    const failedStep = Object.keys(steps).reverse().find((key) => steps[key]?.status === "running") || "verify";
    setStep(failedStep, "error", error.message || "Provisioning failed.");
    const hasReusableBase = !!(
      resources?.github_owner &&
      resources?.github_repo &&
      resources?.cloudflare_account_id &&
      resources?.d1_database_id &&
      resources?.r2_bucket_name
    );
    const state = {
      status: hasReusableBase ? "blocked" : "error",
      message: error.message || "Provisioning failed.",
      resources,
      steps
    };
    const responseHeaders = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    responseHeaders.append("Set-Cookie", cookieHeader(COOKIE.install, await seal(env, state)));
    if (refreshedResendCredential) {
      responseHeaders.append("Set-Cookie", cookieHeader(COOKIE.resend, await seal(env, refreshedResendCredential)));
    }
    return new Response(JSON.stringify({ ok: false, error: state.message, resources, steps }), {
      status: 500,
      headers: responseHeaders
    });
  }
}

function resetResponse() {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  for (const name of [...Object.values(COOKIE), ...["cloudflare", "github", "resend", "stripe"].map((p) => `${OAUTH_COOKIE_PREFIX}${p}`)]) headers.append("Set-Cookie", clearCookie(name));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
