import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from '@mui/material';

export default function TrashModal({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Trash / Archive</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Deleted items are permanently removed upon vault locking or manual purging. No items currently in trash.
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
