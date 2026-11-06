import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Switch, FormControlLabel, Box, Badge, Select, MenuItem, IconButton, Menu, Divider } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';

export default function Navbar({ mode, setMode, unlocked, onLock, onOpenAuditor, onOpenExport, trashCount, onOpenTrash, profiles, currentProfile, onSwitchProfile, onOpenProfileManager, onOpenSettings, onLogoClick }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const closeMenu = () => setMenuAnchor(null);
  const menuAction = (action) => { closeMenu(); action(); };
  return <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', backdropFilter: 'blur(14px)', color: 'text.primary' }}>
    <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, gap: { xs: 1, sm: 2 }, py: 1 }}>
      <Typography variant="h6" component="div" onClick={onLogoClick} aria-label="CipherVault home" sx={{ flexGrow: 1, fontWeight: 850, letterSpacing: '-.04em', display: 'flex', alignItems: 'center', gap: .9, cursor: 'pointer', '&:hover': { opacity: .82 }, background: theme => `linear-gradient(135deg, ${theme.palette.primary.main}, #a855f7)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        <Box component="span" sx={{ fontSize: '1.25rem', WebkitTextFillColor: 'initial' }}>🔐</Box> CipherVault
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: .75, sm: 1.25 } }}>
        {profiles.length > 0 && <Select size="small" value={currentProfile} onChange={e => e.target.value === 'manage' ? onOpenProfileManager() : onSwitchProfile(e.target.value)} aria-label="Current profile" sx={{ minWidth: { xs: 106, sm: 140 }, maxWidth: { xs: 130, sm: 180 }, fontSize: '.82rem', fontWeight: 650, borderRadius: 2 }}>
          {profiles.map(p => <MenuItem key={p} value={p}><AccountCircleOutlinedIcon sx={{ fontSize: 16, mr: .75, verticalAlign: 'middle' }} />{p}</MenuItem>)}
          <MenuItem value="manage" sx={{ fontWeight: 700, color: 'primary.main' }}>Manage profiles</MenuItem>
        </Select>}
        <IconButton onClick={onOpenSettings} color="inherit" aria-label="Open settings" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: .9 }}><SettingsIcon fontSize="small" /></IconButton>
        <FormControlLabel control={<Switch checked={mode === 'dark'} onChange={() => setMode(prev => prev === 'dark' ? 'light' : 'dark')} color="primary" inputProps={{ 'aria-label': 'Toggle dark mode' }} />} label={mode === 'dark' ? '🌙' : '☀️'} sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontSize: '.9rem' } }} />
        {unlocked && <>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={<SecurityIcon />} onClick={onOpenAuditor} sx={{ borderRadius: 2 }}>Audit</Button>
            <Button variant="outlined" size="small" startIcon={<BackupIcon />} onClick={onOpenExport} sx={{ borderRadius: 2 }}>Backup</Button>
          </Box>
          <Badge badgeContent={trashCount} color="error"><Button variant="outlined" size="small" startIcon={<DeleteOutlineIcon />} onClick={onOpenTrash} sx={{ borderRadius: 2, display: { xs: 'none', sm: 'inline-flex' } }}>Trash</Button></Badge>
          <IconButton onClick={e => setMenuAnchor(e.currentTarget)} aria-label="More vault actions" sx={{ display: { xs: 'inline-flex', md: 'none' }, border: 1, borderColor: 'divider', borderRadius: 2 }}><MoreVertIcon /></IconButton>
          <Button variant="contained" color="error" size="small" startIcon={<LockOutlinedIcon />} onClick={onLock} sx={{ borderRadius: 2, color: '#fff', minWidth: { xs: 40, sm: 84 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Lock</Box></Button>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem onClick={() => menuAction(onOpenAuditor)}><SecurityIcon fontSize="small" sx={{ mr: 1 }} />Security audit</MenuItem>
            <MenuItem onClick={() => menuAction(onOpenExport)}><BackupIcon fontSize="small" sx={{ mr: 1 }} />Backup & export</MenuItem>
            <Divider />
            <MenuItem onClick={() => menuAction(onOpenTrash)}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />Trash {trashCount ? `(${trashCount})` : ''}</MenuItem>
          </Menu>
        </>}
      </Box>
    </Toolbar>
  </AppBar>;
}
