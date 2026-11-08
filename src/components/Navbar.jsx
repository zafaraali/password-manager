import React, { useEffect, useMemo, useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Switch, FormControlLabel, Box, Badge, Select, MenuItem, IconButton, Menu, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, List, ListItemButton, ListItemText, ListItemIcon } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import BackupIcon from '@mui/icons-material/Backup';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import HistoryIcon from '@mui/icons-material/History';

export default function Navbar({ mode, setMode, unlocked, onLock, onOpenAuditor, onOpenExport, trashCount, onOpenTrash, profiles, currentProfile, onSwitchProfile, onOpenProfileManager, onOpenSettings, onOpenSync, onOpenActivity, onLogoClick, backupTimestamp, autoLockRemaining = 0, auditScore, auditIssueCount = 0 }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [healthAnchor, setHealthAnchor] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const closeMenu = () => setMenuAnchor(null);
  const menuAction = action => { closeMenu(); action?.(); };
  const cycleMode = () => setMode(previous => previous === 'dark' ? 'light' : previous === 'light' ? 'system' : 'dark');

  useEffect(() => {
    const onKeyDown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandQuery(''); setCommandIndex(0); setCommandOpen(true); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l' && unlocked) { event.preventDefault(); onLock?.(); }
      if (event.key === 'Escape') { setCommandOpen(false); setShortcutOpen(false); setHealthAnchor(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onLock, unlocked]);

  const commands = useMemo(() => [
    { label: 'Lock vault', keywords: 'lock secure', icon: <LockOutlinedIcon />, action: onLock, disabled: !unlocked },
    { label: 'Open security audit', keywords: 'audit security health', icon: <SecurityIcon />, action: onOpenAuditor, disabled: !unlocked },
    { label: 'Open backup & export', keywords: 'backup export', icon: <BackupIcon />, action: onOpenExport, disabled: !unlocked },
    { label: 'Open device sync', keywords: 'sync backup devices', icon: <CloudDoneIcon />, action: onOpenSync, disabled: !unlocked },
    { label: 'View vault activity', keywords: 'activity history events', icon: <HistoryIcon />, action: onOpenActivity, disabled: !unlocked },
    { label: 'Open trash', keywords: 'trash deleted', icon: <DeleteOutlineIcon />, action: onOpenTrash, disabled: !unlocked },
    { label: 'Manage profiles', keywords: 'profile account', icon: <AccountCircleOutlinedIcon />, action: onOpenProfileManager },
    { label: 'Open settings', keywords: 'settings preferences', icon: <SettingsIcon />, action: onOpenSettings },
    { label: `Switch to ${mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'} theme`, keywords: 'theme appearance', icon: <Switch checked={mode === 'dark'} />, action: cycleMode }
  ].filter(command => !command.disabled && `${command.label} ${command.keywords}`.toLowerCase().includes(commandQuery.toLowerCase())), [commandQuery, mode, unlocked]);

  useEffect(() => setCommandIndex(index => Math.min(index, Math.max(commands.length - 1, 0))), [commands.length]);
  const runCommand = command => { setCommandOpen(false); setCommandQuery(''); setCommandIndex(0); command?.action?.(); };
  const backupAge = backupTimestamp ? Math.max(0, Date.now() - new Date(backupTimestamp).getTime()) : Infinity;
  const backupHealthy = backupAge < 7 * 86400000;
  const backupLabel = backupTimestamp ? (backupAge < 86400000 ? 'Backed up today' : `Backup ${Math.floor(backupAge / 86400000)}d ago`) : 'Backup overdue';
  const auditLabel = auditScore === null || auditScore === undefined ? 'Audit pending' : `Audit ${auditScore}%`;
  const healthWarning = auditIssueCount > 0 || !backupHealthy;

  return <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', backdropFilter: 'blur(14px)', color: 'text.primary' }}>
    <Toolbar sx={{ minHeight: { xs: 64, sm: 72 }, gap: { xs: .75, sm: 1.5 }, py: 1 }}>
      <Typography variant="h6" component="button" onClick={onLogoClick} aria-label="CipherVault home" sx={{ border: 0, p: 0, bgcolor: 'transparent', textAlign: 'left', fontSize: { xs: '1rem', sm: '1.25rem' }, minWidth: 0, flexGrow: 1, fontWeight: 850, letterSpacing: '-.04em', display: 'flex', alignItems: 'center', gap: .9, cursor: 'pointer', '&:hover': { opacity: .82 }, background: theme => `linear-gradient(135deg, ${theme.palette.primary.main}, #a855f7)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}><LockOutlinedIcon sx={{ fontSize: '1.25rem', WebkitTextFillColor: 'initial' }} /> CipherVault</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: .5, sm: 1 } }}>
        {profiles.length > 0 && <Select size="small" value={currentProfile} onChange={event => event.target.value === 'manage' ? onOpenProfileManager() : onSwitchProfile(event.target.value)} aria-label="Current profile" sx={{ minWidth: { xs: 90, sm: 140 }, maxWidth: { xs: 110, sm: 180 }, fontSize: '.82rem', fontWeight: 650, borderRadius: 2 }}>{profiles.map(profile => <MenuItem key={profile} value={profile}><AccountCircleOutlinedIcon sx={{ fontSize: 16, mr: .75, verticalAlign: 'middle' }} />{profile}</MenuItem>)}<MenuItem value="manage" sx={{ fontWeight: 700, color: 'primary.main' }}>Manage profiles</MenuItem></Select>}
        {unlocked && <IconButton onClick={event => setHealthAnchor(event.currentTarget)} color={healthWarning ? 'warning' : 'success'} aria-label="Open vault health" title="Vault health" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: .9 }}><Badge variant="dot" color={healthWarning ? 'warning' : 'success'}><SecurityIcon fontSize="small" /></Badge></IconButton>}
        <FormControlLabel control={<Switch checked={mode === 'dark'} onChange={cycleMode} color="primary" inputProps={{ 'aria-label': `Theme mode: ${mode}` }} />} label={mode === 'system' ? 'Auto' : mode === 'dark' ? 'Dark' : 'Light'} sx={{ display: { xs: 'none', sm: 'inline-flex' }, mr: 0, '& .MuiFormControlLabel-label': { fontSize: '.78rem' } }} />
        {unlocked && <Badge badgeContent={trashCount} color="error"><Button variant="outlined" size="small" startIcon={<DeleteOutlineIcon />} onClick={onOpenTrash} sx={{ borderRadius: 2, display: { xs: 'none', sm: 'inline-flex' } }}>Trash</Button></Badge>}
        {unlocked && <Button aria-label="Lock vault" variant="contained" color="primary" size="small" startIcon={<LockOutlinedIcon />} onClick={onLock} sx={{ borderRadius: 2, color: '#fff', minWidth: { xs: 40, sm: 84 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}><Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Lock</Box></Button>}
        {unlocked && <IconButton onClick={event => setMenuAnchor(event.currentTarget)} aria-label="More vault actions" title="More actions" sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}><MoreVertIcon /></IconButton>}
        <IconButton onClick={() => { setCommandQuery(''); setCommandIndex(0); setCommandOpen(true); }} aria-label="Open command palette" title="Command palette (Ctrl+K)" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: .9 }}><SearchIcon fontSize="small" /></IconButton>
        <IconButton onClick={onOpenSettings} color="inherit" aria-label="Open settings" title="Settings" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: .9 }}><SettingsIcon fontSize="small" /></IconButton>
      </Box>
    </Toolbar>
    <Menu anchorEl={healthAnchor} open={Boolean(healthAnchor)} onClose={() => setHealthAnchor(null)} MenuListProps={{ 'aria-label': 'Vault health details' }}><MenuItem disabled sx={{ opacity: 1, display: 'block', minWidth: 260 }}><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Vault health</Typography><Typography variant="caption" color="text.secondary">Security, backups, and session status</Typography></MenuItem><Divider /><MenuItem onClick={() => { setHealthAnchor(null); onOpenAuditor?.(); }}><SecurityIcon fontSize="small" sx={{ mr: 1 }} /><ListItemText primary={auditIssueCount ? `${auditLabel} • ${auditIssueCount} issues` : auditLabel} secondary="Open security audit" /></MenuItem><MenuItem onClick={() => { setHealthAnchor(null); onOpenExport?.(); }}><BackupIcon fontSize="small" sx={{ mr: 1 }} /><ListItemText primary={backupLabel} secondary="Open backup & export" /></MenuItem><MenuItem onClick={() => { setHealthAnchor(null); onOpenSync?.(); }}><CloudDoneIcon fontSize="small" sx={{ mr: 1 }} /><ListItemText primary="Device sync" secondary="Review remote backup status" /></MenuItem>{autoLockRemaining > 0 && <MenuItem disabled><TimerOutlinedIcon fontSize="small" sx={{ mr: 1 }} /><ListItemText primary={`Locks in ${autoLockRemaining < 60000 ? `${Math.ceil(autoLockRemaining / 1000)}s` : `${Math.ceil(autoLockRemaining / 60000)}m`}`} secondary="Auto-lock countdown" /></MenuItem>}</Menu>
    <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}><MenuItem onClick={() => menuAction(onOpenAuditor)}><SecurityIcon fontSize="small" sx={{ mr: 1 }} />Security audit</MenuItem><MenuItem onClick={() => menuAction(onOpenExport)}><BackupIcon fontSize="small" sx={{ mr: 1 }} />Backup & export</MenuItem><MenuItem onClick={() => menuAction(onOpenSync)}><CloudDoneIcon fontSize="small" sx={{ mr: 1 }} />Device sync & backups</MenuItem><MenuItem onClick={() => menuAction(onOpenActivity)}><HistoryIcon fontSize="small" sx={{ mr: 1 }} />Vault activity</MenuItem><MenuItem onClick={() => menuAction(onOpenSettings)}><SettingsIcon fontSize="small" sx={{ mr: 1 }} />Settings</MenuItem><MenuItem onClick={() => { cycleMode(); closeMenu(); }}>Switch to {mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark'} theme</MenuItem><Divider /><MenuItem onClick={() => menuAction(onOpenTrash)}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} />Trash {trashCount ? `(${trashCount})` : ''}</MenuItem><MenuItem onClick={() => { closeMenu(); setShortcutOpen(true); }}><HelpOutlineIcon fontSize="small" sx={{ mr: 1 }} />Keyboard shortcuts</MenuItem></Menu>
    <Dialog open={commandOpen} onClose={() => setCommandOpen(false)} fullWidth maxWidth="sm" aria-labelledby="command-palette-title"><DialogTitle id="command-palette-title">Command palette</DialogTitle><DialogContent dividers sx={{ p: 0 }}><TextField autoFocus fullWidth placeholder="Search actions..." value={commandQuery} onChange={event => { setCommandQuery(event.target.value); setCommandIndex(0); }} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setCommandIndex(index => Math.min(index + 1, commands.length - 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setCommandIndex(index => Math.max(index - 1, 0)); } if (event.key === 'Enter' && commands[commandIndex]) { event.preventDefault(); runCommand(commands[commandIndex]); } }} inputProps={{ 'aria-label': 'Search commands' }} sx={{ p: 2 }} /><List>{commands.map((command, index) => <ListItemButton key={command.label} selected={index === commandIndex} onClick={() => runCommand(command)}><ListItemIcon>{command.icon}</ListItemIcon><ListItemText primary={command.label} /></ListItemButton>)}{!commands.length && <Typography color="text.secondary" sx={{ p: 3 }}>No matching actions.</Typography>}</List></DialogContent><DialogActions><Button onClick={() => { setCommandOpen(false); setShortcutOpen(true); }}>Keyboard shortcuts</Button><Button onClick={() => setCommandOpen(false)}>Close</Button></DialogActions></Dialog>
    <Dialog open={shortcutOpen} onClose={() => setShortcutOpen(false)} maxWidth="xs" fullWidth aria-labelledby="shortcuts-title"><DialogTitle id="shortcuts-title">Keyboard shortcuts</DialogTitle><DialogContent dividers><List dense><ListItemText primary="Open command palette" secondary="Ctrl / Cmd + K" /><ListItemText primary="Search vault" secondary="/" /><ListItemText primary="Lock vault" secondary="Ctrl / Cmd + L" /><ListItemText primary="Close dialogs" secondary="Esc" /></List></DialogContent><DialogActions><Button onClick={() => setShortcutOpen(false)}>Done</Button></DialogActions></Dialog>
  </AppBar>;
}
