import { vaultStorage, validateVault } from '../utils/storage';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { TOTP } from '../utils/totp';
import { CryptoEngine } from '../utils/crypto';

function TotpAccountCard({ account, tick, onCopy }) {
  const [code, setCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    let isMounted = true;
    TOTP.generate(account.totpSecret).then((c) => {
      if (isMounted) {
        setCode(c);
        setTimeLeft(TOTP.getTimeRemaining());
      }
    });
    return () => { isMounted = false; };
  }, [account.totpSecret, tick]);

  const ringColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#10b981';

  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        border: 1, 
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, mr: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {account.name}
        </Typography>
        {account.username && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {account.username}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontFamily: 'monospace', 
              fontWeight: 800, 
              letterSpacing: 2, 
              color: 'primary.main',
              fontSize: '1.2rem'
            }}
          >
            {code}
          </Typography>
          <Typography 
            variant="caption" 
            sx={{ 
              fontFamily: 'monospace', 
              fontWeight: 700, 
              px: 0.8, 
              py: 0.2, 
              borderRadius: 1, 
              bgcolor: `${ringColor}15`, 
              color: ringColor 
            }}
          >
            {timeLeft}s
          </Typography>
        </Box>
      </Box>
      <Button 
        size="small" 
        variant="contained" 
        startIcon={<ContentCopyIcon fontSize="small" />}
        onClick={() => onCopy(code, account.name)}
        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff' }}
      >
        Copy
      </Button>
    </Paper>
  );
}

export default function QuickTotpModal({ open, onClose, profiles = ['Default'] }) {
  const [selectedProfile, setSelectedProfile] = useState(profiles[0] || 'Default');
  const [totpAccounts, setTotpAccounts] = useState([]);
  const [passwordPrompt, setPasswordPrompt] = useState('');
  const [error, setError] = useState('');
  const [copiedMsg, setCopiedMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      setTotpAccounts([]);
      setPasswordPrompt('');
      setError('');
      setSearchQuery('');
    }
  }, [open, selectedProfile]);

  const handleUnlockQuick = async (e) => {
    e.preventDefault();
    try {
      const pfx = selectedProfile === 'Default' ? '' : `_${selectedProfile}`;
      const savedSalt = vaultStorage.get(selectedProfile)?.salt;
      const savedCipherStr = JSON.stringify(vaultStorage.get(selectedProfile)?.vault);
      
      if (!savedCipherStr || !savedSalt) {
        setError(`No vault found for profile [${selectedProfile}].`);
        return;
      }

      const derivedKey = await CryptoEngine.deriveMasterKey(passwordPrompt, savedSalt);
      const encryptedObj = JSON.parse(savedCipherStr);
      const decryptedJson = await CryptoEngine.decryptPayload(derivedKey, encryptedObj);
      const parsedData = validateVault(JSON.parse(decryptedJson));
      const items = Array.isArray(parsedData) ? parsedData : (parsedData.items || []);

      const secrets = items.filter(i => i.totpSecret);
      if (secrets.length === 0) {
        setError('No items with 2FA TOTP secrets found in this vault.');
      } else {
        setTotpAccounts(secrets);
        setError('');
        setPasswordPrompt('');
      }
    } catch (err) {
      setError('Incorrect master password.');
    }
  };

  const handleCopy = (code, name) => {
    navigator.clipboard.writeText(code);
    setCopiedMsg(`Copied 2FA code for [${name}]!`);
    setTimeout(() => setCopiedMsg(''), 3000);
  };

  const filtered = totpAccounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (acc.username && acc.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⚡ Quick 2FA Authenticator</span>
        {copiedMsg && (
          <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 700 }}>
            {copiedMsg}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              select
              SelectProps={{ native: true }}
              size="small"
              label="Select Profile"
              value={selectedProfile}
              onChange={(e) => {
                setSelectedProfile(e.target.value);
                setTotpAccounts([]);
              }}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            >
              {profiles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </TextField>
          </Box>

          {totpAccounts.length === 0 ? (
            <Paper 
              elevation={0}
              component="form" 
              onSubmit={handleUnlockQuick} 
              sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.paper' }}
            >
              <Typography variant="body2" color="text.secondary">
                Enter master password for <strong>[{selectedProfile}]</strong> to quickly load all 2FA tokens without opening the full vault:
              </Typography>
              {error && <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>{error}</Typography>}
              <TextField
                type="password"
                size="small"
                label="Master Password"
                required
                autoFocus
                value={passwordPrompt}
                onChange={(e) => setPasswordPrompt(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <Button type="submit" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff' }}>
                Load 2FA Codes
              </Button>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                size="small"
                placeholder="Search 2FA accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '400px', overflowY: 'auto' }}>
                {filtered.map(acc => (
                  <TotpAccountCard key={acc.id} account={acc} tick={tick} onCopy={handleCopy} />
                ))}
                {filtered.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No matching 2FA accounts.
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
