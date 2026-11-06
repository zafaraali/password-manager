import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, FormControlLabel, Switch, Slider, TextField, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';

export default function SettingsModal({ open, onClose, settings, onSaveSettings }) {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>⚙️ Vault Preferences & Settings</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Theme & Accent Color */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700 }}>
              🎨 App Accent Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {colorThemes.map(theme => {
                const isSelected = (localSettings.accentColor || '#6366f1') === theme.value;
                return (
                  <Button
                    key={theme.value}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => handleChange('accentColor', theme.value)}
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
            <Typography variant="caption" color="text.secondary" display="block">
              When enabled, your TOTP widgets show both current and upcoming codes side-by-side automatically.
            </Typography>
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

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.genUppercase !== false}
                    onChange={(e) => handleChange('genUppercase', e.target.checked)}
                  />
                }
                label="Include Uppercase Letters (A-Z)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.genLowercase !== false}
                    onChange={(e) => handleChange('genLowercase', e.target.checked)}
                  />
                }
                label="Include Lowercase Letters (a-z)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.genNumbers !== false}
                    onChange={(e) => handleChange('genNumbers', e.target.checked)}
                  />
                }
                label="Include Numbers (0-9)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.genSymbols !== false}
                    onChange={(e) => handleChange('genSymbols', e.target.checked)}
                  />
                }
                label="Include Symbols (!@#$%^&*)"
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
              helperText="Time before copied passwords are wiped from system clipboard."
            />

            <TextField
              label="Auto-Lock Inactivity Timeout (Minutes)"
              type="number"
              size="small"
              value={localSettings.autoLockMinutes || 10}
              onChange={(e) => handleChange('autoLockMinutes', parseInt(e.target.value) || 10)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              helperText="Locks vault automatically after period of inactivity."
            />
          </Box>

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Preferences</Button>
      </DialogActions>
    </Dialog>
  );
}
