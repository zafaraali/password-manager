import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccounts, resolveAccounts, saveAccount, removeAccount, normalizeOtp, tokenIdentity } from '../src/utils/accounts.js';
import { parseMigration, previewMigration, applyMigration, exportTwoFas, exportBitwarden } from '../src/utils/migration.js';
import { TOTP } from '../src/utils/totp.js';
import { CryptoEngine } from '../src/utils/crypto.js';
import { enableDeviceUnlock, unlockWithDevice } from '../src/utils/deviceUnlock.js';
import { readRemote, writeRemote, encryptedBackup, validateSyncUrl } from '../src/utils/sync.js';
import { matchesSite, fillPage } from '../src/extension/autofill.js';
import vm from 'node:vm';

const secret = 'JBSWY3DPEHPK3PXP';
const token = { id: 'otp', name: 'Example', username: 'alice@example.com', category: 'Authenticator', totpSecret: normalizeOtp(secret, { issuer: 'Example', username: 'alice@example.com', algorithm: 'SHA256', digits: 8, period: 60 }) };
const login = { id: 'login', name: 'Example login', username: 'alice', password: 'secret', category: 'Logins', website: 'https://example.com', totpId: 'otp' };
const payload = () => ({ items: [structuredClone(login), structuredClone(token)], trash: [] });

test('legacy account migration separates inline login tokens and is idempotent', () => {
  const result = normalizeAccounts({ items: [{ ...login, totpId: undefined, totpSecret: secret }, { id: 'standalone', name: 'Token only', category: 'Logins', totpSecret: secret }], trash: [] });
  assert.equal(result.items[0].totpSecret, undefined);
  assert.equal(result.items[1].category, 'Authenticator');
  assert.equal(resolveAccounts(result.items)[0].totpSecret, secret);
  assert.deepEqual(normalizeAccounts(result), result);
});

test('linked logins share one secret; removing token preserves logins and unlinks them', () => {
  let p = payload();
  p.items.push({ ...login, id: 'second' });
  p = saveAccount(p, { ...token, totpSecret: normalizeOtp('GEZDGNBVGY3TQOJQ') });
  const resolved = resolveAccounts(p.items);
  assert.equal(resolved[0].totpSecret, resolved[2].totpSecret);
  assert.equal(p.items.filter(item => item.totpSecret).length, 1);
  p = removeAccount(p, 'otp');
  assert.equal(p.items.length, 2);
  assert.equal(p.items[0].totpId, undefined);
  assert.equal(p.trash[0].id, 'otp');
});

test('new inline secret creates a linked token; saving existing link never duplicates it', () => {
  let p = { items: [], trash: [] };
  p = saveAccount(p, { ...login, totpId: undefined, totpSecret: secret });
  assert.equal(p.items.length, 2);
  const saved = resolveAccounts(p.items).find(item => item.id === login.id);
  p = saveAccount(p, { ...saved, favorite: true });
  assert.equal(p.items.length, 2);
  assert.equal(p.items.find(item => item.id === login.id).favorite, true);
});

test('2FAS fixture round trip preserves issuer, account, algorithm, digits and period', () => {
  const fixture = { version: 4, services: [{ name: 'Example', secret, otp: { tokenType: 'TOTP', issuer: 'Example', account: 'alice@example.com', algorithm: 'SHA256', digits: 8, period: 60 } }] };
  const imported = parseMigration(fixture);
  const exported = exportTwoFas(imported);
  assert.deepEqual(exported.services[0].otp, fixture.services[0].otp);
  assert.equal(exported.services[0].secret, secret);
  assert.equal(tokenIdentity(parseMigration(exported)[0]), tokenIdentity(imported[0]));
});

