function toBase64Url(value) {
  let binary = '';
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

export const isWebAuthnSupported = () => typeof window !== 'undefined' && Boolean(window.PublicKeyCredential && navigator.credentials);

export async function registerPasskey({ userName, displayName, rpId = location.hostname }) {
  if (!isWebAuthnSupported()) throw new Error('This browser or context does not support passkeys. Use HTTPS or localhost.');
  if (!rpId || (location.hostname !== 'localhost' && !location.hostname.endsWith(rpId))) throw new Error('The relying-party domain must match the current website.');
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({ publicKey: {
    challenge,
    rp: { name: 'CipherVault', id: rpId },
    user: { id: userId, name: userName || `user@${rpId}`, displayName: displayName || userName || 'CipherVault user' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    timeout: 60000,
    attestation: 'none'
  } });
  if (!credential) throw new Error('Passkey registration was cancelled.');
  return { credentialId: toBase64Url(credential.rawId), rpId, type: credential.type, transports: credential.response.getTransports?.() || [], registeredAt: new Date().toISOString() };
}

export async function assertPasskey(credentialId, rpId = location.hostname) {
  if (!isWebAuthnSupported()) throw new Error('This browser or context does not support passkeys.');
  if (!credentialId) throw new Error('This record does not have a registered credential.');
  const assertion = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId, allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId) }], userVerification: 'preferred', timeout: 60000 } });
  if (!assertion) throw new Error('Passkey assertion was cancelled.');
  return true;
}
