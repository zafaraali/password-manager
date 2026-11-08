export function validateSyncUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Use an HTTPS file URL without embedded credentials or a fragment.');
  return url.href;
}
export function encryptedBackup(record, profile) {
  if (!record?.salt || !record?.vault) throw new Error('No encrypted vault to back up.');
  return { format: 'ciphervault-backup', version: 1, profile, salt: record.salt, vault: record.vault, hint: record.hint || '', exportedAt: new Date().toISOString() };
}
function headers(username, password) {
  const result = { Accept: 'application/json' };
  if (username || password) result.Authorization = 'Basic ' + btoa(String.fromCharCode(...new TextEncoder().encode(username + ':' + password)));
  return result;
}
function strongEtag(value) {
  if (!value || !/^"[^"\r\n]+"$/.test(value)) throw new Error('The sync server must expose a strong ETag for safe conflict detection.');
  return value;
}
const options = () => ({ cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(20000) });
export async function readRemote(url, username = '', password = '', fetcher = fetch) {
  const response = await fetcher(validateSyncUrl(url), { ...options(), headers: headers(username, password) });
  if (response.status === 404) return { exists: false, etag: null, backup: null };
  if (!response.ok) throw new Error(`Sync read failed (${response.status}). Check the server URL, credentials and CORS configuration.`);
  const etag = strongEtag(response.headers.get('ETag'));
  const backup = await response.json();
  if (typeof backup?.salt !== 'string' || !backup.vault || !Array.isArray(backup.vault.iv) || !Array.isArray(backup.vault.data)) throw new Error('Remote file is not an encrypted CipherVault backup.');
  return { exists: true, etag, backup };
}
export async function writeRemote(url, backup, etag, username = '', password = '', fetcher = fetch) {
  // Construct an allowlisted package; device key wrappers and plaintext never leave.
  const body = JSON.stringify(encryptedBackup(backup, backup.profile));
  const conditional = etag ? { 'If-Match': strongEtag(etag) } : { 'If-None-Match': '*' };
  const response = await fetcher(validateSyncUrl(url), { ...options(), method: 'PUT', headers: { ...headers(username, password), ...conditional, 'Content-Type': 'application/json' }, body });
  if ([409, 412].includes(response.status)) throw new Error('Sync conflict: another device changed the remote file. Check the remote version again before choosing what to keep.');
  if (!response.ok) throw new Error(`Sync upload failed (${response.status}).`);
  // A successful PUT can lack ETag. Force a new check before the next upload.
  return response.headers.get('ETag') || null;
}
