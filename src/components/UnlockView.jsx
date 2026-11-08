import { unlockWithDevice } from '../utils/deviceUnlock';
import { vaultStorage, validateVault } from '../utils/storage';
import { pinSession } from '../utils/pinSession';
import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function UnlockView({ profileName, onUnlockSuccess, onSwitchToSetup }) {
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { generation.current++; }, [profileName]);
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [authenticator, setAuthenticator] = useState(false);
  const [unlockMode, setUnlockMode] = useState('password'); // 'password' | 'pin'
  const [hasPinConfigured, setHasPinConfigured] = useState(false);

  useEffect(() => {
    const savedHint = vaultStorage.get(profileName)?.hint;
    setHint(savedHint || '');

    const isPin = pinSession.has(profileName);
    setHasPinConfigured(isPin);
    if (isPin) {
      setUnlockMode('pin');
    } else {
      setUnlockMode('password');
    }
    setPassword('');
    setPin('');
    setError('');
  }, [profileName]);

  const handleMasterPasswordUnlock = async (e) => {
    e.preventDefault();
    if (busy) return;
    const attempt = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const record = vaultStorage.get(profileName);
        const savedSalt = record?.salt;
      const savedCipher = JSON.stringify(record?.vault);

      if (!savedSalt || !savedCipher) {
        onSwitchToSetup();
        return;
      }

      const derivedKey = await CryptoEngine.deriveMasterKey(password, savedSalt);
      const decryptedStr = await CryptoEngine.decryptPayload(derivedKey, JSON.parse(savedCipher));
      const parsed = validateVault(JSON.parse(decryptedStr));

      if (attempt === generation.current) onUnlockSuccess(derivedKey, parsed.items, parsed.trash, record.revision, authenticator);
    } catch (err) {
      if (attempt !== generation.current) return;
      setError('Incorrect master password. Please try again.');
    } finally { if (attempt === generation.current) setBusy(false); }
  };

  const handlePinUnlock = async (e) => {
    e.preventDefault();
    if (busy) return;
    const attempt = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const record = vaultStorage.get(profileName);
        const savedCipher = JSON.stringify(record?.vault);
      const unwrappedKey = await pinSession.unlock(profileName, pin);
      const decryptedStr = await CryptoEngine.decryptPayload(unwrappedKey, JSON.parse(savedCipher));
      const parsed = validateVault(JSON.parse(decryptedStr));

      if (attempt === generation.current) onUnlockSuccess(unwrappedKey, parsed.items, parsed.trash, record.revision, authenticator);
    } catch (err) {
      if (attempt !== generation.current) return;
      if (!pinSession.has(profileName)) { setHasPinConfigured(false); setUnlockMode('password'); }
      setError('Incorrect PIN or expired session. Use your master password after five failed attempts.');
    } finally { if (attempt === generation.current) setBusy(false); }
  };

  const handleDeviceUnlock = async () => {
    if (busy) return;
    const attempt = ++generation.current; setBusy(true); setError('');
    try {
      const record = vaultStorage.get(profileName);
      const key = await unlockWithDevice(record.deviceUnlock);
      const payload = validateVault(JSON.parse(await CryptoEngine.decryptPayload(key, record.vault)));
      if (attempt === generation.current) onUnlockSuccess(key, payload.items, payload.trash, record.revision, authenticator);
    } catch (error) { if (attempt === generation.current) setError('Device unlock failed: ' + error.message); }
    finally { if (attempt === generation.current) setBusy(false); }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          borderRadius: 4, 
          border: 1, 
          borderColor: 'divider', 
          width: '100%', 
          maxWidth: 460, 
          bgcolor: 'background.paper', 
          boxShadow: '0 10px 30px rgba(0,0,0,0.08)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 3 
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
            {unlockMode === 'pin' ? '⚡ Quick PIN Unlock' : '🔐 Unlock CipherVault'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {unlockMode === 'pin' 
              ? `Enter PIN for profile [${profileName}]` 
              : `Enter master password for profile [${profileName}]`}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {vaultStorage.get(profileName)?.deviceUnlock && <Button variant="outlined" disabled={busy} onClick={handleDeviceUnlock}>Unlock with device</Button>}

        {/* PIN Unlock Form */}
        {unlockMode === 'pin' ? (
          <Box component="form" onSubmit={handlePinUnlock} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Enter PIN (4–8 digits)"
              type="password"
              required
              fullWidth
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="••••"
              inputProps={{ 
                style: { textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px', fontFamily: 'monospace' } 
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />

            <Button 
              type="submit" disabled={busy} 
              variant="contained" 
              size="large" 
              sx={{ 
                textTransform: 'none', 
                fontWeight: 700, 
                borderRadius: 3, 
                color: '#fff', 
                py: 1.5, 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' 
              }}
            >
              Unlock with PIN
            </Button>

            <Button 
              variant="text" 
              size="small"
              onClick={() => {
                setUnlockMode('password');
                setError('');
              }}
              sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
            >
              🔑 Use Master Password Instead
            </Button>
          </Box>
        ) : (
          /* Master Password Unlock Form */
          <Box component="form" onSubmit={handleMasterPasswordUnlock} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Master Password"
              type="password"
              required
              fullWidth
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />

            {hint && (
              <Typography variant="caption" color="text.secondary">
                💡 Hint: {hint}
              </Typography>
            )}

            <Button 
              type="submit" disabled={busy} 
              variant="contained" 
              size="large" 
              sx={{ 
                textTransform: 'none', 
                fontWeight: 700, 
                borderRadius: 3, 
                color: '#fff', 
                py: 1.5, 
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)' 
              }}
            >
              Unlock Vault
            </Button>

            {hasPinConfigured && (
              <Button 
                variant="text" 
                size="small"
                onClick={() => {
                  setUnlockMode('pin');
                  setError('');
                }}
                sx={{ textTransform: 'none', fontWeight: 600, color: 'secondary.main' }}
              >
                ⚡ Use Quick PIN Unlock Instead
              </Button>
            )}
          </Box>
        )}

        <Box sx={{ textAlign: 'center', pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button variant="outlined" onClick={() => { setAuthenticator(value => !value); setError(''); }}>
            {authenticator ? 'Open full vault after unlock' : 'Open 2FA authenticator after unlock'}
          </Button>
          {authenticator && <Typography variant="caption">Unlock above to access your encrypted 2FA accounts.</Typography>}

          <Button variant="text" size="small" onClick={onSwitchToSetup} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Create or Replace Vault
          </Button>
        </Box>
      </Paper>

    </Box>
  );
}
