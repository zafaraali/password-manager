export function parseLegacyAuthenticator(raw) {
  const accounts = JSON.parse(raw);
  if (!Array.isArray(accounts) || accounts.some(account => !account || typeof account.name !== 'string' || typeof account.secret !== 'string')) throw new Error('Invalid legacy authenticator data.');
  return accounts;
}

export async function migrateAuthenticator(session, storage, raw) {
  const accounts = parseLegacyAuthenticator(raw);
  const payload = await session.mutate(payload => {
    if (storage.getItem('ciphervault_standalone_2fa') !== raw) throw new Error('Authenticator data changed. Try again.');
    return { ...payload, items: [...payload.items, ...accounts.map(account => ({ id: crypto.randomUUID(), name: account.name, totpSecret: account.secret, category: 'Logins' }))] };
  });
  // Never remove the only copy until the encrypted transaction commits.
  if (storage.getItem('ciphervault_standalone_2fa') === raw) storage.removeItem('ciphervault_standalone_2fa');
  return payload;
}
