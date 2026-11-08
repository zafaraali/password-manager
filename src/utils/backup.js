import { CryptoEngine } from './crypto.js';
import { validateVault } from './storage.js';

export async function verifyBackup(backup, masterPassword) {
  if (typeof backup?.salt !== 'string' || !backup.salt || !backup?.vault) throw new Error('Invalid backup package.');
  const key = await CryptoEngine.deriveMasterKey(masterPassword, backup.salt);
  const payload = validateVault(JSON.parse(await CryptoEngine.decryptPayload(key, backup.vault)));
  return { key, payload, patch: { salt: backup.salt, vault: backup.vault, hint: typeof backup.hint === 'string' ? backup.hint : '' } };
}
