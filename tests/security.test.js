import test from 'node:test';
import assert from 'node:assert/strict';
import { CryptoEngine } from '../src/utils/crypto.js';
import { createVaultStorage, DATABASE_KEY, validateVault } from '../src/utils/storage.js';
import { VaultSession } from '../src/utils/vaultSession.js';
import { createPinSession } from '../src/utils/pinSession.js';
import { verifyBackup } from '../src/utils/backup.js';
import { migrateAuthenticator } from '../src/utils/authenticatorMigration.js';

class MemoryStorage {
  data = new Map();
  fail = false;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.fail) throw new Error('Quota exceeded'); this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
}
function fixture() {
  const disk = new MemoryStorage();
  let queue = Promise.resolve();
  const locks = { request(name, callback) { const result = queue.then(callback); queue = result.catch(() => {}); return result; } };
  return { disk, repo: createVaultStorage(disk, locks), other: createVaultStorage(disk, locks) };
}
const empty = () => ({ items: [], trash: [] });
const item = id => ({ id, name: id, password: 'secret' });
async function ready() {
  const f = fixture();
  await f.repo.initialize();
  const key = await CryptoEngine.deriveMasterKey('test password', 'test salt', 1000);
  const vault = await CryptoEngine.encryptPayload(key, JSON.stringify(empty()));
  const record = await f.repo.commit('Default', 0, () => ({ salt: 'salt', vault }));
  const session = new VaultSession(f.repo);
  session.start('Default', key, empty(), record.revision);
  return { ...f, key, vault, record, session };
}

test('AES-GCM round trips, uses unique IVs, rejects wrong keys and tampering', async () => {
  const key = await CryptoEngine.deriveMasterKey('password', 'salt', 1000);
  const wrong = await CryptoEngine.deriveMasterKey('different', 'salt', 1000);
  const a = await CryptoEngine.encryptPayload(key, 'private');
  const b = await CryptoEngine.encryptPayload(key, 'private');
  assert.notDeepEqual(a.iv, b.iv);
  assert.equal(await CryptoEngine.decryptPayload(key, a), 'private');
  await assert.rejects(CryptoEngine.decryptPayload(wrong, a));
  a.data[0] ^= 1;
  await assert.rejects(CryptoEngine.decryptPayload(key, a));
});

test('legacy migration is atomic, removes persistent PIN/recovery and preserves ciphertext', async () => {
  const { repo, disk } = fixture();
  disk.setItem('ciphervault_salt', 'salt');
  disk.setItem('ciphervault_vault', '{"iv":[1],"data":[2]}');
  disk.setItem('ciphervault_pin_wrapped', 'insecure');
  disk.setItem('ciphervault_recovery', 'nonfunctional');
  disk.fail = true;
  await assert.rejects(repo.initialize());
  assert.equal(disk.getItem('ciphervault_salt'), 'salt');
  assert.equal(disk.getItem(DATABASE_KEY), null);
  disk.fail = false;
  await repo.initialize();
  assert.equal(repo.get('Default').salt, 'salt');
  assert.deepEqual(repo.get('Default').vault, { iv: [1], data: [2] });
  assert.equal(disk.getItem('ciphervault_pin_wrapped'), null);
  assert.equal(disk.getItem('ciphervault_recovery'), null);
  assert.equal(disk.getItem('ciphervault_vault'), null);
});

test('rename migrates the whole record; deletion removes all current and previous data', async () => {
  const { repo, disk } = await ready();
  await repo.commit('Default', 1, () => ({ hint: 'hint' }));
  const before = repo.get('Default');
  await repo.create('Other');
  await repo.rename('Default', 'Renamed');
  assert.equal(repo.get('Default'), null);
  assert.deepEqual(repo.get('Renamed').previous, before.previous);
  assert.equal(repo.get('Renamed').hint, 'hint');
  await assert.rejects(repo.rename('Renamed', 'Other'));
  await assert.rejects(repo.remove('Renamed', -1));
  await repo.remove('Renamed', repo.get('Renamed').revision);
  assert.equal(repo.get('Renamed'), null);
  assert.equal(disk.getItem(DATABASE_KEY).includes('Renamed'), false);
});

test('special profile names cannot mutate object prototypes', async () => {
  const { repo } = fixture();
  await repo.initialize();
  await repo.create('__proto__');
  await repo.commit('__proto__', 0, () => ({ hint: 'safe' }));
  assert.equal(repo.get('__proto__').hint, 'safe');
  assert.equal(repo.get('toString'), null);
});

