import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, TextField, Alert } from '@mui/material';

export default function ProfileManagerModal({ open, onClose, username, onRenameProfile, onDeleteVault }) {
  const [newUsername, setNewUsername] = useState(username);
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState('');

  const handleRename = (e) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    onRenameProfile(newUsername.trim());
    onClose();
  };

  const handleDelete = (e) => {
    e.preventDefault();
    const success = onDeleteVault(deletePassword);
    if (!success) {
      setError('Incorrect master password for vault deletion.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Profile & Vault Management</DialogTitle>
      <DialogContent sx={{ overflowY: 'visible', display: 'flex', flexDirection: 'column', gap: 3, pt: '8px !important' }}>
        <Box component="form" onSubmit={handleRename} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Rename Profile
          </Typography>
          <TextField
            label="Profile Name"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <Button type="submit" variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
            Update Profile Name
          </Button>
        </Box>

        <Box component="form" onSubmit={handleDelete} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="error" sx={{ fontWeight: 700 }}>
            Delete Vault
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Permanently deletes all vault data from local storage. Requires master password confirmation.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Master Password to Confirm"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
          />
          <Button type="submit" color="error" variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
            Permanently Delete Vault
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
