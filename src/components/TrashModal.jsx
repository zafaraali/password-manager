import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, Chip } from '@mui/material';

export default function TrashModal({ open, onClose, trashItems, onRestore, onDeletePermanent }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>🗑️ Trash / Deleted Items</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {trashItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              Trash is empty.
            </Typography>
          ) : (
            trashItems.map(item => (
              <Paper key={item.id} sx={{ p: 2, border: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                  <Chip label={item.category} size="small" variant="outlined" sx={{ mt: 0.5 }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={() => onRestore(item.id)}>Restore</Button>
                  <Button size="small" color="error" onClick={() => onDeletePermanent(item.id)}>Delete Forever</Button>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