test('queued saves derive from latest state and persist only encrypted secrets', async () => {
  const { session, key, repo, disk } = await ready();
  await Promise.all(['first', 'second'].map(id => session.mutate(p => ({ ...p, items: [...p.items, item(id)] }))));
  assert.deepEqual(session.payload.items.map(i => i.id), ['first', 'second']);
  const decrypted = JSON.parse(await CryptoEngine.decryptPayload(key, repo.get('Default').vault));
  assert.equal(decrypted.items.length, 2);
  assert.equal(disk.getItem(DATABASE_KEY).includes('secret'), false);
});

test('concurrent stale tabs cannot overwrite newer revisions', async () => {
  const { repo, other } = await ready();
  const results = await Promise.allSettled([
    repo.commit('Default', 1, () => ({ hint: 'one' })),
    other.commit('Default', 1, () => ({ hint: 'two' }))
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(repo.get('Default').revision, 2);
});

test('locking during save aborts persistence and discards decrypted session state', async () => {
  const { session, repo, disk } = await ready();
  const before = disk.getItem(DATABASE_KEY);
  let release;
  const pending = session.mutate(async payload => {
    await new Promise(resolve => { release = resolve; });
    return { ...payload, items: [item('late')] };
  });
  while (!release) await new Promise(resolve => setImmediate(resolve));
  session.lock();
  release();
  await assert.rejects(pending, /Session changed/);
  assert.equal(disk.getItem(DATABASE_KEY), before);
  assert.equal(session.key, null);
  assert.equal(session.payload, null);
  assert.equal(repo.get('Default').revision, 1);
});

test('quota failure preserves last vault and in-memory committed state', async () => {
  const { session, disk } = await ready();
  const before = disk.getItem(DATABASE_KEY);
  disk.fail = true;
  await assert.rejects(session.mutate(p => ({ ...p, items: [item('new')] })), /Quota/);
  assert.equal(disk.getItem(DATABASE_KEY), before);
  assert.deepEqual(session.payload, empty());
  disk.fail = false;
  await session.mutate(p => ({ ...p, items: [item('retry')] }));
  assert.equal(session.payload.items[0].id, 'retry');
});

test('replacement retains previous salt and ciphertext; invalid payload never commits', async () => {
  const { repo, session, vault } = await ready();
  const before = repo.get('Default');
  await assert.rejects(session.mutate(() => ({ items: [{ name: 'missing id' }], trash: [] })));
  assert.deepEqual(repo.get('Default'), before);
  await assert.rejects(repo.commit('Default', before.revision, () => { throw new Error('Invalid backup'); }));
  assert.deepEqual(repo.get('Default'), before);
  await repo.commit('Default', 1, () => ({ salt: 'replacement', vault: { iv: [2], data: [3] } }));
  assert.deepEqual(repo.get('Default').previous.vault, vault);
  assert.equal(repo.get('Default').previous.salt, 'salt');
  assert.throws(() => validateVault({ items: [item('same')], trash: [item('same')] }));
});

test('backup verification rejects wrong passwords, corruption and invalid contents before replacement', async () => {
  const { repo, disk } = await ready();
  const key = await CryptoEngine.deriveMasterKey('backup password', 'backup salt');
  const payload = { items: [item('backup item')], trash: [] };
  const backup = { salt: 'backup salt', vault: await CryptoEngine.encryptPayload(key, JSON.stringify(payload)) };
  const before = disk.getItem(DATABASE_KEY);
  await assert.rejects(verifyBackup(backup, 'wrong password'));
  const damaged = structuredClone(backup);
  damaged.vault.data[0] ^= 1;
  await assert.rejects(verifyBackup(damaged, 'backup password'));
  const invalid = { salt: backup.salt, vault: await CryptoEngine.encryptPayload(key, '{"items":{},"trash":[]}') };
  await assert.rejects(verifyBackup(invalid, 'backup password'), /Invalid vault/);
  assert.equal(disk.getItem(DATABASE_KEY), before);
  const verified = await verifyBackup(backup, 'backup password');
  assert.deepEqual(verified.payload, payload);
  await repo.commit('Default', 1, () => verified.patch);
  assert.deepEqual(repo.get('Default').vault, backup.vault);
  assert.equal(repo.get('Default').previous.salt, 'salt');
});

test('migration discovers orphan profiles and removes orphan PIN wrappers', async () => {
  const { disk, repo } = fixture();
  disk.setItem('ciphervault_salt_Orphan', 'old salt');
  disk.setItem('ciphervault_vault_Orphan', '{"iv":[1],"data":[2]}');
  disk.setItem('ciphervault_pin_wrapped_Deleted', 'old wrapper');
  await repo.initialize();
  assert.equal(repo.get('Orphan').salt, 'old salt');
  assert.equal(disk.getItem('ciphervault_pin_wrapped_Deleted'), null);
});

test('unsupported locking and corrupted database fail without overwriting data', async () => {
  const disk = new MemoryStorage();
  disk.setItem(DATABASE_KEY, '{broken');
  const repo = createVaultStorage(disk, { request: (name, callback) => callback() });
  await assert.rejects(repo.initialize());
  assert.equal(disk.getItem(DATABASE_KEY), '{broken');
  const unsupported = createVaultStorage(disk, null);
  await assert.rejects(unsupported.initialize(), /Web Locks/);
});

test('authenticator migration removes plaintext only after encrypted commit and preserves it on failure', async () => {
  const { disk, session, repo, key } = await ready();
  const raw = JSON.stringify([{ name: 'Authenticator', secret: 'JBSWY3DPEHPK3PXP' }]);
  disk.setItem('ciphervault_standalone_2fa', raw);
  disk.fail = true;
  await assert.rejects(migrateAuthenticator(session, disk, raw), /Quota/);
  assert.equal(disk.getItem('ciphervault_standalone_2fa'), raw);
  assert.deepEqual(session.payload, empty());
  disk.fail = false;
  await migrateAuthenticator(session, disk, raw);
  assert.equal(disk.getItem('ciphervault_standalone_2fa'), null);
  assert.equal(disk.getItem(DATABASE_KEY).includes('JBSWY3DPEHPK3PXP'), false);
  const payload = JSON.parse(await CryptoEngine.decryptPayload(key, repo.get('Default').vault));
  assert.equal(payload.items[0].totpSecret, 'JBSWY3DPEHPK3PXP');
  await assert.rejects(migrateAuthenticator(session, disk, raw), /changed/);
});

test('PIN wrapping is session-only, expires on clear, and disables after five failures', async () => {
  const { key } = await ready();
  const pins = createPinSession();
  await pins.enable('Default', key, '1234');
  assert.equal(createPinSession().has('Default'), false);
  const unlocked = await pins.unlock('Default', '1234');
  const encrypted = await CryptoEngine.encryptPayload(key, 'valid');
  assert.equal(await CryptoEngine.decryptPayload(unlocked, encrypted), 'valid');
  for (let n = 0; n < 5; n++) await assert.rejects(pins.unlock('Default', '9999'));
  assert.equal(pins.has('Default'), false);
  await assert.rejects(pins.unlock('Default', '1234'));
  await pins.enable('Default', key, '1234');
  pins.clear();
  await assert.rejects(pins.unlock('Default', '1234'));
});

test('pending PIN configuration cannot survive a session invalidation', async () => {
  const { key } = await ready();
  const pins = createPinSession();
  const enabling = pins.enable('Default', key, '1234');
  pins.clear();
  await assert.rejects(enabling, /expired/);
  assert.equal(pins.has('Default'), false);
});

test('HIBP distinguishes no match, compromise, HTTP failure, and offline', async t => {
  const hash = await CryptoEngine.sha1Hex('example');
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.pwnedpasswords.com/range/' + hash.slice(0, 5));
    assert.equal(options.cache, 'no-store');
    return { ok: true, text: async () => hash.slice(5) + ':42\r\n' };
  });
  assert.equal(await CryptoEngine.checkPwnedPassword('example'), 42);
  globalThis.fetch = async () => ({ ok: true, text: async () => 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:5\n' });
  assert.equal(await CryptoEngine.checkPwnedPassword('example'), 0);
  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await CryptoEngine.checkPwnedPassword('example'), null);
  globalThis.fetch = async () => ({ ok: true, text: async () => '<html>error</html>' });
  assert.equal(await CryptoEngine.checkPwnedPassword('example'), null);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await CryptoEngine.checkPwnedPassword('example'), null);
});
