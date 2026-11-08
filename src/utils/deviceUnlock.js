import { CryptoEngine } from './crypto.js';

const random = () => crypto.getRandomValues(new Uint8Array(32));
async function wrappingKey(output, salt) {
  if (!output || output.byteLength !== 32) throw new Error('This authenticator does not support PRF encryption. Use your master password.');
  const material = await crypto.subtle.importKey('raw', output, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: new TextEncoder().encode('CipherVault device unlock v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function evaluate(credentials, credentialId, salt) {
  const credential = await credentials.get({ publicKey: { challenge: random(), allowCredentials: [{ id: new Uint8Array(credentialId), type: 'public-key' }], userVerification: 'required', extensions: { prf: { eval: { first: new Uint8Array(salt) } } }, timeout: 60000 } });
  if (!credential || !credential.rawId || Array.from(new Uint8Array(credential.rawId)).join() !== credentialId.join()) throw new Error('Unexpected device credential.');
  const authData = new Uint8Array(credential.response.authenticatorData);
  if (authData.length < 37 || !(authData[32] & 4)) throw new Error('Device user verification is required.');
  return credential.getClientExtensionResults()?.prf?.results?.first;
}
export async function enableDeviceUnlock(key, profile, credentials = navigator.credentials) {
  if (!credentials?.create || !credentials?.get) throw new Error('Device unlock requires a browser with WebAuthn PRF support.');
  const credential = await credentials.create({ publicKey: {
    challenge: random(), rp: { name: 'CipherVault' }, user: { id: random(), name: profile, displayName: profile },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, extensions: { prf: {} }, timeout: 60000, attestation: 'none'
  } });
  if (!credential?.getClientExtensionResults()?.prf?.enabled) throw new Error('This authenticator cannot encrypt the vault key. Device unlock was not enabled.');
  const credentialId = Array.from(new Uint8Array(credential.rawId));
  const prfSalt = Array.from(random());
  const kdfSalt = Array.from(random());
  const output = await evaluate(credentials, credentialId, prfSalt);
  const wrapKey = await wrappingKey(output, kdfSalt);
  const wrapped = await CryptoEngine.encryptPayload(wrapKey, JSON.stringify(await CryptoEngine.exportRawKey(key)));
  return { version: 1, credentialId, prfSalt, kdfSalt, wrapped };
}
export async function unlockWithDevice(record, credentials = navigator.credentials) {
  if (record?.version !== 1) throw new Error('Device unlock is not configured.');
  const output = await evaluate(credentials, record.credentialId, record.prfSalt);
  const key = await wrappingKey(output, record.kdfSalt);
  return CryptoEngine.importRawKey(JSON.parse(await CryptoEngine.decryptPayload(key, record.wrapped)));
}
