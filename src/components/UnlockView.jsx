import React, { useState } from 'react';
import { Paper, Typography, TextField, Button, Box, Alert, Divider } from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function UnlockView({ onUnlockSuccess, onSwitchToSetup, profileName }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');

  const pfx = profileName === 'Default' ? '' : `_${profileName}`;

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your master password');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
      const savedCipherStr = localStorage.getItem(`ciphervault_vault${pfx}`);
      if (!savedCipherStr || !savedSalt) {
        setError('No vault found for this profile. Please set up a vault first.');
        onSwitchToSetup();
        setLoading(false);
        return;
      }

      const derivedKey = await CryptoEngine.deriveMasterKey(password, savedSalt);
      const encryptedObj = JSON.parse(savedCipherStr);
      const decryptedJson = await CryptoEngine.decryptPayload(derivedKey, encryptedObj);
      const parsedData = JSON.parse(decryptedJson);

      const items = Array.isArray(parsedData) ? parsedData : (parsedData.items || []);
      const trash = Array.isArray(parsedData) ? [] : (parsedData.trash || []);

      onUnlockSuccess(derivedKey, items, trash);
    } catch (err) {
      setError('Incorrect master password or corrupted vault data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryReset = async (e) => {
    e.preventDefault();
    const storedRecovery = localStorage.getItem(`ciphervault_recovery${pfx}`);
    if (!storedRecovery || recoveryCodeInput.trim().toUpperCase() !== storedRecovery.trim().toUpperCase()) {
      setError('Invalid recovery code.');
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 8) {
      setError('New master password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const newSalt = await CryptoEngine.generateSalt();
      const derivedKey = await CryptoEngine.deriveMasterKey(newPasswordInput, newSalt);
      
      const initialItems = [
        { id: '1', name: 'Example Login', username: 'user@example.com', password: 'SecurePassword!123', category: 'Logins', notes: 'Vault recovered successfully!', totpSecret: '', attachment: null, templateData: {} }
      ];
      const payload = { items: initialItems, trash: [] };
      const encrypted = await CryptoEngine.encryptPayload(derivedKey, JSON.stringify(payload));

      localStorage.setItem(`ciphervault_salt${pfx}`, newSalt);
      localStorage.setItem(`ciphervault_vault${pfx}`, JSON.stringify(encrypted));

      alert('Vault successfully reset using recovery code!');
      onUnlockSuccess(derivedKey, initialItems, []);
    } catch (err) {
      setError('Recovery failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNukeVault = () => {
    if (confirm(`WARNING: This will permanently delete ALL vault data for profile [${profileName}]. Are you sure?`)) {
      localStorage.removeItem(`ciphervault_salt${pfx}`);
      localStorage.removeItem(`ciphervault_vault${pfx}`);
      localStorage.removeItem(`ciphervault_recovery${pfx}`);
      localStorage.removeItem(`ciphervault_hint${pfx}`);
      alert('Vault nuked.');
      window.location.reload();
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (!backup.salt || !backup.vault) {
          throw new Error('Invalid backup file format.');
        }
        localStorage.setItem(`ciphervault_salt${pfx}`, backup.salt);
        localStorage.setItem(`ciphervault_vault${pfx}`, JSON.stringify(backup.vault));
        if (backup.hint) localStorage.setItem(`ciphervault_hint${pfx}`, backup.hint);
        if (backup.recovery) localStorage.setItem(`ciphervault_recovery${pfx}`, backup.recovery);
        alert('Vault backup imported successfully! Please unlock with your master password.');
        window.location.reload();
      } catch (err) {
        setError('Failed to import backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  if (showRecoveryInput) {
    return (
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, border: 1, borderColor: 'divider' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: 'warning.main' }}>
          🔑 Recover Vault [{profileName}]
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Enter your emergency recovery code and set a new master password.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleRecoveryReset} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Recovery Code (XXXX-XXXX-XXXX-XXXX)"
            value={recoveryCodeInput}
            onChange={(e) => setRecoveryCodeInput(e.target.value)}
            autoFocus
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="New Master Password"
            type="password"
            value={newPasswordInput}
            onChange={(e) => setNewPasswordInput(e.target.value)}
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="warning"
            size="large"
            disabled={loading}
            sx={{ py: 1.5, fontWeight: 600, color: '#fff', mb: 2 }}
          >
            Reset & Recover Vault
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => setShowRecoveryInput(false)}
          >
            Back to Unlock
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 3, border: 1, borderColor: 'divider' }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
        Unlock Vault [{profileName}]
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your master password to decrypt your local zero-knowledge storage container.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleUnlock} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          label="Master Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          sx={{ mb: 3 }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          sx={{ py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '1rem', color: '#fff', mb: 2 }}
        >
          {loading ? 'Deriving Key (600k Iterations)...' : 'Unlock Vault'}
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button size="small" onClick={() => setShowRecoveryInput(true)} sx={{ textTransform: 'none' }}>
            Forgot Password? Recovery Code
          </Button>
          <Button size="small" color="error" onClick={handleNukeVault} sx={{ textTransform: 'none' }}>
            Nuke Vault
          </Button>
        </Box>

        {localStorage.getItem(`ciphervault_hint${pfx}`) && (
          <Typography variant="caption" display="block" sx={{ mt: 1, mb: 2, textAlign: 'center', color: 'text.secondary' }}>
            Hint: {localStorage.getItem(`ciphervault_hint${pfx}`)}
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ textAlign: 'center' }}>
          <Button variant="text" component="label" size="small">
            Import Backup JSON
            <input type="file" hidden accept=".json" onChange={handleFileImport} />
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
