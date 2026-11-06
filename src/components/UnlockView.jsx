import React, { useState, useEffect } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert, IconButton, ButtonGroup } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';
import QuickTotpModal from './QuickTotpModal';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import PinIcon from '@mui/icons-material/Dialpad';

export default function UnlockView({ profileName, onUnlockSuccess, onSwitchToSetup, onOpenAuthenticatorOnly, profiles = ['Default'] }) {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  const [openQuickTotp, setOpenQuickTotp] = useState(false);
  const [unlockMode, setUnlockMode] = useState('password'); // 'password' | 'pin'
  const [hasPinConfigured, setHasPinConfigured] = useState(false);

  useEffect(() => {
    const pfx = profileName === 'Default' ? '' : `_${profileName}`;
    const savedHint = localStorage.getItem(`ciphervault_hint${pfx}`);
    if (savedHint) setHint(savedHint);

    const isPin = localStorage.getItem(`ciphervault_pin_enabled${pfx}`) === 'true';
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
    setError('');
    try {
      const pfx = profileName === 'Default' ? '' : `_${profileName}`;
      const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
      const savedCipher = localStorage.getItem(`ciphervault_vault${pfx}`);

      if (!savedSalt || !savedCipher) {
        onSwitchToSetup();
        return;
      }

      const derivedKey = await CryptoEngine.deriveMasterKey(password, savedSalt);
      const decryptedStr = await CryptoEngine.decryptPayload(derivedKey, JSON.parse(savedCipher));
      const parsed = JSON.parse(decryptedStr);

      onUnlockSuccess(derivedKey, parsed.items || [], parsed.trash || []);
    } catch (err) {
      setError('Incorrect master password. Please try again.');
    }
  };

  const handlePinUnlock = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const pfx = profileName === 'Default' ? '' : `_${profileName}`;
      const pinSalt = localStorage.getItem(`ciphervault_pin_salt${pfx}`);
      const wrappedStr = localStorage.getItem(`ciphervault_pin_wrapped${pfx}`);
      const savedCipher = localStorage.getItem(`ciphervault_vault${pfx}`);

      if (!pinSalt || !wrappedStr || !savedCipher) {
        setUnlockMode('password');
        setError('PIN configuration missing. Please use master password.');
        return;
      }

      const wrapped = JSON.parse(wrappedStr);
      const unwrappedKey = await CryptoEngine.unwrapMasterKeyWithPin(wrapped, pin, pinSalt);
      const decryptedStr = await CryptoEngine.decryptPayload(unwrappedKey, JSON.parse(savedCipher));
      const parsed = JSON.parse(decryptedStr);

      onUnlockSuccess(unwrappedKey, parsed.items || [], parsed.trash || []);
    } catch (err) {
      setError('Incorrect PIN. Please try again or use your master password.');
    }
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
              type="submit" 
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
              type="submit" 
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setOpenQuickTotp(true)} 
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2.5 }}
            >
              ⚡ Quick 2FA View
            </Button>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={onOpenAuthenticatorOnly} 
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2.5, borderColor: 'secondary.main', color: 'secondary.main', '&:hover': { borderColor: 'secondary.dark', bgcolor: 'rgba(16, 185, 129, 0.04)' } }}
            >
              📲 Standalone 2FA
            </Button>
          </Box>

          <Button variant="text" size="small" onClick={onSwitchToSetup} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Reset or Create New Vault
          </Button>
        </Box>
      </Paper>

      <QuickTotpModal
        open={openQuickTotp}
        onClose={() => setOpenQuickTotp(false)}
        profiles={profiles}
      />
    </Box>
  );
}
