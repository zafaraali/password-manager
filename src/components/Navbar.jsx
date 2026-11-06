import React from 'react';
import { AppBar, Toolbar, Typography, Button, Switch, FormControlLabel, Box, Badge, Select, MenuItem, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

export default function Navbar({ 
  mode, setMode, unlocked, onLock, onOpenAuditor, onOpenExport, 
  trashCount, onOpenTrash, profiles, currentProfile, onSwitchProfile, onOpenProfileManager,
  onOpenSettings
}) {
  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', color: 'text.primary' }}>
      <Toolbar sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 1 }}>
          🔒 CipherVault
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
          {profiles.length > 0 && (
            <Select
              size="small"
              value={currentProfile}
              onChange={(e) => {
                if (e.target.value === 'manage') {
                  onOpenProfileManager();
                } else {
                  onSwitchProfile(e.target.value);
                }
              }}
              sx={{ minWidth: 130, fontSize: '0.85rem' }}
            >
              {profiles.map(p => (
                <MenuItem key={p} value={p}>👤 {p}</MenuItem>
              ))}
              <MenuItem value="manage" sx={{ fontWeight: 600, color: 'primary.main' }}>+ Manage Profiles</MenuItem>
            </Select>
          )}

          <IconButton onClick={onOpenSettings} color="inherit" title="Settings">
            <SettingsIcon />
          </IconButton>

          <FormControlLabel
            control={
              <Switch 
                checked={mode === 'dark'} 
                onChange={() => setMode(prev => prev === 'dark' ? 'light' : 'dark')} 
                color="primary"
              />
            }
            label={mode === 'dark' ? 'Dark' : 'Light'}
            sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', fontWeight: 500 } }}
          />

          {unlocked && (
            <>
              <Button variant="outlined" size="small" onClick={onOpenAuditor} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                Audit
              </Button>
              <Button variant="outlined" size="small" onClick={onOpenExport} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
                Backup
              </Button>
              <Badge badgeContent={trashCount} color="error">
                <Button variant="outlined" size="small" onClick={onOpenTrash}>
                  Trash
                </Button>
              </Badge>
              <Button variant="outlined" color="error" size="small" onClick={onLock}>
                Lock
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
