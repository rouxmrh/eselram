const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function getKey(secret) {
  const value = String(secret || "").trim();

  if (!value) {
    throw new Error(
      "ESELRAM_ENCRYPTION_KEY is not configured."
    );
  }

  // Derive a fixed 256-bit AES key from the installation secret.
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value)
  );

  return await crypto.subtle.importKey(
    "raw",
    digest,
    {
      name: "AES-GCM"
    },
    false,
    [
      "encrypt",
      "decrypt"
    ]
  );
}

export async function encryptIntegrationSecret(
  value,
  installationSecret
) {
  const plaintext = String(value || "");

  if (!plaintext) {
    return null;
  }

  const key = await getKey(
    installationSecret
  );

  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const ciphertext =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(plaintext)
    );

  return [
    "v1",
    bytesToBase64(iv),
    bytesToBase64(
      new Uint8Array(ciphertext)
    )
  ].join(":");
}

export async function decryptIntegrationSecret(
  encryptedValue,
  installationSecret
) {
  const text = String(
    encryptedValue || ""
  );

  if (!text) {
    return "";
  }

  const [
    version,
    ivValue,
    ciphertextValue
  ] = text.split(":");

  if (
    version !== "v1" ||
    !ivValue ||
    !ciphertextValue
  ) {
    throw new Error(
      "Unsupported encrypted integration credential."
    );
  }

  const key = await getKey(
    installationSecret
  );

  const plaintext =
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(ivValue)
      },
      key,
      base64ToBytes(ciphertextValue)
    );

  return decoder.decode(plaintext);
}
