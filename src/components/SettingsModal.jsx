import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, 
  FormControlLabel, Switch, Slider, TextField, Divider, Alert 
} from '@mui/material';
import { CryptoEngine } from '../utils/crypto';
import { TOTP } from '../utils/totp';

export default function SettingsModal({ open, onClose, settings, onSaveSettings, currentProfile, onDeleteProfile, activeKey }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [originalAccent, setOriginalAccent] = useState(settings.accentColor);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // PIN Unlock state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setOriginalAccent(settings.accentColor);
      setDeletePassword('');
      setDeleteError('');
      setNewPin('');
      setConfirmPin('');
      setPinMsg('');
      setPinError('');

      const pfx = currentProfile === 'Default' ? '' : `_${currentProfile}`;
      const isPin = localStorage.getItem(`ciphervault_pin_enabled${pfx}`) === 'true';
      setPinEnabled(isPin);
    }
  }, [settings, open, currentProfile]);

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

  const handleEnablePin = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinMsg('');

    if (!newPin || newPin.length < 4 || newPin.length > 8) {
      setPinError('PIN must be between 4 and 8 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match.');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setPinError('PIN must contain only numbers (0-9).');
      return;
    }
    if (!activeKey) {
      setPinError('Vault master key is unavailable. Please unlock vault first.');
      return;
    }

    try {
      const pfx = currentProfile === 'Default' ? '' : `_${currentProfile}`;
      const pinSalt = await CryptoEngine.generateSalt();
      const wrapped = await CryptoEngine.wrapMasterKeyWithPin(activeKey, newPin, pinSalt);

      localStorage.setItem(`ciphervault_pin_enabled${pfx}`, 'true');
      localStorage.setItem(`ciphervault_pin_salt${pfx}`, pinSalt);
      localStorage.setItem(`ciphervault_pin_wrapped${pfx}`, JSON.stringify(wrapped));

      setPinEnabled(true);
      setNewPin('');
      setConfirmPin('');
      setPinMsg('Quick PIN unlock enabled successfully!');
    } catch (err) {
      setPinError('Failed to enable PIN: ' + err.message);
    }
  };

  const handleDisablePin = () => {
    const pfx = currentProfile === 'Default' ? '' : `_${currentProfile}`;
    localStorage.removeItem(`ciphervault_pin_enabled${pfx}`);
    localStorage.removeItem(`ciphervault_pin_salt${pfx}`);
    localStorage.removeItem(`ciphervault_pin_wrapped${pfx}`);
    setPinEnabled(false);
    setPinMsg('PIN unlock disabled.');
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
        onClose();
        onDeleteProfile(currentProfile);
        return;
      }

      const derivedKey = await CryptoEngine.deriveMasterKey(deletePassword, savedSalt);
      await CryptoEngine.decryptPayload(derivedKey, JSON.parse(savedCipher));

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

          {/* Quick PIN Unlock Configuration (Bitwarden & 2FAS Feature) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              ⚡ Quick PIN Unlock (Fast Session Resume)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Unlock your vault during sessions with a 4–8 digit numeric PIN instead of re-entering your master password every time.
            </Typography>

            {pinMsg && <Alert severity="success">{pinMsg}</Alert>}
            {pinError && <Alert severity="error">{pinError}</Alert>}

            {pinEnabled ? (
              <Box sx={{ p: 2, border: 1, borderColor: 'secondary.main', borderRadius: 3, bgcolor: 'rgba(16, 185, 129, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'secondary.main' }}>
                    ✅ PIN Unlock is Active
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    You can unlock [{currentProfile}] using your numeric PIN.
                  </Typography>
                </Box>
                <Button 
                  size="small" 
                  color="error" 
                  variant="outlined" 
                  onClick={handleDisablePin}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  Disable PIN
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleEnablePin} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    label="4–8 Digit PIN"
                    type="password"
                    size="small"
                    fullWidth
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="1234"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <TextField
                    label="Confirm PIN"
                    type="password"
                    size="small"
                    fullWidth
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="1234"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Box>
                <Button 
                  type="submit" 
                  variant="contained" 
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, alignSelf: 'flex-start', color: '#fff' }}
                >
                  Enable PIN Unlock
                </Button>
              </Box>
            )}
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
              label="Master Password"
              type="password"
              size="small"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Enter master password to delete"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
            <Button type="submit" variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, alignSelf: 'flex-start' }}>
              Confirm & Delete Vault Permanently
            </Button>
          </Box>

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Preferences</Button>
      </DialogActions>
    </Dialog>
  );
}
