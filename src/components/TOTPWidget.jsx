import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

export default function TOTPWidget({ open, onClose, selectedItem }) {
  const otpauthUrl = selectedItem ? `otpauth://totp/${encodeURIComponent(selectedItem.title)}?secret=${selectedItem.password}&issuer=CipherVault` : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCodeScannerIcon /> 2FA QR Code
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary" align="center">
          Scan this URI into your mobile authenticator app for <b>{selectedItem?.title}</b>:
        </Typography>
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, width: '100%', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px' }}>
          {otpauthUrl}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" fullWidth sx={{ textTransform: 'none', borderRadius: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
