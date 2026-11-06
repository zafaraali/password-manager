import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DownloadIcon from '@mui/icons-material/Download';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PasswordGeneratorModal from './PasswordGeneratorModal';

export default function Navbar({
  username,
  mode,
  setMode,
  onLock,
  onSwitchProfile,
  onOpenSettings,
  onOpenAuditor,
  onOpenExport,
  onOpenTrash,
  onOpenProfile,
  onOpenAuthenticatorView,
  accentColor
}) {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <VpnKeyIcon fontSize="small" />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              CipherVault
            </Typography>
            <Typography variant="caption" sx={{ px: 1, py: 0.5, bgcolor: 'action.hover', borderRadius: 1, fontWeight: 500, color: 'text.secondary' }}>
              {username}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Password Generator">
              <Button size="small" variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => setIsGeneratorOpen(true)} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Generator
              </Button>
            </Tooltip>

            <Tooltip title="Authenticator View">
              <Button size="small" variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={onOpenAuthenticatorView} sx={{ textTransform: 'none', borderRadius: 2 }}>
                2FA Codes
              </Button>
            </Tooltip>

            <Tooltip title="Switch User Profile">
              <Button size="small" variant="outlined" startIcon={<SwapHorizIcon />} onClick={onSwitchProfile} sx={{ textTransform: 'none', borderRadius: 2 }}>
                Switch User
              </Button>
            </Tooltip>

            <Tooltip title="Security Auditor">
              <IconButton onClick={onOpenAuditor} color="inherit">
                <SecurityIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export / Import">
              <IconButton onClick={onOpenExport} color="inherit">
                <DownloadIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Trash / Archive">
              <IconButton onClick={onOpenTrash} color="inherit">
                <DeleteSweepIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Profile & Vault Manager">
              <IconButton onClick={onOpenProfile} color="inherit">
                <AccountCircleIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Settings">
              <IconButton onClick={onOpenSettings} color="inherit">
                <SettingsIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Lock Vault">
              <Button size="small" variant="contained" startIcon={<LockIcon />} onClick={onLock} sx={{ bgcolor: accentColor, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: accentColor, filter: 'brightness(0.9)' } }}>
                Lock
              </Button>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <PasswordGeneratorModal
        open={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
      />
    </>
  );
}
