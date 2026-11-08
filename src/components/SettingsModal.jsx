import DeviceUnlockSettings from './DeviceUnlockSettings';
import { pinSession } from '../utils/pinSession';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, 
  FormControlLabel, Switch, Slider, TextField, Divider, Alert, Tabs, Tab
} from '@mui/material';
import { TOTP } from '../utils/totp';

export default function SettingsModal({ open, onClose, settings, onSaveSettings, currentProfile, onDeleteProfile, activeKey, deviceEnabled, onEnableDevice, onDisableDevice }) {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [localSettings, setLocalSettings] = useState(settings);
  const [originalAccent, setOriginalAccent] = useState(settings.accentColor);
  const [deleteError, setDeleteError] = useState('');

  // PIN Unlock state
  const [pinEnabled, setPinEnabled] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinError, setPinError] = useState('');
  const [clockSync, setClockSync] = useState({ status: '', loading: false });
  const [settingsTab, setSettingsTab] = useState('appearance');

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setOriginalAccent(settings.accentColor);
      setDeleteError('');
      setNewPin('');
      setConfirmPin('');
      setPinMsg('');
      setPinError('');
      setClockSync({ status: '', loading: false });
      setSettingsTab('appearance');
      const isPin = pinSession.has(currentProfile);
      setPinEnabled(isPin);
    }
  }, [settings, open, currentProfile]);

  useEffect(() => {
    if (!open) return undefined;
    const sections = ['appearance', 'authenticator', 'generator', 'security', 'danger']
      .map(id => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setSettingsTab(visible.target.id);
    }, { root: document.querySelector('[role="dialog"]'), threshold: [0.2, 0.6] });
    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [open]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => {
      const updated = { ...prev, [key]: value };
      if (key === 'accentColor') {
        onSaveSettings(updated, false);
      }
      return updated;
    });
  };

  const handleClockSync = async () => {
    setClockSync({ status: 'Checking UTC time…', loading: true });
    const offset = await TOTP.syncClockDrift();
    setClockSync({ status: offset === null ? 'Unable to reach UTC time service. Try again when online.' : `System clock is ${Math.abs(offset) <= 1 ? 'accurate' : 'adjusted'} (offset: ${offset}s)`, loading: false });
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
      await pinSession.enable(currentProfile, activeKey, newPin, () => active.current);
      if (!active.current) return;

      setPinEnabled(true);
      setNewPin('');
      setConfirmPin('');
      setPinMsg('Quick PIN unlock enabled successfully!');
    } catch (err) {
      setPinError('Failed to enable PIN: ' + err.message);
    }
  };

  const handleDisablePin = () => {
    pinSession.clear(currentProfile);
    setPinEnabled(false);
    setPinMsg('PIN unlock disabled.');
  };

  const handleDeleteVaultSubmit = async (e) => {
    e.preventDefault();
    setDeleteError('');

    onClose();
    await onDeleteProfile(currentProfile);
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: { xs: 0, sm: 4 }, p: 1, m: { xs: 0, sm: 2 }, maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' } } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>⚙️ Vault Preferences & Settings</DialogTitle>
      <DialogContent dividers>
        <Tabs value={settingsTab} onChange={(e, value) => { setSettingsTab(value); document.getElementById(value)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} variant="scrollable" scrollButtons="auto" sx={{ position: 'sticky', top: -24, zIndex: 2, bgcolor: 'background.paper', mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 44 } }}>
          <Tab label="Appearance" value="appearance" />
          <Tab label="Authenticator" value="authenticator" />
          <Tab label="Generator" value="generator" />
          <Tab label="Security" value="security" />
          <Tab label="Danger zone" value="danger" />
        </Tabs>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Theme & Accent Color */}
          <Box id="appearance" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, scrollMarginTop: 60 }}>
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

          <Box id="authenticator" sx={{ scrollMarginTop: 60 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 700 }}>🕐 2FA Clock Sync</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Compare your device with UTC and compensate TOTP generation for drift.</Typography>
            <Button variant="outlined" onClick={handleClockSync} disabled={clockSync.loading} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>{clockSync.loading ? 'Checking…' : 'Sync Clock with Atomic UTC'}</Button>
            {clockSync.status && <Alert severity={clockSync.status.includes('accurate') ? 'success' : 'info'} sx={{ mt: 1.5 }}>{clockSync.status}</Alert>}
          </Box>

          <Divider />

          <DeviceUnlockSettings enabled={deviceEnabled} activeKey={activeKey} onEnable={onEnableDevice} onDisable={onDisableDevice} />

          {/* Quick PIN Unlock Configuration (Bitwarden & 2FAS Feature) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, scrollMarginTop: 60 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              ⚡ Quick PIN Unlock (Fast Session Resume)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Resume this page session with a 4–8 digit PIN. Refreshing or closing the page requires your master password. Five failed attempts disable PIN unlock.
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
          <Box id="authenticator-preferences" sx={{ scrollMarginTop: 60 }}>
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
          <Box id="generator" sx={{ display: 'flex', flexDirection: 'column', gap: 2, scrollMarginTop: 60 }}>
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
          <Box id="security" sx={{ display: 'flex', flexDirection: 'column', gap: 2, scrollMarginTop: 60 }}>
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
            <FormControlLabel control={<Switch checked={!!localSettings.lockOnBlur} onChange={(e) => handleChange('lockOnBlur', e.target.checked)} />} label="Lock vault immediately when switching tabs or minimizing" />
          </Box>

          <Divider />

          {/* Danger Zone: Password-Protected Delete Vault */}
          <Box id="danger" component="form" onSubmit={handleDeleteVaultSubmit} sx={{ p: 2.5, border: 1, borderColor: 'error.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)', display: 'flex', flexDirection: 'column', gap: 2, scrollMarginTop: 60 }}>
            <Typography variant="subtitle2" color="error" sx={{ fontWeight: 700 }}>
              ⚠️ Danger Zone: Password-Protected Vault Deletion
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Permanently delete vault [{currentProfile}] and all stored data. You will be asked for the master password before deletion.
            </Typography>

            {deleteError && <Alert severity="error">{deleteError}</Alert>}

            <Button type="submit" variant="contained" color="error" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, alignSelf: 'flex-start' }}>
              Confirm & Delete Vault Permanently
            </Button>
          </Box>

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', position: 'sticky', bottom: 0, bgcolor: 'background.paper', zIndex: 1, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={handleClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Preferences</Button>
      </DialogActions>
    </Dialog>
  );
}
