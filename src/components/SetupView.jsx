import { vaultStorage } from '../utils/storage';
import { pinSession } from '../utils/pinSession';
import { useFeedback } from './FeedbackProvider';
import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert, Chip } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function SetupView({ onSetupSuccess, profileName }) {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const { confirm } = useFeedback();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdRevision, setCreatedRevision] = useState(null);
  const [derivedVaultKey, setDerivedVaultKey] = useState(null);

  // Clean up any historical insecure temp password in localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('ciphervault_temp_pw');
    } catch (e) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Master password is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Master password must be at least 8 characters long');
      return;
    }

    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const newSalt = await CryptoEngine.generateSalt();
      const record = vaultStorage.get(profileName);
      if (record?.vault && !await confirm({ title: 'Replace existing vault?', message: 'This creates an empty vault. Export a backup first. The previous encrypted version will also be retained locally.', confirmLabel: 'Replace vault', severity: 'error' })) return;
      const derivedKey = await CryptoEngine.deriveMasterKey(password, newSalt);
      
      const initialItems = [];

      const vaultPayload = { items: initialItems, trash: [] };
      const encrypted = await CryptoEngine.encryptPayload(derivedKey, JSON.stringify(vaultPayload));
      
      const next = await vaultStorage.commit(profileName, record.revision, () => ({ salt: newSalt, vault: encrypted, hint, created: new Date().toISOString() }), () => active.current);
      if (!active.current) return;
      pinSession.clear(profileName);

      setDerivedVaultKey(derivedKey);
      setCreatedRevision(next.revision);
      setPassword(''); setConfirmPassword('');
    } catch (err) {
      setError('Setup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (createdRevision !== null) {
    return (
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
          🎉 Vault Created ({profileName})!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Export an encrypted backup from the vault and keep your master password safe. There is no password reset or recovery code. A backup requires its original master password.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'action.hover', mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>
            Keep an encrypted backup
          </Typography>
        </Paper>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1, mb: 3 }}>
          <Chip label="Backup needed" color="success" variant="outlined" />
          <Chip label="Next: add an item" color="primary" variant="outlined" />
          <Chip label="Then: secure your session" variant="outlined" />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
          <Chip label="Next: add a login, note, or authenticator token" variant="outlined" color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            You can enable PIN unlock, import an existing vault, and review security settings from the dashboard.
          </Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() => {
            onSetupSuccess(derivedVaultKey, [], [], createdRevision);
          }}
          sx={{ py: 1.5, fontWeight: 600, color: '#fff' }}
        >
          Continue to Vault
        </Button>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3, border: 1, borderColor: 'divider' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
        Set Up Vault for [{profileName}]
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create a strong master password. This password derives your encryption key locally using PBKDF2 with 600,000 iterations.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          label="Master Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <TextField
          margin="normal"
          required
          fullWidth
          label="Confirm Master Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <TextField
          margin="normal"
          fullWidth
          label="Password Hint (Optional)"
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          sx={{ mb: 3 }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '1rem', color: '#fff' }}
        >
          {loading ? 'Initializing Vault & Deriving Key...' : 'Create Vault'}
        </Button>
      </Box>
    </Paper>
  );
}
