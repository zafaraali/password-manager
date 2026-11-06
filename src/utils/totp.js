export function base32ToUint8(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleanedInput = base32.replace(/=+$/, '').toUpperCase();
  let bits = '';
  let hex = '';

  for (let i = 0; i < cleanedInput.length; i++) {
    const val = alphabet.indexOf(cleanedInput[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    const chunk = bits.substr(i, 8);
    hex += parseInt(chunk, 2).toString(16).padStart(2, '0');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function generateTOTP(secret, timeStep = 30, windowSize = 6, timeOffsetSeconds = 0) {
  if (!secret) return '------';
  try {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const keyBytes = base32ToUint8(cleanSecret);
    const epoch = Math.floor(Date.now() / 1000) + timeOffsetSeconds;
    const timeCounter = Math.floor(epoch / timeStep);

    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, timeCounter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, buffer);
    const hmacResult = new Uint8Array(signature);
    
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, windowSize);
    return otp.toString().padStart(windowSize, '0');
  } catch (err) {
    console.error('TOTP generation error:', err);
    return 'ERR';
  }
}
