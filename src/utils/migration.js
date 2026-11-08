import { TOTP } from './totp.js';
import { isAuthenticator, normalizeAccounts, normalizeOtp, tokenIdentity } from './accounts.js';

export function parseMigration(data) {
  if (data?.encrypted === true || data?.servicesEncrypted) throw new Error('Export a decrypted Bitwarden or 2FAS file before importing. It will be encrypted in this vault.');
  let items;
  if (Array.isArray(data?.services)) {
    if (data.services.some(service => service.otp?.tokenType && service.otp.tokenType !== 'TOTP')) throw new Error('Only time-based TOTP accounts can be imported.');
    items = data.services.map(service => ({ id: crypto.randomUUID(), name: service.name || service.otp?.issuer || 'Authenticator', username: service.otp?.account || service.account || service.email || '', issuer: service.otp?.issuer || '', category: 'Authenticator', totpSecret: normalizeOtp(service.secret || service.otp?.secret, { ...service.otp, name: service.name, username: service.otp?.account }) }));
  } else if (Array.isArray(data?.items) && data.items.some(item => item.type || item.login || item.secureNote || item.card)) {
    items = data.items.map(item => {
      if (![1, 2, 3, 4].includes(item.type)) throw new Error('Unsupported Bitwarden item type.');
      if (item.login?.fido2Credentials?.length) throw new Error('This export contains passkeys that cannot be imported as usable credentials. Remove them from a copy of the export before importing.');
      return {
        id: crypto.randomUUID(), name: item.name || 'Untitled', category: ({ 1: 'Logins', 2: 'Notes', 3: 'Cards', 4: 'Identities' })[item.type],
        username: item.login?.username || '', password: item.login?.password || '', website: item.login?.uris?.[0]?.uri || '',
        uris: item.login?.uris || [], notes: item.notes || '', favorite: Boolean(item.favorite),
        customFields: (item.fields || []).map(field => ({ id: crypto.randomUUID(), name: field.name || '', value: field.value || '', isSecret: field.type === 1 })),
        templateData: item.card || item.identity || {}, ...(item.login?.totp ? { totpSecret: normalizeOtp(item.login.totp) } : {})
      };
    });
  } else {
    const source = Array.isArray(data) ? data : (data?.accounts || data?.items);
    if (!Array.isArray(source)) throw new Error('Unsupported import format.');
    items = source.map(item => {
      const token = item.secret || item.key;
      return token ? { ...item, id: crypto.randomUUID(), name: item.name || item.issuer || 'Authenticator', category: 'Authenticator', totpSecret: normalizeOtp(token, item) } : { ...item, id: crypto.randomUUID() };
    });
  }
  if (!items.length) throw new Error('No accounts found.');
  for (const item of items) if (typeof item.name !== 'string' || !item.name.trim()) throw new Error('Invalid account name.');
  return normalizeAccounts({ items, trash: [] }).items;
}

export function duplicateKey(item) {
  return isAuthenticator(item) ? `otp:${tokenIdentity(item)}` : JSON.stringify([item.category, item.name?.toLowerCase(), item.username || '', item.website || '', item.password || '', item.notes || '', item.templateData || {}, item.customFields?.map(field => [field.name, field.value, field.isSecret]) || []]);
}

export function previewMigration(incoming, existing) {
  const seen = new Set(existing.map(duplicateKey));
  return incoming.map(item => {
    const key = duplicateKey(item);
    const duplicate = seen.has(key);
    seen.add(key);
    return { item, duplicate };
  });
}

export function applyMigration(payload, incoming, options = true) {
  const legacySkipDuplicates = typeof options === 'boolean' ? options : true;
  const selectedIds = typeof options === 'object' && options?.selectedIds
    ? new Set(options.selectedIds)
    : null;
  const idMap = new Map();
  const additions = [];
  const identities = new Map(payload.items.map(item => [duplicateKey(item), item.id]));
  for (const item of incoming) {
    if (selectedIds && !selectedIds.has(item.id)) continue;
    const identity = duplicateKey(item);
    if (legacySkipDuplicates && identities.has(identity)) { idMap.set(item.id, identities.get(identity)); continue; }
    const copy = { ...item, id: crypto.randomUUID() };
    idMap.set(item.id, copy.id);
    identities.set(identity, copy.id);
    additions.push(copy);
  }
  for (const item of additions) if (item.totpId) item.totpId = idMap.get(item.totpId) || item.totpId;
  return { ...payload, items: [...payload.items, ...additions] };
}

export function exportTwoFas(items) {
  return { version: 4, services: items.filter(isAuthenticator).map(item => {
    const parsed = TOTP.parseOtpAuthUrl(normalizeOtp(item.totpSecret, item));
    return { name: item.name, secret: parsed.secret, otp: { tokenType: 'TOTP', issuer: parsed.issuer || item.issuer || '', account: parsed.account || item.username || '', algorithm: parsed.algorithm.replace('-', ''), digits: parsed.digits, period: parsed.period }, updatedAt: Date.now() };
  }) };
}

export function exportBitwarden(items) {
  const tokens = new Map(items.filter(isAuthenticator).map(item => [item.id, item]));
  return { encrypted: false, folders: [], items: items.map(item => {
    const types = { Logins: 1, Authenticator: 1, Notes: 2, Cards: 3, Identities: 4 };
    if (!types[item.category]) throw new Error(`Bitwarden export cannot represent ${item.category} records. Use the native encrypted backup to preserve them.`);
    const token = item.totpId ? tokens.get(item.totpId) : item;
    const type = types[item.category];
    return {
      id: item.id, type, name: item.name, notes: item.notes || '', favorite: Boolean(item.favorite), organizationId: null, folderId: null,
      fields: (item.customFields || []).map(field => ({ name: field.name, value: field.value, type: field.isSecret ? 1 : 0 })),
      login: type === 1 ? { username: item.username || '', password: item.password || '', uris: item.uris?.length ? item.uris : item.website ? [{ uri: item.website, match: null }] : [], totp: token?.totpSecret ? normalizeOtp(token.totpSecret, token) : null } : null,
      secureNote: type === 2 ? { type: 0 } : null, card: type === 3 ? item.templateData || {} : null, identity: type === 4 ? item.templateData || {} : null
    };
  }) };
}
