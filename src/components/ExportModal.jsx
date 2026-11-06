import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

export default function ExportModal({ open, onClose, profileName }) {
  const pfx = profileName === 'Default' ? '' : `_${profileName}`;

  const handleExport = () => {
    const salt = localStorage.getItem(`ciphervault_salt${pfx}`);
    const vault = localStorage.getItem(`ciphervault_vault${pfx}`);
    const hint = localStorage.getItem(`ciphervault_hint${pfx}`);
    const recovery = localStorage.getItem(`ciphervault_recovery${pfx}`);

    const backupData = {
      profile: profileName,
      salt,
      vault: JSON.parse(vault),
      hint,
      recovery,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciphervault-${profileName}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>📦 Backup Encrypted Vault [{profileName}]</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          Export your encrypted vault container as a JSON file. Your data remains fully encrypted with AES-256-GCM.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={handleExport} variant="contained">Download Backup</Button>
      </DialogActions>
    </Dialog>
  );
}
