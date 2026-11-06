import React from 'react';
import { AppBar, Toolbar, Typography, Button, Switch, FormControlLabel, Box, Badge, Select, MenuItem, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function Navbar({ 
  mode, setMode, unlocked, onLock, onOpenAuditor, onOpenExport, 
  trashCount, onOpenTrash, profiles, currentProfile, onSwitchProfile, onOpenProfileManager,
  onOpenSettings
}) {
  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', backdropFilter: 'blur(8px)', color: 'text.primary' }}>
      <Toolbar sx={{ flexWrap: 'wrap', gap: 1, py: 1 }}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1.5, background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <Box component="span" sx={{ fontSize: '1.4rem' }}>🔒</Box> CipherVault
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
              sx={{ minWidth: 140, fontSize: '0.85rem', fontWeight: 600, borderRadius: 2 }}
            >
              {profiles.map(p => (
                <MenuItem key={p} value={p}>👤 {p}</MenuItem>
              ))}
              <MenuItem value="manage" sx={{ fontWeight: 600, color: 'primary.main' }}>+ Manage Profiles</MenuItem>
            </Select>
          )}

          <IconButton onClick={onOpenSettings} color="inherit" title="Settings" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
            <SettingsIcon fontSize="small" />
          </IconButton>

          <FormControlLabel
            control={
              <Switch 
                checked={mode === 'dark'} 
                onChange={() => setMode(prev => prev === 'dark' ? 'light' : 'dark')} 
                color="primary"
              />
            }
            label={mode === 'dark' ? '🌙' : '☀️'}
            sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.9rem' } }}
          />

          {unlocked && (
            <>
              <Button variant="outlined" size="small" startIcon={<SecurityIcon />} onClick={onOpenAuditor} sx={{ display: { xs: 'none', md: 'inline-flex' }, textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                Audit
              </Button>
              <Button variant="outlined" size="small" startIcon={<BackupIcon />} onClick={onOpenExport} sx={{ display: { xs: 'none', md: 'inline-flex' }, textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                Backup
              </Button>
              <Badge badgeContent={trashCount} color="error">
                <Button variant="outlined" size="small" startIcon={<DeleteOutlineIcon />} onClick={onOpenTrash} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                  Trash
                </Button>
              </Badge>
              <Button variant="contained" color="error" size="small" startIcon={<LockOutlinedIcon />} onClick={onLock} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff' }}>
                Lock
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
