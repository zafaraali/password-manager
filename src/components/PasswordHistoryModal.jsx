import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper } from '@mui/material';

export default function PasswordHistoryModal({ open, onClose, item, onRestoreOldPassword }) {
  const history = item?.passwordHistory || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>🕒 Password History & Version Control [{item?.name}]</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Previous password versions stored for this item. You can copy or restore any prior version.
          </Typography>

          {history.length === 0 ? (
            <Typography variant="body2" sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
              No previous password versions recorded yet. Password history is updated automatically when you change and save a new password.
            </Typography>
          ) : (
            history.map((entry, index) => (
              <Paper key={index} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 1, borderColor: 'divider' }}>
                <Box>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {entry.password}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Saved on: {new Date(entry.timestamp).toLocaleString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    size="small" 
                    variant="outlined" 
                    onClick={() => {
                      navigator.clipboard.writeText(entry.password);
                      alert('Previous password copied to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                  <Button 
                    size="small" 
                    color="primary" 
                    variant="contained" 
                    onClick={() => {
                      onRestoreOldPassword(item.id, entry.password);
                      onClose();
                    }}
                  >
                    Restore
                  </Button>
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
