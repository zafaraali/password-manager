export function getVaultHealth(items = []) {
  const passwordCounts = {};
  for (const item of items) {
    if (item.category === 'Logins' && item.password) passwordCounts[item.password] = (passwordCounts[item.password] || 0) + 1;
  }
  const now = Date.now();
  let breached = 0;
  let weak = 0;
  let reused = 0;
  let missing2fa = 0;
  let old = 0;
  for (const item of items) {
    if (item.category === 'Crypto' || item.category === 'SSH' || item.category === 'Notes') continue;
    const password = item.password || '';
    if (password.length < 8) weak += 1;
    if (password && passwordCounts[password] > 1) reused += 1;
    if (item.category === 'Logins' && !item.totpSecret) missing2fa += 1;
    if (item.passwordUpdatedAt && now - new Date(item.passwordUpdatedAt).getTime() > 90 * 86400000) old += 1;
  }
  const penalty = weak * 20 + reused * 15 + missing2fa * 5 + old * 5;
  const score = items.length ? Math.max(0, Math.min(100, Math.round(100 - penalty / items.length))) : null;
  const issues = weak + reused + missing2fa + old;
  return { score, issues, breached, weak, reused, missing2fa, old };
}
