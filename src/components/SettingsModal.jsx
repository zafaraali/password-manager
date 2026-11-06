import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, MenuItem, TextField, FormControlLabel, Switch } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

export default function SettingsModal({
  open,
  onClose,
  mode,
  setMode,
  accentColor,
  setAccentColor,
  useGradient,
  setUseGradient,
  autoLockMinutes,
  setAutoLockMinutes
}) {
  const accentColors = [
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Pure Blue', value: '#2563eb' },
    { label: 'Emerald Green', value: '#10b981' },
    { label: 'Sunset Amber', value: '#f59e0b' },
    { label: 'Ruby Red', value: '#ef4444' },
    { label: 'Cyber Purple', value: '#8b5cf6' }
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SettingsIcon color="primary" /> Vault Settings & Appearance
      </DialogTitle>
      <DialogContent sx={{ overflowY: 'visible', display: 'flex', flexDirection: 'column', gap: 3, pt: '8px !important' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Theme Mode
          </Typography>
          <TextField
            select
            fullWidth
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <MenuItem value="dark">Dark Mode</MenuItem>
            <MenuItem value="light">Light Mode</MenuItem>
            <MenuItem value="system">Auto / Match OS System</MenuItem>
          </TextField>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Accent Color Theme
          </Typography>
          <TextField
            select
            fullWidth
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            SelectProps={{
              renderValue: (selected) => {
                const found = accentColors.find(c => c.value === selected);
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: selected, flexShrink: 0 }} />
                    <Typography component="span">{found ? found.label : selected}</Typography>
                  </Box>
                );
              }
            }}
          >
            {accentColors.map(c => (
              <MenuItem key={c.value} value={c.value} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: c.value, flexShrink: 0 }} />
                <Typography>{c.label}</Typography>
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Auto-Lock Inactivity Timer
          </Typography>
          <TextField
            select
            fullWidth
            value={autoLockMinutes}
            onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
          >
            <MenuItem value={0}>Never (Manual Lock Only)</MenuItem>
            <MenuItem value={5}>5 Minutes</MenuItem>
            <MenuItem value={10}>10 Minutes</MenuItem>
            <MenuItem value={15}>15 Minutes</MenuItem>
          </TextField>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
            Background Style
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={useGradient}
                onChange={(e) => setUseGradient(e.target.checked)}
              />
            }
            label="Enable Gradient Background"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
          Save & Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
