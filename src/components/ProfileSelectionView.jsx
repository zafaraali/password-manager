import React, { useState } from 'react';
import { Box, Paper, Typography, Button, List, ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Tooltip, Alert } from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

export default function ProfileSelectionView({ profiles, onSelectProfile, onCreateNewProfile, onDeleteProfile }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 460, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 54, height: 54, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', mb: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <VpnKeyIcon fontSize="large" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          CipherVault Multi-User
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Select a profile to unlock its encrypted vault or initialize a new user profile.
        </Typography>

        {profiles.length === 0 ? (
          <Alert severity="info" sx={{ width: '100%', mb: 3 }}>
            No profiles found. Create your first profile to get started!
          </Alert>
        ) : (
          <List sx={{ width: '100%', mb: 2 }}>
            {profiles.map((profile) => (
              <ListItem
                key={profile}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 1.5,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => onSelectProfile(profile)}
                secondaryAction={
                  <Tooltip title="Delete Profile Vault">
                    <IconButton edge="end" color="error" onClick={(e) => { e.stopPropagation(); onDeleteProfile(profile); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <AccountCircleIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography sx={{ fontWeight: 700 }}>{profile}</Typography>}
                  secondary="Local Encrypted Vault"
                />
              </ListItem>
            ))}
          </List>
        )}

        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreateNewProfile}
          sx={{ textTransform: 'none', borderRadius: 2, py: 1.2, fontWeight: 600 }}
        >
          Add New User Profile
        </Button>
      </Paper>
    </Box>
  );
}
