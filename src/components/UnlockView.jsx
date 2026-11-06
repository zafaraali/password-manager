import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, Link } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';

export default function UnlockView({ username, onUnlock, onResetVault }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleUnlockSubmit = (e) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError('Incorrect master password.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 420, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 54, height: 54, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', mb: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <LockIcon fontSize="large" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Unlock Vault
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Welcome back, <b>{username}</b>. Enter your master password to decrypt your vault.
        </Typography>

        {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleUnlockSubmit} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Master Password"
            type="password"
            fullWidth
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" size="large" sx={{ mt: 1, textTransform: 'none', borderRadius: 2, py: 1.5, fontWeight: 600 }}>
            Unlock
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Forgot password or want to start fresh?{' '}
            <Link component="button" variant="caption" onClick={onResetVault} sx={{ fontWeight: 600 }}>
              Reset Vault
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
