export async function deriveKey(masterPassword, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 600000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(secretData, masterPassword, existingSalt = null) {
  const salt = existingSalt || window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const enc = new TextEncoder();
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(JSON.stringify(secretData))
  );

  return {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

export async function decryptData(encryptedPayload, masterPassword) {
  const salt = new Uint8Array(encryptedPayload.salt);
  const iv = new Uint8Array(encryptedPayload.iv);
  const data = new Uint8Array(encryptedPayload.data);
  const key = await deriveKey(masterPassword, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    data
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
}
