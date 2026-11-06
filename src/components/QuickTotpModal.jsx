import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, TextField } from '@mui/material';
import { TOTP } from '../utils/totp';

export default function QuickTotpModal({ open, onClose, profiles }) {
  const [selectedProfile, setSelectedProfile] = useState(profiles[0] || 'Default');
  const [totpAccounts, setTotpAccounts] = useState([]);
  const [error, setError] = useState('');
  const [copiedMsg, setCopiedMsg] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      setTotpAccounts([]);
      setError('Enter master password to quickly view 2FA codes for this profile without fully logging in.');
    }
  }, [open, selectedProfile]);

  const [passwordPrompt, setPasswordPrompt] = useState('');

  const handleUnlockQuick = async (e) => {
    e.preventDefault();
    try {
      const pfx = selectedProfile === 'Default' ? '' : `_${selectedProfile}`;
      const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
      const savedCipherStr = localStorage.getItem(`ciphervault_vault${pfx}`);
      
      if (!savedCipherStr || !savedSalt) {
        setError(`No vault found for profile [${selectedProfile}].`);
        return;
      }

      const { CryptoEngine } = await import('../utils/crypto');
      const derivedKey = await CryptoEngine.deriveMasterKey(passwordPrompt, savedSalt);
      const encryptedObj = JSON.parse(savedCipherStr);
      const decryptedJson = await CryptoEngine.decryptPayload(derivedKey, encryptedObj);
      const parsedData = JSON.parse(decryptedJson);
      const items = Array.isArray(parsedData) ? parsedData : (parsedData.items || []);

      const secrets = items.filter(i => i.totpSecret);
      setTotpAccounts(secrets);
      setError('');
      setPasswordPrompt('');
    } catch (err) {
      setError('Incorrect master password.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>⚡ Quick 2FA View (Standalone)</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Generate 2FA codes instantly without navigating the full vault dashboard.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              select
              SelectProps={{ native: true }}
              size="small"
              label="Profile"
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              fullWidth
            >
              {profiles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </TextField>
          </Box>

          {totpAccounts.length === 0 ? (
            <Box component="form" onSubmit={handleUnlockQuick} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">Enter master password for [{selectedProfile}] to load 2FA codes:</Typography>
              {error && <Typography variant="caption" color="error">{error}</Typography>}
              <TextField
                type="password"
                size="small"
                label="Master Password"
                value={passwordPrompt}
                onChange={(e) => setPasswordPrompt(e.target.value)}
              />
              <Button type="submit" variant="contained">Load 2FA Codes</Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {copiedMsg && <Typography variant="caption" color="success.main" sx={{ textAlign: 'center' }}>{copiedMsg}</Typography>}
              {totpAccounts.map(acc => {
                const [code, setCode] = useState('------');
                useEffect(() => {
                  TOTP.generate(acc.totpSecret).then(setCode);
                }, [tick]);

                return (
                  <Paper key={acc.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 1, borderColor: 'divider' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{acc.name}</Typography>
                      <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, color: 'primary.main' }}>
                        {code}
                      </Typography>
                    </Box>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      onClick={() => {
                        TOTP.generate(acc.totpSecret).then(c => {
                          navigator.clipboard.writeText(c);
                          setCopiedMsg(`Copied 2FA code for ${acc.name}!`);
                          setTimeout(() => setCopiedMsg(''), 3000);
                        });
                      }}
                    >
                      Copy Code
                    </Button>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
