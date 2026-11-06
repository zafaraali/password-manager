/**
 * CipherVault Cryptography Engine
 * Bitwarden-equivalent architecture using Browser Web Crypto API
 */

export class CryptoEngine {
  static async deriveMasterKey(password, salt, iterations = 600000) {
    const enc = new TextEncoder();
    const pwKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(salt),
        iterations: iterations,
        hash: "SHA-256"
      },
      pwKey,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  static async generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static async generateRecoveryCode() {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,4)}-${hex.slice(4,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}`.toUpperCase();
  }

  static async encryptPayload(key, plaintext) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext))
    };
  }

  static async decryptPayload(key, encryptedObj) {
    const dec = new TextDecoder();
    const iv = new Uint8Array(encryptedObj.iv);
    const data = new Uint8Array(encryptedObj.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );

    return dec.decode(decrypted);
  }

  static async encryptFile(key, arrayBuffer) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      arrayBuffer
    );
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext))
    };
  }

  static async decryptFile(key, encryptedFileObj) {
    const iv = new Uint8Array(encryptedFileObj.iv);
    const data = new Uint8Array(encryptedFileObj.data);
    return await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
  }

  // --- PIN Wrapping for Quick Session Unlock (Bitwarden Architecture) ---

  static async exportRawKey(cryptoKey) {
    const raw = await crypto.subtle.exportKey("raw", cryptoKey);
    return Array.from(new Uint8Array(raw));
  }

  static async importRawKey(rawKeyArray) {
    const rawBytes = new Uint8Array(rawKeyArray);
    return await crypto.subtle.importKey(
      "raw",
      rawBytes,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  static async wrapMasterKeyWithPin(masterKey, pin, pinSalt) {
    const pinKey = await this.deriveMasterKey(pin, pinSalt, 100000);
    const rawMasterBytes = await crypto.subtle.exportKey("raw", masterKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      pinKey,
      rawMasterBytes
    );
    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext))
    };
  }

  static async unwrapMasterKeyWithPin(wrappedObj, pin, pinSalt) {
    const pinKey = await this.deriveMasterKey(pin, pinSalt, 100000);
    const iv = new Uint8Array(wrappedObj.iv);
    const data = new Uint8Array(wrappedObj.data);
    const decryptedRaw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      pinKey,
      data
    );
    return await crypto.subtle.importKey(
      "raw",
      decryptedRaw,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // --- HaveIBeenPwned k-Anonymity Compromised Password Checker ---

  static async sha1Hex(str) {
    const enc = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-1", enc.encode(str));
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  /**
   * Checks if a password has been compromised in data breaches using zero-knowledge k-Anonymity.
   * Returns breach count (0 if safe).
   */
  static async checkPwnedPassword(password) {
    if (!password) return 0;
    try {
      const hash = await this.sha1Hex(password);
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) return 0;
      const text = await res.text();

      const lines = text.split("\n");
      for (const line of lines) {
        const [hSuffix, count] = line.trim().split(":");
        if (hSuffix === suffix) {
          return parseInt(count, 10) || 0;
        }
      }
      return 0;
    } catch (e) {
      // In case of network interruption, gracefully return 0
      return 0;
    }
  }
}
