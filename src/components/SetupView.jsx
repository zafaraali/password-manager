import React, { useState } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function SetupView({ onSetupSuccess, profileName }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState('');

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

    setLoading(true);
    setError('');
    try {
      const pfx = profileName === 'Default' ? '' : `_${profileName}`;
      const newSalt = await CryptoEngine.generateSalt();
      const recoveryCode = await CryptoEngine.generateRecoveryCode();
      const derivedKey = await CryptoEngine.deriveMasterKey(password, newSalt);
      
      const initialItems = [
        { id: '1', name: 'Example Login', username: 'user@example.com', password: 'SecurePassword!123', category: 'Logins', notes: 'Welcome to CipherVault!', totpSecret: '', attachment: null, templateData: {} },
        { id: '2', name: 'Crypto Wallet Seed', username: 'Hardware Wallet', category: 'Crypto', password: '', notes: 'Sample Crypto Template', totpSecret: '', attachment: null, templateData: { seedPhrase: 'abandon ability able about above absent absorb abstract absurd abuse access accident', derivationPath: "m/44'/60'/0'/0/0" } }
      ];

      const vaultPayload = { items: initialItems, trash: [] };
      const encrypted = await CryptoEngine.encryptPayload(derivedKey, JSON.stringify(vaultPayload));
      
      localStorage.setItem(`ciphervault_salt${pfx}`, newSalt);
      localStorage.setItem(`ciphervault_vault${pfx}`, JSON.stringify(encrypted));
      localStorage.setItem(`ciphervault_recovery${pfx}`, recoveryCode);
      localStorage.setItem('ciphervault_temp_pw', password);
      if (hint) localStorage.setItem(`ciphervault_hint${pfx}`, hint);

      setGeneratedRecoveryCode(recoveryCode);
    } catch (err) {
      setError('Setup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (generatedRecoveryCode) {
    return (
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'success.main' }}>
          🎉 Vault Created ({profileName})!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please save your Emergency Recovery Code. If you ever forget your master password, you can use this code to reset and recover access.
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'action.hover', mb: 3, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>
            {generatedRecoveryCode}
          </Typography>
        </Paper>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() => {
            navigator.clipboard.writeText(generatedRecoveryCode);
            alert('Recovery code copied to clipboard!');
            onSetupSuccess();
          }}
          sx={{ py: 1.5, fontWeight: 600, color: '#fff' }}
        >
          I Have Saved My Recovery Code — Continue to Vault
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
          {loading ? 'Initializing Vault & Deriving Key...' : 'Create Vault & Generate Recovery Code'}
        </Button>
      </Box>
    </Paper>
  );
}
