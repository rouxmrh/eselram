const PBKDF2_ITERATIONS = 100000;

const encoder = new TextEncoder();

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(
    new Uint8Array(16)
  );

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const derivedBits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: PBKDF2_ITERATIONS
      },
      keyMaterial,
      256
    );

  const hash = new Uint8Array(derivedBits);

  return [
    "pbkdf2-sha256",
    PBKDF2_ITERATIONS,
    bytesToBase64(salt),
    bytesToBase64(hash)
  ].join("$");
}

export async function hashSessionToken(token) {
  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(token)
    );

  return Array
    .from(new Uint8Array(digest))
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

export function createSessionToken() {
  const bytes =
    crypto.getRandomValues(
      new Uint8Array(32)
    );

  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export function createSessionCookie(
  token,
  maxAgeSeconds = 604800
) {
  return [
    `eselram_session=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ].join("; ");
}
function base64ToBytes(value) {
  const binary =
    atob(value);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}


function constantTimeEqual(
  a,
  b
) {

  if (
    a.length !== b.length
  ) {
    return false;
  }

  let result = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    result |=
      a[i] ^ b[i];
  }

  return result === 0;
}


export async function verifyPassword(
  password,
  storedHash
) {

  try {

    const [
      algorithm,
      iterationsValue,
      saltValue,
      hashValue
    ] = storedHash.split("$");


    if (
      algorithm !==
      "pbkdf2-sha256"
    ) {
      return false;
    }


    const iterations =
      Number(
        iterationsValue
      );


    const salt =
      base64ToBytes(
        saltValue
      );


    const expectedHash =
      base64ToBytes(
        hashValue
      );


    const keyMaterial =
      await crypto.subtle.importKey(
        "raw",
        encoder.encode(
          password
        ),
        "PBKDF2",
        false,
        ["deriveBits"]
      );


    const derivedBits =
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt,
          iterations
        },
        keyMaterial,
        256
      );


    const actualHash =
      new Uint8Array(
        derivedBits
      );


    return constantTimeEqual(
      actualHash,
      expectedHash
    );


  } catch (error) {

    console.error(
      "Password verification failed:",
      error
    );

    return false;
  }
}


export function readSessionToken(
  request
) {

  const cookieHeader =
    request.headers.get(
      "Cookie"
    ) || "";


  const cookies =
    cookieHeader.split(";");


  for (
    const cookie
    of cookies
  ) {

    const [
      name,
      ...valueParts
    ] = cookie
      .trim()
      .split("=");


    if (
      name ===
      "eselram_session"
    ) {

      return valueParts
        .join("=")
        .trim();
    }
  }


  return null;
}


export function clearSessionCookie() {

  return [
    "eselram_session=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}