test('Bitwarden round trip preserves login URIs, TOTP, notes, custom fields, cards and identities', () => {
  const fixture = { encrypted: false, items: [
    { type: 1, name: 'Example login', notes: 'note', favorite: true, fields: [{ name: 'API', value: 'private', type: 1 }], login: { username: 'alice', password: 'secret', uris: [{ uri: 'https://example.com', match: 0 }, { uri: 'https://login.example.com', match: 1 }], totp: token.totpSecret } },
    { type: 3, name: 'Card', card: { cardholderName: 'Alice', number: '4111111111111111' } },
    { type: 4, name: 'Identity', identity: { firstName: 'Alice', email: 'alice@example.com' } },
    { type: 2, name: 'Note', notes: 'private note', secureNote: { type: 0 } }
  ] };
  const imported = parseMigration(fixture);
  const exported = exportBitwarden(imported);
  const result = exported.items.find(item => item.name === 'Example login');
  assert.deepEqual(result.login.uris, fixture.items[0].login.uris);
  assert.equal(result.login.totp, token.totpSecret);
  assert.deepEqual(result.fields, fixture.items[0].fields);
  assert.deepEqual(exported.items.find(item => item.type === 3).card, fixture.items[1].card);
  assert.deepEqual(exported.items.find(item => item.type === 4).identity, fixture.items[2].identity);
  assert.deepEqual(exported.items.find(item => item.type === 2).secureNote, { type: 0 });
});

test('duplicate import skips tokens and relinks new logins to existing token IDs', () => {
  const incoming = parseMigration(exportBitwarden([login, token]));
  assert.ok(previewMigration(incoming, [token]).some(row => row.duplicate));
  const result = applyMigration({ items: [token], trash: [] }, incoming);
  assert.equal(result.items.filter(item => item.category === 'Authenticator').length, 1);
  assert.equal(result.items.find(item => item.category === 'Logins').totpId, token.id);
  const again = applyMigration(result, incoming);
  assert.equal(again.items.length, result.items.length);
  assert.ok(applyMigration(result, incoming, false).items.length > result.items.length);
});

test('import selection can keep new records while skipping selected duplicates', () => {
  const incoming = parseMigration([
    { name: 'New account', username: 'new@example.com', password: 'new' },
    { name: 'Existing account', username: 'existing@example.com', password: 'old' }
  ]);
  const existing = [incoming[1]];
  const result = applyMigration({ items: existing, trash: [] }, incoming, { selectedIds: [incoming[0].id] });
  assert.equal(result.items.length, 2);
  assert.equal(result.items.some(item => item.name === 'New account'), true);
});

test('imports reject encrypted containers, unsupported HOTP/passkeys and invalid OTP settings', () => {
  assert.throws(() => parseMigration({ encrypted: true, items: [] }), /decrypted/);
  assert.throws(() => parseMigration({ services: [{ secret, otp: { tokenType: 'HOTP' } }] }), /TOTP/);
  assert.throws(() => parseMigration({ items: [{ type: 1, login: { fido2Credentials: [{}] } }] }), /passkeys/);
  assert.throws(() => normalizeOtp('invalid!'), /Base32/);
  assert.throws(() => normalizeOtp(secret, { digits: 4 }), /settings/);
  assert.throws(() => normalizeOtp('otpauth://hotp/Example?secret=' + secret), /HOTP/);
});

test('TOTP matches published RFC 6238 vectors for SHA1, SHA256 and SHA512', async () => {
  for (const [algorithm, key, expected] of [
    ['SHA1', '12345678901234567890', '94287082'],
    ['SHA256', '12345678901234567890123456789012', '46119246'],
    ['SHA512', '1234567890123456789012345678901234567890123456789012345678901234', '90693936']
  ]) {
    const base32 = TOTP.hexToBase32(Buffer.from(key).toString('hex'));
    assert.equal(await TOTP.generate(base32, { timestamp: 59, digits: 8, algorithm }), expected);
  }
});

test('Google migration parser preserves algorithm and digit metadata without dropping secret bits', () => {
  const parsed = TOTP.parseOtpParameters(Uint8Array.from([10, 3, 1, 2, 3, 32, 2, 40, 2, 48, 2]));
  assert.equal(parsed.secret, 'AEBAG'); assert.equal(parsed.algorithm, 'SHA256'); assert.equal(parsed.digits, 8);
});

