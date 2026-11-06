import React, { useState, useEffect } from 'react';
import { Paper, Typography, Button, Box, TextField, Grid, Chip, IconButton } from '@mui/material';
import TOTPWidget from './TOTPWidget';
import { TOTP } from '../utils/totp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function AuthenticatorOnlyView({ onBackToLogin, settings }) {
  const [authItems, setAuthItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openAdd, setOpenAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [copiedMsg, setCopiedMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('ciphervault_standalone_2fa');
    if (saved) {
      try {
        setAuthItems(JSON.parse(saved));
      } catch (e) {}
    } else {
      // Default sample 2FA if empty
      const initial = [
        { id: '1', name: 'Google (sample@gmail.com)', secret: 'JBSWY3DPEHPK3PXP' },
        { id: '2', name: 'GitHub (developer)', secret: 'GEZDGNBVGY3TQOJQ' }
      ];
      setAuthItems(initial);
      localStorage.setItem('ciphervault_standalone_2fa', JSON.stringify(initial));
    }
  }, []);

  const saveAuthItems = (updated) => {
    setAuthItems(updated);
    localStorage.setItem('ciphervault_standalone_2fa', JSON.stringify(updated));
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newName || !newSecret) return;
    const cleanSecret = newSecret.replace(/\s+/g, '').toUpperCase();
    const updated = [...authItems, { id: Date.now().toString(), name: newName, secret: cleanSecret }];
    saveAuthItems(updated);
    setNewName('');
    setNewSecret('');
    setOpenAdd(false);
    setCopiedMsg('2FA account added successfully!');
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to remove this 2FA account?')) {
      const updated = authItems.filter(i => i.id !== id);
      saveAuthItems(updated);
      setCopiedMsg('2FA account removed.');
    }
  };

  const handleCopyCode = async (code, name) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedMsg(`Copied 2FA code for [${name}]!`);
      setTimeout(() => setCopiedMsg(''), 3000);
    } catch (e) {
      alert('Failed to copy code: ' + e.message);
    }
  };

  const filtered = authItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 4, border: 1, borderColor: 'divider', background: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>📲 Standalone 2FA Authenticator</Typography>
          <Typography variant="body2" color="text.secondary">
            {authItems.length} authenticator account{authItems.length === 1 ? '' : 's'} loaded without master password. {copiedMsg && <Box component="span" sx={{ color: 'secondary.main', fontWeight: 600, ml: 1 }}>{copiedMsg}</Box>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={onBackToLogin} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            🔐 Back to Password Vault
          </Button>
          <Button variant="contained" onClick={() => setOpenAdd(!openAdd)} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', bgcolor: 'primary.main' }}>
            {openAdd ? 'Cancel' : '+ Add 2FA Account'}
          </Button>
        </Box>
      </Paper>

      {openAdd && (
        <Paper elevation={0} component="form" onSubmit={handleAddItem} sx={{ p: 3, borderRadius: 4, border: 1, borderColor: 'primary.main', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Add New Authenticator Token</Typography>
          <TextField
            label="Account Name / Issuer (e.g. Google, GitHub)"
            required
            fullWidth
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <TextField
            label="TOTP Secret Key (Base32)"
            required
            fullWidth
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            placeholder="JBSWY3DPEHPK3PXP"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff' }}>
              Save Account
            </Button>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TextField
          size="small"
          placeholder="Search 2FA accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: { xs: '100%', sm: '260px' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </Box>

      <Grid container spacing={3}>
        {filtered.length === 0 ? (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No 2FA accounts found</Typography>
              <Typography variant="body2" color="text.secondary">Click "+ Add 2FA Account" above to get started.</Typography>
            </Paper>
          </Grid>
        ) : (
          filtered.map(item => (
            <Grid item xs={12} sm={6} key={item.id}>
              <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', bgcolor: 'background.paper', '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }, transition: 'all 0.2s' }}>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{item.name}</Typography>
                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id)} title="Delete">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <TOTPWidget secret={item.secret} settings={settings} />
                </Box>
              </Paper>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  );
}
