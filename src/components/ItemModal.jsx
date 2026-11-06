import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, FormControl, InputLabel, Select, MenuItem, Typography, IconButton, InputAdornment, LinearProgress } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { CryptoEngine } from '../utils/crypto';

export default function ItemModal({ open, onClose, onSave, editingItem, activeKey, settings }) {
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formCategory, setFormCategory] = useState('Logins');
  const [formNotes, setFormNotes] = useState('');
  const [formTotp, setFormTotp] = useState('');
  const [formAttachment, setFormAttachment] = useState(null);

  const [templateData, setTemplateData] = useState({});

  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setFormName(editingItem.name || '');
      setFormUsername(editingItem.username || '');
      setFormPassword(editingItem.password || '');
      setFormCategory(editingItem.category || 'Logins');
      setFormNotes(editingItem.notes || '');
      setFormTotp(editingItem.totpSecret || '');
      setFormAttachment(editingItem.attachment || null);
      setTemplateData(editingItem.templateData || {});
    } else {
      setFormName('');
      setFormUsername('');
      setFormPassword('');
      setFormCategory('Logins');
      setFormNotes('');
      setFormTotp('');
      setFormAttachment(null);
      setTemplateData({});
    }
    setShowPassword(false);
    setShowTotp(false);
    setShowSeed(false);
    setShowKey(false);
    setShowPassphrase(false);
  }, [editingItem, open]);

  const handleCategoryChange = (newCat) => {
    setFormCategory(newCat);
    if (newCat === 'Crypto') {
      setTemplateData({ seedPhrase: '', derivationPath: "m/44'/60'/0'/0/0" });
    } else if (newCat === 'SSH') {
      setTemplateData({ host: '', port: '22', privateKey: '', passphrase: '' });
    } else if (newCat === 'Wifi') {
      setTemplateData({ ssid: '', securityType: 'WPA2/WPA3', hidden: 'No' });
    } else {
      setTemplateData({});
    }
  };

  const generateRandomPassword = () => {
    let chars = '';
    if (settings?.genUppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (settings?.genLowercase !== false) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (settings?.genNumbers !== false) chars += '0123456789';
    if (settings?.genSymbols !== false) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    if (!chars) chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

    const length = settings?.passwordLength || 16;
    let res = '';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      res += chars[array[i] % chars.length];
    }
    setFormPassword(res);
  };

  // Password strength meter calculation
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'error' };
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 12) score += 25;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;

    if (score <= 25) return { score, label: 'Weak', color: 'error' };
    if (score <= 50) return { score, label: 'Fair', color: 'warning' };
    if (score <= 75) return { score, label: 'Good', color: 'info' };
    return { score: 100, label: 'Strong', color: 'success' };
  };

  const strength = getPasswordStrength(formPassword);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit for local vault storage.');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const encryptedFile = await CryptoEngine.encryptFile(activeKey, arrayBuffer);
      setFormAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        ...encryptedFile
      });
    } catch (err) {
      alert('Failed to encrypt file attachment: ' + err.message);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName) return;

    const existingHistory = editingItem?.passwordHistory || [];
    let updatedHistory = [...existingHistory];

    if (editingItem && editingItem.password && editingItem.password !== formPassword) {
      updatedHistory.unshift({
        password: editingItem.password,
        timestamp: new Date().toISOString()
      });
      if (updatedHistory.length > 5) updatedHistory.pop();
    }

    onSave({
      id: editingItem ? editingItem.id : Date.now().toString(),
      name: formName,
      username: formUsername,
      password: formPassword,
      category: formCategory,
      notes: formNotes,
      totpSecret: formTotp,
      attachment: formAttachment,
      templateData: templateData,
      passwordHistory: updatedHistory
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>{editingItem ? 'Edit Vault Item' : 'New Vault Item & Template'}</DialogTitle>
      <DialogContent dividers>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            label="Item Name"
            required
            fullWidth
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
          <FormControl fullWidth>
            <InputLabel>Category / Template</InputLabel>
            <Select
              value={formCategory}
              label="Category / Template"
              onChange={(e) => handleCategoryChange(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="Logins">🔐 Login / Password</MenuItem>
              <MenuItem value="Cards">💳 Credit / Debit Card</MenuItem>
              <MenuItem value="Notes">📝 Secure Note</MenuItem>
              <MenuItem value="ApiKeys">🔑 API Key / Token</MenuItem>
              <MenuItem value="Crypto">🪙 Crypto Wallet (Seed Phrase)</MenuItem>
              <MenuItem value="SSH">🖥️ Server SSH Key Config</MenuItem>
              <MenuItem value="Wifi">📶 Wi-Fi Router Credentials</MenuItem>
            </Select>
          </FormControl>

          {formCategory !== 'Crypto' && formCategory !== 'SSH' && formCategory !== 'Wifi' && (
            <>
              <TextField
                label="Username / Email / Identifier"
                fullWidth
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField
                    label="Password / Secret Value"
                    fullWidth
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button variant="outlined" onClick={generateRandomPassword} sx={{ whiteSpace: 'nowrap', height: '56px', borderRadius: 3, fontWeight: 600 }}>
                    Generate ({settings?.passwordLength || 16})
                  </Button>
                </Box>
                {formPassword && (
                  <Box sx={{ px: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Password Strength</Typography>
                      <Typography variant="caption" color={`${strength.color}.main`} sx={{ fontWeight: 700 }}>{strength.label}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={strength.score} color={strength.color} sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                )}
              </Box>
            </>
          )}

          {formCategory === 'Crypto' && (
            <Box sx={{ p: 2.5, border: 1, borderColor: 'primary.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700 }}>🪙 Crypto Wallet Template</Typography>
                <IconButton size="small" onClick={() => setShowSeed(!showSeed)}>
                  {showSeed ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </Box>
              <TextField
                label="BIP39 Recovery Seed Phrase (12 or 24 words)"
                multiline
                rows={3}
                fullWidth
                type={showSeed ? 'text' : 'password'}
                value={templateData.seedPhrase || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, seedPhrase: e.target.value }))}
                placeholder="word1 word2 word3 ..."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Derivation Path"
                fullWidth
                value={templateData.derivationPath || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, derivationPath: e.target.value }))}
                placeholder="m/44'/60'/0'/0/0"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Box>
          )}

          {formCategory === 'SSH' && (
            <Box sx={{ p: 2.5, border: 1, borderColor: 'primary.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700 }}>🖥️ Server SSH Key Template</Typography>
                <IconButton size="small" onClick={() => setShowKey(!showKey)}>
                  {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              </Box>
              <TextField
                label="Host / IP Address"
                fullWidth
                value={templateData.host || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, host: e.target.value }))}
                placeholder="192.168.1.50 or server.com"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="SSH Port"
                fullWidth
                value={templateData.port || '22'}
                onChange={(e) => setTemplateData(prev => ({ ...prev, port: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Private Key (PEM format)"
                multiline
                rows={3}
                fullWidth
                type={showKey ? 'text' : 'password'}
                value={templateData.privateKey || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, privateKey: e.target.value }))}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Key Passphrase (Optional)"
                type={showPassphrase ? 'text' : 'password'}
                fullWidth
                value={templateData.passphrase || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, passphrase: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassphrase(!showPassphrase)} edge="end">
                        {showPassphrase ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {formCategory === 'Wifi' && (
            <Box sx={{ p: 2.5, border: 1, borderColor: 'primary.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700 }}>📶 Wi-Fi Router Template</Typography>
              <TextField
                label="SSID (Network Name)"
                fullWidth
                value={templateData.ssid || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, ssid: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Wi-Fi Password / Key"
                fullWidth
                type={showPassword ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Security Type"
                fullWidth
                value={templateData.securityType || 'WPA2/WPA3'}
                onChange={(e) => setTemplateData(prev => ({ ...prev, securityType: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
            </Box>
          )}

          <TextField
            label="TOTP Secret Key (for 2FA)"
            fullWidth
            type={showTotp ? 'text' : 'password'}
            value={formTotp}
            onChange={(e) => setFormTotp(e.target.value)}
            placeholder="JBSWY3DPEHPK3PXP"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowTotp(!showTotp)} edge="end">
                    {showTotp ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>📎 Encrypted File Attachment</Typography>
            {formAttachment ? (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {formAttachment.name} ({(formAttachment.size / 1024).toFixed(1)} KB)
                </Typography>
                <Button size="small" color="error" onClick={() => setFormAttachment(null)} sx={{ textTransform: 'none' }}>Remove</Button>
              </Box>
            ) : (
              <Button variant="outlined" component="label" size="small" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                Attach File (Max 5MB)
                <input type="file" hidden onChange={handleFileUpload} />
              </Button>
            )}
          </Box>

          <TextField
            label="Notes (Optional)"
            multiline
            rows={2}
            fullWidth
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Item</Button>
      </DialogActions>
    </Dialog>
  );
}