function credentials({ supported = true, output = new Uint8Array(32).fill(9), verified = true } = {}) {
  const id = Uint8Array.from([1, 2, 3]);
  return {
    create: async () => ({ rawId: id, getClientExtensionResults: () => ({ prf: { enabled: supported } }) }),
    get: async options => {
      assert.equal(options.publicKey.userVerification, 'required');
      const data = new Uint8Array(37); data[32] = verified ? 4 : 0;
      return { rawId: id, response: { authenticatorData: data }, getClientExtensionResults: () => ({ prf: { results: { first: output } } }) };
    }
  };
}
test('PRF device unlock encrypts the actual vault key and requires the same PRF result', async () => {
  const key = await CryptoEngine.deriveMasterKey('password', 'salt', 1000);
  const device = await enableDeviceUnlock(key, 'Default', credentials());
  const encrypted = await CryptoEngine.encryptPayload(key, 'private vault');
  const unlocked = await unlockWithDevice(device, credentials());
  assert.equal(await CryptoEngine.decryptPayload(unlocked, encrypted), 'private vault');
  assert.equal(JSON.stringify(device).includes('password'), false);
  await assert.rejects(unlockWithDevice(device, credentials({ output: new Uint8Array(32).fill(1) })));
  await assert.rejects(unlockWithDevice(device, credentials({ verified: false })), /verification/);
});
test('unsupported PRF cannot enable device unlock', async () => {
  const key = await CryptoEngine.deriveMasterKey('password', 'salt', 1000);
  await assert.rejects(enableDeviceUnlock(key, 'Default', credentials({ supported: false })), /cannot encrypt/);
});

const encrypted = { profile: 'Default', salt: 'salt', vault: { iv: [1], data: [2] }, deviceUnlock: { private: true }, items: [{ password: 'plaintext' }] };
test('sync uploads only encrypted package and uses atomic conditional requests', async () => {
  await writeRemote('https://dav.example/vault.json', encrypted, '"v1"', 'user', 'pass', async (url, options) => {
    assert.equal(options.headers['If-Match'], '"v1"');
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(options.body.includes('plaintext'), false); assert.equal(options.body.includes('deviceUnlock'), false);
    return { ok: true, headers: { get: () => '"v2"' } };
  });
  await writeRemote('https://dav.example/vault.json', encrypted, null, '', '', async (url, options) => {
    assert.equal(options.headers['If-None-Match'], '*'); return { ok: true, headers: { get: () => null } };
  });
  assert.equal(encryptedBackup(encrypted, 'Default').deviceUnlock, undefined);
});
test('sync rejects conflicts, weak ETags and insecure URLs; 404 allows first upload', async () => {
  await assert.rejects(writeRemote('https://dav.example/vault.json', encrypted, '"v1"', '', '', async () => ({ status: 412 })), /conflict/);
  await assert.rejects(readRemote('https://dav.example/vault.json', '', '', async () => ({ ok: true, headers: { get: () => 'W/"weak"' } })), /ETag/);
  assert.equal((await readRemote('https://dav.example/vault.json', '', '', async () => ({ status: 404 }))).exists, false);
  for (const url of ['http://example.com', 'https://user:pass@example.com', 'javascript:alert(1)']) assert.throws(() => validateSyncUrl(url));
});

test('autofill matches exact HTTPS origins and rejects deceptive domains and downgrade', () => {
  assert.equal(matchesSite(login, 'https://example.com/login'), true);
  for (const url of ['https://example.com.attacker.test', 'https://example.com@attacker.test', 'http://example.com', 'https://sub.example.com', 'https://example.com:8443']) assert.equal(matchesSite(login, url), false);
});
test('injected autofill rechecks origin and rejects iframe execution', () => {
  const context = { location: { origin: 'https://attacker.test', protocol: 'https:' }, window: { top: 1, self: 1 } };
  assert.throws(() => vm.runInNewContext(`(${fillPage.toString()})('https://example.com', {}, 'login')`, context), /Page changed/);
  context.location.origin = 'https://example.com'; context.window.self = 2;
  assert.throws(() => vm.runInNewContext(`(${fillPage.toString()})('https://example.com', {}, 'login')`, context), /Page changed/);
});
