import { normalizeAccounts } from './accounts.js';
import { CryptoEngine } from './crypto.js';
import { validateVault } from './storage.js';

// All changes derive from the latest committed payload, including queued changes.
// Lock invalidates in-flight encryption before it can commit or repopulate UI state.
export class VaultSession {
  constructor(storage) { this.storage = storage; this.epoch = 0; this.queue = Promise.resolve(); }
  start(profile, key, payload, revision) {
    this.lock();
    this.profile = profile;
    this.key = key;
    this.payload = normalizeAccounts(validateVault(payload));
    this.revision = revision;
  }
  lock() { this.epoch++; this.key = null; this.payload = null; this.profile = null; }
  mutate(change, metadata = {}) {
    const epoch = this.epoch;
    const active = () => epoch === this.epoch && Boolean(this.key);
    const work = async () => {
      if (!active()) throw new Error('Vault is locked.');
      const profile = this.profile;
      const key = this.key;
      let payload;
      const next = await this.storage.commit(profile, this.revision, async () => {
        payload = normalizeAccounts(validateVault(await change(structuredClone(this.payload))));
        return { ...metadata, vault: await CryptoEngine.encryptPayload(key, JSON.stringify(payload)) };
      }, active);
      if (!active()) throw new Error('Vault was locked.');
      this.revision = next.revision;
      this.payload = payload;
      return payload;
    };
    const result = this.queue.then(work);
    this.queue = result.catch(() => {});
    return result;
  }
}
