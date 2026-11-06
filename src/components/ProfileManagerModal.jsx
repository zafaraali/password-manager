import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, TextField } from '@mui/material';

export default function ProfileManagerModal({ open, onClose, profiles, currentProfile, onSwitchProfile, onCreateProfile, onDeleteProfile }) {
  const [newProfileName, setNewProfileName] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim());
    setNewProfileName('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>👤 User Profile Management</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Create New Profile / User</Typography>
            <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Profile Name (e.g. Work, Family)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
              <Button type="submit" variant="contained">Add</Button>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>Existing Profiles</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {profiles.map(p => (
                <Paper key={p} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 1, borderColor: currentProfile === p ? 'primary.main' : 'divider' }}>
                  <Typography variant="body1" sx={{ fontWeight: currentProfile === p ? 700 : 400 }}>
                    {p} {currentProfile === p && '(Active)'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {currentProfile !== p && (
                      <Button size="small" variant="outlined" onClick={() => { onSwitchProfile(p); onClose(); }}>Switch</Button>
                    )}
                    {profiles.length > 1 && (
                      <Button size="small" color="error" onClick={() => onDeleteProfile(p)}>Delete</Button>
                    )}
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
