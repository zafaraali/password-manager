import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

export default function PasswordHistoryModal({ open, onClose, selectedItem }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Password History</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          No previous password revisions recorded for <b>{selectedItem?.title}</b>. Current password is active.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
