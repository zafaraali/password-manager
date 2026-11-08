const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';

export function generateSecurePassword(length = 24) {
  const size = Math.max(16, Math.min(64, length));
  const values = new Uint32Array(size);
  crypto.getRandomValues(values);
  return Array.from(values, value => alphabet[value % alphabet.length]).join('');
}
