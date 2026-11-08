import { TOTP } from './totp.js';

export function normalizeOtp(secret, options = {}) {
  const parsed = secret?.startsWith('otpauth://') ? TOTP.parseOtpAuthUrl(secret) : { secret, ...options };
  const clean = (parsed.secret || '').replace(/[\s=-]/g, '').toUpperCase();
  if (!/^[A-Z2-7]+$/.test(clean) || clean.length < 2) throw new Error('Enter a valid Base32 authenticator secret.');
  if (parsed.type && parsed.type !== 'totp') throw new Error('Counter-based HOTP accounts are not supported.');
  const algorithm = (parsed.algorithm || 'SHA1').toUpperCase().replace('-', '');
  const digits = Number(parsed.digits || 6);
  const period = Number(parsed.period || 30);
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm) || ![6, 7, 8].includes(digits) || !Number.isInteger(period) || period < 1 || period > 300) throw new Error('Unsupported authenticator settings.');
  return TOTP.buildOtpAuthUrl({ issuer: parsed.issuer || options.issuer || '', name: parsed.account || options.username || options.name || '', secret: clean, algorithm, digits, period });
}

export const isAuthenticator = item => item.category === 'Authenticator';
export function normalizeAccounts(payload) {
  const result = structuredClone(payload);
  const occupied = new Set([...result.items, ...result.trash].map(item => item.id));
  for (const list of [result.items, result.trash]) {
    for (const item of [...list]) {
      if (!item.totpSecret) continue;
      // Preserve legacy secrets exactly; stricter validation applies to new imports/edits.
      if (isAuthenticator(item)) continue;
      if (!item.password && !item.website && !item.totpId) { item.category = 'Authenticator'; continue; }
      let id = `otp:${item.id}`;
      while (occupied.has(id)) id += ':';
      occupied.add(id);
      list.push({ id, name: item.name, username: item.username || '', issuer: item.issuer || '', category: 'Authenticator', totpSecret: item.totpSecret, favorite: item.favorite || false });
      item.totpId = id;
      delete item.totpSecret;
    }
  }
  return result;
}

export function resolveAccounts(items) {
  const tokens = new Map(items.filter(isAuthenticator).map(item => [item.id, item]));
  return items.map(item => !isAuthenticator(item) && item.totpId ? { ...item, totpSecret: tokens.get(item.totpId)?.totpSecret || '' } : item);
}

export function saveAccount(payload, item) {
  const next = structuredClone(item);
  if (!isAuthenticator(next)) {
    if (next.totpSecret) {
      const secret = normalizeOtp(next.totpSecret, next);
      let token = payload.items.find(candidate => isAuthenticator(candidate) && candidate.id === next.totpId);
      if (!token) {
        token = { id: crypto.randomUUID(), name: next.name, username: next.username || '', category: 'Authenticator' };
        payload.items.push(token);
      }
      token.totpSecret = secret;
      next.totpId = token.id;
    } else delete next.totpId;
    delete next.totpSecret;
  } else next.totpSecret = normalizeOtp(next.totpSecret, next);
  const index = payload.items.findIndex(candidate => candidate.id === next.id);
  if (index < 0) payload.items.push(next); else payload.items[index] = next;
  return payload;
}

export function removeAccount(payload, id) {
  const item = payload.items.find(candidate => candidate.id === id);
  if (!item) return payload;
  payload.items = payload.items.filter(candidate => candidate.id !== id);
  if (isAuthenticator(item)) for (const login of payload.items) if (login.totpId === id) delete login.totpId;
  payload.trash.push({ ...item, deletedAt: new Date().toISOString() });
  return payload;
}

export function tokenIdentity(item) {
  if (!item.totpSecret) return null;
  const parsed = TOTP.parseOtpAuthUrl(normalizeOtp(item.totpSecret, item));
  return [parsed.secret, parsed.algorithm.replace('-', ''), parsed.digits, parsed.period].join('|');
}
