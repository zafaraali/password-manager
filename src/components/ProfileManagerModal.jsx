import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, TextField } from '@mui/material';

export default function ProfileManagerModal({ open, onClose, profiles, currentProfile, onSwitchProfile, onCreateProfile, onDeleteProfile, onRenameProfile }) {
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfile, setEditingProfile] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    onCreateProfile(newProfileName.trim());
    setNewProfileName('');
  };

  const handleStartRename = (p) => {
    setEditingProfile(p);
    setRenameValue(p);
  };

  const handleRenameSubmit = (e, oldName) => {
    e.preventDefault();
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setEditingProfile(null);
      return;
    }
    onRenameProfile(oldName, renameValue.trim());
    setEditingProfile(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>👤 User Profile Management</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>Create New Profile / User</Typography>
            <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Profile Name (e.g. Work, Family)"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>Add</Button>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>Existing Profiles</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {profiles.map(p => {
                const isEditing = editingProfile === p;
                return (
                  <Paper key={p} elevation={0} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 1, borderColor: currentProfile === p ? 'primary.main' : 'divider', borderRadius: 3, bgcolor: 'background.paper' }}>
                    {isEditing ? (
                      <Box component="form" onSubmit={(e) => handleRenameSubmit(e, p)} sx={{ display: 'flex', gap: 1, flex: 1, mr: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                        <Button type="submit" size="small" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>Save</Button>
                        <Button size="small" variant="outlined" onClick={() => setEditingProfile(null)} sx={{ textTransform: 'none', borderRadius: 2 }}>Cancel</Button>
                      </Box>
                    ) : (
                      <>
                        <Typography variant="body1" sx={{ fontWeight: currentProfile === p ? 700 : 500 }}>
                          {p} {currentProfile === p && '(Active)'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {currentProfile !== p && (
                            <Button size="small" variant="outlined" onClick={() => { onSwitchProfile(p); onClose(); }} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>Switch</Button>
                          )}
                          <Button size="small" variant="outlined" onClick={() => handleStartRename(p)} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>Rename</Button>
                          {profiles.length > 1 && (
                            <Button size="small" color="error" variant="outlined" onClick={() => onDeleteProfile(p)} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>Delete</Button>
                          )}
                        </Box>
                      </>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
