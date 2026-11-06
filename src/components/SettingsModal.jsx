import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, FormControlLabel, Switch, Slider, TextField, Divider, Alert } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function SettingsModal({ open, onClose, settings, onSaveSettings, currentProfile, onDeleteProfile }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [originalAccent, setOriginalAccent] = useState(settings.accentColor);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setOriginalAccent(settings.accentColor);
      setDeletePassword('');
      setDeleteError('');
    }
  }, [settings, open]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'accentColor') {
        onSaveSettings(updated, false);
      }
      return updated;
    });
  };

  const handleColorSelect = (colorValue) => {
    setLocalSettings(prev => {
      const updated = { ...prev, accentColor: colorValue };
      onSaveSettings(updated, false);
      return updated;
    });
  };

  const handleSave = () => {
    onSaveSettings(localSettings, true);
    onClose();
  };

  const handleClose = () => {
    if (localSettings.accentColor !== originalAccent) {
      onSaveSettings({ ...localSettings, accentColor: originalAccent }, false);
    }
    onClose();
  };

  const handleDeleteVaultSubmit = async (e) => {
    e.preventDefault();
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError('Please enter your master password to confirm deletion.');
      return;
    }

    try {
      const pfx = currentProfile === 'Default' ? '' : `_${currentProfile}`;
      const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
      const savedCipher = localStorage.getItem(`ciphervault_vault${pfx}`);

      if (!savedSalt || !savedCipher) {
        // If no vault data, just delete
        onClose();
        onDeleteProfile(currentProfile);
        return;
      }

      // Verify master password by deriving key and decrypting payload
      const derivedKey = await CryptoEngine.deriveMasterKey(deletePassword, savedSalt);
      await CryptoEngine.decryptPayload(derivedKey, JSON.parse(savedCipher));

      // Password verified successfully! Proceed to delete
      onClose();
      onDeleteProfile(currentProfile);
    } catch (err) {
      setDeleteError('Incorrect master password. Vault deletion aborted.');
    }
  };

  const colorThemes = [
    { label: 'Indigo (Default)', value: '#6366f1' },
    { label: 'Pure Blue', value: '#2563eb' },
    { label: 'Emerald Green', value: '#10b981' },
    { label: 'Sunset Amber', value: '#f59e0b' },
    { label: 'Ruby Red', value: '#ef4444' },
    { label: 'Cyber Purple', value: '#a855f7' },
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>⚙️ Vault Preferences & Settings</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Theme & Accent Color */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              🎨 App Accent Color (Live Preview)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {colorThemes.map(theme => {
                const isSelected = (localSettings.accentColor || '#6366f1') === theme.value;
                return (
                  <Button
                    key={theme.value}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => handleColorSelect(theme.value)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderRadius: 3,
                      borderColor: theme.value,
                      bgcolor: isSelected ? theme.value : 'transparent',
                      color: isSelected ? '#fff' : 'text.primary',
                      '&:hover': {
                        bgcolor: isSelected ? theme.value : `${theme.value}15`,
                        borderColor: theme.value
                      }
                    }}
                  >
                    <Box component="span" sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: theme.value, mr: 1, display: 'inline-block', border: '1px solid #fff' }} />
                    {theme.label}
                  </Button>
                );
              })}
            </Box>
          </Box>

          <Divider />

          {/* 2FA Preferences */}
          <Box>
            <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 700 }}>
              ⏱️ 2FA & Authenticator Preferences
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={!!localSettings.showNextCodeAuto}
                  onChange={(e) => handleChange('showNextCodeAuto', e.target.checked)}
                />
              }
              label="Show Next 2FA Code Automatically (Skip Toggle Button)"
            />
          </Box>

          <Divider />

          {/* Password Generator Preferences */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 700 }}>
              🔐 Password Generator Defaults
            </Typography>
            <Box>
              <Typography variant="body2" gutterBottom>
                Default Password Length: <strong>{localSettings.passwordLength || 16}</strong> chars
              </Typography>
              <Slider
                value={localSettings.passwordLength || 16}
                onChange={(e, val) => handleChange('passwordLength', val)}
                min={8}
                max={64}
                step={1}
                marks={[{ value: 8, label: '8' }, { value: 16, label: '16' }, { value: 32, label: '32' }, { value: 64, label: '64' }]}
                valueLabelDisplay="auto"
              />
            </Box>
          </Box>

          <Divider />

          {/* Security & Clipboard Preferences */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 700 }}>
              🛡️ Security & Clipboard
            </Typography>
            <TextField
              label="Clipboard Auto-Clear Timeout (Seconds)"
              type="number"
              size="small"
              value={localSettings.clipboardTimeout || 30}
              onChange={(e) => handleChange('clipboardTimeout', parseInt(e.target.value) || 30)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            <TextField
              label="Auto-Lock Inactivity Timeout (Minutes)"
              type="number"
              size="small"
              value={localSettings.autoLockMinutes || 10}
              onChange={(e) => handleChange('autoLockMinutes', parseInt(e.target.value) || 10)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
          </Box>

          <Divider />

          {/* Danger Zone: Password-Protected Delete Vault */}
          <Box component="form" onSubmit={handleDeleteVaultSubmit} sx={{ p: 2.5, border: 1, borderColor: 'error.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle2" color="error" sx={{ fontWeight: 700 }}>
              ⚠️ Danger Zone: Password-Protected Vault Deletion
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Permanently delete vault [{currentProfile}] and all stored data. Enter your master password to authorize this action.
            </Typography>

            {deleteError && <Alert severity="error">{deleteError}</Alert>}

            <TextField
              label="Enter Master Password to Confirm"
              type="password"
              size="small"
              required
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button
                type="submit"
                variant="contained"
                color="error"
                size="small"
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Permanently Delete Vault [{currentProfile}]
              </Button>
            </Box>
          </Box>

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={handleClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Preferences</Button>
      </DialogActions>
    </Dialog>
  );
}
