// One atomic localStorage record contains all profile metadata. Web Locks serialize
// read/modify/write transactions across tabs; revision checks reject stale editors.
export const DATABASE_KEY = 'ciphervault_database_v1';
const fields = ['salt', 'vault', 'hint', 'created'];
const legacyFields = [...fields, 'recovery', 'pin_enabled', 'pin_salt', 'pin_wrapped'];
export const suffix = name => name === 'Default' ? '' : `_${name}`;

export function createVaultStorage(storage, locks) {
  function read() {
    const raw = storage.getItem(DATABASE_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db?.version !== 1 || !db.profiles || Array.isArray(db.profiles) || !Object.keys(db.profiles).length) throw new Error('Invalid vault database. Existing storage was preserved.');
      return db;
    }
    const names = new Set(JSON.parse(storage.getItem('ciphervault_profiles') || '["Default"]'));
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key === 'ciphervault_salt') names.add('Default');
      else if (key?.startsWith('ciphervault_salt_')) names.add(key.slice('ciphervault_salt_'.length));
    }
    if (!names.size) names.add('Default');
    const profiles = {};
    for (const name of names) {
      const record = { revision: 0 };
      for (const field of fields) {
        const value = storage.getItem(`ciphervault_${field}${suffix(name)}`);
        if (value !== null) record[field] = field === 'vault' ? JSON.parse(value) : value;
      }
      Object.defineProperty(profiles, name, { value: record, enumerable: true, writable: true, configurable: true });
    }
    return { version: 1, profiles };
  }
  function cleanup(names) {
    for (const name of names) for (const field of legacyFields) storage.removeItem(`ciphervault_${field}${suffix(name)}`);
    const obsolete = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (/^ciphervault_(pin_(enabled|salt|wrapped)|recovery)(_|$)/.test(key)) obsolete.push(key);
    }
    obsolete.forEach(key => storage.removeItem(key));
    storage.removeItem('ciphervault_profiles');
  }
  async function transaction(change, isActive = () => true) {
    if (!locks?.request) throw new Error('This browser needs Web Locks support for safe vault writes. Use a current browser over HTTPS or localhost.');
    return locks.request(DATABASE_KEY, async () => {
      const db = read();
      const oldNames = Object.keys(db.profiles);
      const result = await change(db);
      if (!isActive()) throw new Error('Session changed. Unlock the vault and try again.');
      storage.setItem(DATABASE_KEY, JSON.stringify(db));
      cleanup([...new Set([...oldNames, ...Object.keys(db.profiles)])]);
      return result;
    });
  }
  return {
    read,
    get: name => { const profiles = read().profiles; return Object.hasOwn(profiles, name) ? profiles[name] : null; },
    names: () => Object.keys(read().profiles),
    initialize: () => transaction(() => {}),
    async create(name) {
      if (!name?.trim()) throw new Error('A profile name is required.');
      return transaction(db => {
        if (Object.hasOwn(db.profiles, name)) throw new Error('Profile already exists.');
        Object.defineProperty(db.profiles, name, { value: { revision: 0 }, enumerable: true, writable: true, configurable: true });
      });
    },
    async commit(name, expectedRevision, update, isActive = () => true) {
      return transaction(async db => {
        const old = db.profiles[name];
        if (!old || old.revision !== expectedRevision) throw new Error('Vault changed in another tab. Lock and unlock again before saving.');
        const patch = await update(old);
        if (!isActive()) throw new Error('Session changed. Unlock the vault and try again.');
        const next = { ...old, ...patch, revision: old.revision + 1 };
        if (patch.salt && patch.salt !== old.salt) delete next.deviceUnlock;
        if (old.vault) next.previous = { salt: old.salt, vault: old.vault, hint: old.hint, revision: old.revision };
        db.profiles[name] = next;
        return next;
      }, isActive);
    },
    async rename(oldName, newName) {
      if (!newName?.trim()) throw new Error('A profile name is required.');
      return transaction(db => {
        if (Object.hasOwn(db.profiles, newName)) throw new Error('Profile already exists.');
        if (!Object.hasOwn(db.profiles, oldName)) throw new Error('Profile no longer exists.');
        Object.defineProperty(db.profiles, newName, { value: { ...db.profiles[oldName], revision: db.profiles[oldName].revision + 1 }, enumerable: true, writable: true, configurable: true });
        delete db.profiles[oldName];
      });
    },
    async remove(name, revision, isActive = () => true) {
      return transaction(db => {
        if (db.profiles[name]?.revision !== revision) throw new Error('Profile changed. Try again.');
        if (Object.keys(db.profiles).length <= 1) throw new Error('You must keep at least one profile.');
        delete db.profiles[name];
      }, isActive);
    }
  };
}

export const vaultStorage = typeof window === 'undefined' ? null : createVaultStorage(window.localStorage, navigator.locks);

export function validateVault(payload) {
  if (!payload || !Array.isArray(payload.items) || !Array.isArray(payload.trash)) throw new Error('Invalid vault contents.');
  const ids = new Set();
  for (const item of [...payload.items, ...payload.trash]) {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || ids.has(item.id)) throw new Error('Invalid or duplicate vault item.');
    for (const field of ['password', 'username', 'totpSecret', 'notes', 'website', 'category']) {
      if (item[field] !== undefined && typeof item[field] !== 'string') throw new Error(`Invalid item ${field}.`);
    }
    ids.add(item.id);
  }
  return payload;
}
