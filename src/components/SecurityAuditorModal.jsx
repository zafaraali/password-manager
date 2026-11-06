import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Alert } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';

export default function SecurityAuditorModal({ open, onClose, vaultItems }) {
  const passwords = vaultItems.filter(i => i.password).map(i => i.password);
  const weakPasswords = passwords.filter(p => p.length < 8);
  const duplicatePasswords = passwords.filter((p, index) => passwords.indexOf(p) !== index);

  const now = Date.now();
  const agingPasswords = vaultItems.filter(i => {
    if (!i.password || !i.createdAt) return false;
    const ageDays = (now - i.createdAt) / (1000 * 60 * 60 * 24);
    return ageDays > 90;
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <SecurityIcon color="primary" /> Security Auditor
      </DialogTitle>
      <DialogContent sx={{ overflowY: 'visible', display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Analysis of your vault items for potential security vulnerabilities and credential hygiene.
        </Typography>

        {weakPasswords.length > 0 ? (
          <Alert severity="warning">
            Found <b>{weakPasswords.length}</b> weak passwords (less than 8 characters).
          </Alert>
        ) : (
          <Alert severity="success">No weak passwords detected.</Alert>
        )}

        {duplicatePasswords.length > 0 ? (
          <Alert severity="error">
            Found <b>{duplicatePasswords.length}</b> reused passwords across multiple items.
          </Alert>
        ) : (
          <Alert severity="success">No reused passwords detected.</Alert>
        )}

        {agingPasswords.length > 0 ? (
          <Alert severity="info">
            Found <b>{agingPasswords.length}</b> passwords older than 90 days. Consider rotating them.
          </Alert>
        ) : (
          <Alert severity="success">All passwords are fresh (under 90 days old).</Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
