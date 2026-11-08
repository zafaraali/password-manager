import { CryptoEngine } from './crypto.js';

export function createPinSession() {
  const sessions = new Map();
  let generation = 0;
  return {
    has: profile => sessions.has(profile),
    clear: profile => { generation++; return profile === undefined ? sessions.clear() : sessions.delete(profile); },
    async enable(profile, key, pin, isActive = () => true) {
      const attempt = generation;
      if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits.');
      const salt = await CryptoEngine.generateSalt();
      const wrapped = await CryptoEngine.wrapMasterKeyWithPin(key, pin, salt);
      if (attempt !== generation || !isActive()) throw new Error('PIN session expired.');
      sessions.set(profile, { salt, wrapped, attempts: 0 });
    },
    async unlock(profile, pin) {
      const session = sessions.get(profile);
      if (!session || session.attempts >= 5) throw new Error('Use your master password to unlock.');
      session.attempts++;
      try {
        const key = await CryptoEngine.unwrapMasterKeyWithPin(session.wrapped, pin, session.salt);
        if (sessions.get(profile) !== session) throw new Error('PIN session expired.');
        session.attempts = 0;
        return key;
      } catch (error) {
        if (session.attempts >= 5) sessions.delete(profile);
        throw error;
      }
    }
  };
}
export const pinSession = createPinSession();
