import React, { useState, useEffect } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function UnlockView({ profileName, onUnlockSuccess, onSwitchToSetup, onOpenAuthenticatorOnly }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    const pfx = profileName === 'Default' ? '' : `_${profileName}`;
    const savedHint = localStorage.getItem(`ciphervault_hint${pfx}`);
    if (savedHint) setHint(savedHint);
  }, [profileName]);

  const handleUnlock = async (e) => {
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

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: 1, borderColor: 'divider', width: '100%', maxWidth: 460, bgcolor: 'background.paper', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Unlock CipherVault</Typography>
          <Typography variant="body2" color="text.secondary">
            Enter master password for profile [{profileName}]
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Box component="form" onSubmit={handleUnlock} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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

          <Button type="submit" variant="contained" size="large" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 3, color: '#fff', py: 1.5, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)' }}>
            Unlock Vault
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Button variant="outlined" onClick={onOpenAuthenticatorOnly} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 3, borderColor: 'secondary.main', color: 'secondary.main', '&:hover': { borderColor: 'secondary.dark', bgcolor: 'rgba(16, 185, 129, 0.04)' } }}>
            📲 Open Standalone 2FA App (No Password)
          </Button>

          <Button variant="text" size="small" onClick={onSwitchToSetup} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Reset or Create New Vault
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
