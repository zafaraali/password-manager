import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, LinearProgress } from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';

export default function SetupView({ onSetup }) {
  const [username, setUsername] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'error' };
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score += 25;

    if (score <= 25) return { score, label: 'Weak', color: 'error' };
    if (score <= 50) return { score, label: 'Fair', color: 'warning' };
    if (score <= 75) return { score, label: 'Good', color: 'info' };
    return { score, label: 'Strong', color: 'success' };
  };

  const strength = calculateStrength(masterPassword);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (masterPassword.length < 8) {
      setError('Master password must be at least 8 characters long.');
      return;
    }
    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    onSetup(username.trim(), masterPassword);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 420, borderRadius: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 54, height: 54, borderRadius: 3, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', mb: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <VpnKeyIcon fontSize="large" />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Create Your Vault
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          CipherVault encrypts all your credentials locally with AES-256-GCM and 600k PBKDF2 iterations.
        </Typography>

        {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleCreate} sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Username / Profile Name"
            fullWidth
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Master Password"
            type="password"
            fullWidth
            required
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
          />
          {masterPassword && (
            <Box sx={{ width: '100%', mt: -1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Password Strength:</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }} color={`${strength.color}.main`}>
                  {strength.label}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={strength.score} color={strength.color} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          )}
          <TextField
            label="Confirm Master Password"
            type="password"
            fullWidth
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" size="large" sx={{ mt: 1, textTransform: 'none', borderRadius: 2, py: 1.5, fontWeight: 600 }}>
            Initialize Vault
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
