import React, { useState, useEffect } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, 
  FormControl, InputLabel, Select, MenuItem, Typography, IconButton, InputAdornment, 
  LinearProgress, Chip, ButtonGroup, CircularProgress, Stepper, Step, StepLabel, Alert
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LanguageIcon from '@mui/icons-material/Language';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LabelIcon from '@mui/icons-material/Label';
import KeyIcon from '@mui/icons-material/Key';
import { CryptoEngine } from '../utils/crypto';
import { TOTP } from '../utils/totp';

const DICEWARE_WORDLIST = [
  'galaxy', 'falcon', 'orbit', 'matrix', 'crypto', 'shield', 'quantum', 'shadow', 
  'vector', 'cipher', 'ember', 'phoenix', 'aurora', 'nexus', 'beacon', 'timber', 
  'summit', 'glacier', 'canyon', 'planet', 'radar', 'breeze', 'castle', 'dragon', 
  'forest', 'harbor', 'island', 'jungle', 'knight', 'lagoon', 'meadow', 'nebula', 
  'oasis', 'palace', 'quest', 'river', 'safari', 'temple', 'valley', 'wizard', 
  'zenith', 'comet', 'horizon', 'meteor', 'pulsar', 'vortex', 'anchor', 'voyage'
];

const PRESET_TAGS = ['Work', 'Personal', 'Finance', 'Crypto', 'Social', 'Shopping', 'Server'];

export default function ItemModal({ open, onClose, onSave, editingItem, activeKey, settings }) {
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formCategory, setFormCategory] = useState('Logins');
  const [formWebsite, setFormWebsite] = useState('');
  const [formFavorite, setFormFavorite] = useState(false);
  const [formTags, setFormTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [customFields, setCustomFields] = useState([]);
  const [formNotes, setFormNotes] = useState('');
  const [formTotp, setFormTotp] = useState('');
  const [formAttachment, setFormAttachment] = useState(null);

  const [templateData, setTemplateData] = useState({});

  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Real-time inline HIBP breach check state
  const [inlinePwnedCount, setInlinePwnedCount] = useState(null);
  const [checkingInlinePwned, setCheckingInlinePwned] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState('');
  const [itemStep, setItemStep] = useState(0);
  const [formError, setFormError] = useState('');

  const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

  useEffect(() => {
    if (editingItem) {
      setFormName(editingItem.name || '');
      setFormUsername(editingItem.username || '');
      setFormPassword(editingItem.password || '');
      setFormCategory(editingItem.category || 'Logins');
      setFormWebsite(editingItem.website || '');
      setFormFavorite(Boolean(editingItem.favorite));
      setFormTags(Array.isArray(editingItem.tags) ? editingItem.tags : []);
      setCustomFields(Array.isArray(editingItem.customFields) ? editingItem.customFields : []);
      setFormNotes(editingItem.notes || '');
      setFormTotp(editingItem.totpSecret || '');
      setFormAttachment(editingItem.attachment || null);
      setTemplateData(editingItem.templateData || {});
    } else {
      setFormName('');
      setFormUsername('');
      setFormPassword('');
      setFormCategory('Logins');
      setFormWebsite('');
      setFormFavorite(false);
      setFormTags([]);
      setCustomFields([]);
      setFormNotes('');
      setFormTotp('');
      setFormAttachment(null);
      setTemplateData({});
    }
    setTagInput('');
    setShowPassword(false);
    setShowTotp(false);
    setShowSeed(false);
    setShowKey(false);
    setShowPassphrase(false);
    setInlinePwnedCount(null);
    setPasskeyStatus('');
    setItemStep(0);
    setFormError('');
  }, [editingItem, open]);

  const registerPasskey = async () => {
    if (!window.PublicKeyCredential) {
      setPasskeyStatus('This browser does not support WebAuthn.');
      return;
    }
    try {
      let websiteHost = window.location.hostname;
      if (formWebsite) {
        try { websiteHost = new URL(formWebsite.includes('://') ? formWebsite : `https://${formWebsite}`).hostname; } catch (e) {}
      }
      const rpId = templateData.rpId || websiteHost;
      const credential = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'CipherVault', id: rpId },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: formUsername || 'vault-user', displayName: formUsername || formName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }, { type: 'public-key', alg: -8 }],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
        timeout: 60000,
        attestation: 'none'
      }});
      if (!credential) throw new Error('No credential was returned.');
      const response = credential.response;
      setTemplateData(prev => ({ ...prev, rpId, credentialId: toBase64(credential.rawId), publicKey: toBase64(response.attestationObject || response.clientDataJSON), algorithm: 'WebAuthn (ES256 / RS256 / Ed25519)' }));
      setPasskeyStatus('Passkey registered in this browser. Save the item to keep its metadata.');
    } catch (error) {
      setPasskeyStatus(error.name === 'NotAllowedError' ? 'Passkey registration was cancelled.' : `Passkey registration failed: ${error.message}`);
    }
  };

  // Real-time inline breach check with debouncing
  useEffect(() => {
    if (!formPassword || formPassword.length < 6 || formCategory === 'Crypto' || formCategory === 'SSH' || formCategory === 'Passkeys') {
      setInlinePwnedCount(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingInlinePwned(true);
      try {
        const count = await CryptoEngine.checkPwnedPassword(formPassword);
        setInlinePwnedCount(count);
      } catch (e) {
        setInlinePwnedCount(null);
      } finally {
        setCheckingInlinePwned(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formPassword, formCategory]);

  const handleCategoryChange = (newCat) => {
    setFormCategory(newCat);
    if (newCat === 'Crypto') {
      setTemplateData({ seedPhrase: '', derivationPath: "m/44'/60'/0'/0/0" });
    } else if (newCat === 'SSH') {
      setTemplateData({ host: '', port: '22', privateKey: '', passphrase: '' });
    } else if (newCat === 'Wifi') {
      setTemplateData({ ssid: '', securityType: 'WPA2/WPA3', hidden: 'No' });
    } else if (newCat === 'Passkeys') {
      setTemplateData({ rpId: '', credentialId: '', userHandle: '', algorithm: 'ES256 (WebAuthn / FIDO2)' });
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

  const generatePassphrase = () => {
    const wordCount = 4;
    const array = new Uint32Array(wordCount);
    crypto.getRandomValues(array);
    const words = [];
    for (let i = 0; i < wordCount; i++) {
      const idx = array[i] % DICEWARE_WORDLIST.length;
      words.push(DICEWARE_WORDLIST[idx]);
    }
    const numSuffix = Math.floor(Math.random() * 90 + 10);
    setFormPassword(words.join('-') + '-' + numSuffix);
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'error' };
    let score = 0;
    if (pwd.length >= 8) score += 20;
    if (pwd.length >= 14) score += 30;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;

    if (score <= 25) return { score, label: 'Weak', color: 'error' };
    if (score <= 50) return { score, label: 'Fair', color: 'warning' };
    if (score <= 75) return { score, label: 'Good', color: 'info' };
    return { score: 100, label: 'Strong', color: 'success' };
  };

  const strength = getPasswordStrength(formPassword);

  const handleToggleTag = (tag) => {
    if (formTags.includes(tag)) {
      setFormTags(formTags.filter(t => t !== tag));
    } else {
      setFormTags([...formTags, tag]);
    }
  };

  const handleAddCustomTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const cleanTag = tagInput.trim().replace(/^#/, '');
      if (!formTags.includes(cleanTag)) {
        setFormTags([...formTags, cleanTag]);
      }
      setTagInput('');
    }
  };

  const handleAddCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), name: '', value: '', isSecret: false }
    ]);
  };

  const handleUpdateCustomField = (id, field, val) => {
    setCustomFields(customFields.map(cf => cf.id === id ? { ...cf, [field]: val } : cf));
  };

  const handleRemoveCustomField = (id) => {
    setCustomFields(customFields.filter(cf => cf.id !== id));
  };

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
      setFormError('Failed to encrypt file attachment: ' + err.message);
    }
  };

  const handleTotpChange = (e) => {
    const val = e.target.value.trim();
    if (val.startsWith('otpauth://')) {
      const parsed = TOTP.parseOtpAuthUrl(val);
      if (parsed.secret) {
        setFormTotp(parsed.secret);
        if (!formName && parsed.issuer) setFormName(parsed.issuer);
        if (!formUsername && parsed.account) setFormUsername(parsed.account);
        return;
      }
    }
    setFormTotp(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Enter an item name before saving.');
      setItemStep(0);
      return;
    }
    setFormError('');
    if (checkingInlinePwned) {
      setFormError('Please wait for the password breach check to finish before saving.');
      return;
    }
    if (inlinePwnedCount > 0) {
      setFormError('This password appears in public data breaches. Please choose a different password before saving.');
      return;
    }

    const existingHistory = editingItem?.passwordHistory || [];
    let updatedHistory = [...existingHistory];

    const passwordChanged = editingItem && editingItem.password && editingItem.password !== formPassword;
    if (passwordChanged) {
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
      website: formWebsite,
      favorite: formFavorite,
      tags: formTags,
      customFields: customFields.filter(cf => cf.name.trim() || cf.value.trim()),
      notes: formNotes,
      totpSecret: formTotp,
      attachment: formAttachment,
      templateData: templateData,
      passwordHistory: updatedHistory,
      passwordUpdatedAt: passwordChanged || !editingItem ? new Date().toISOString() : (editingItem.passwordUpdatedAt || new Date().toISOString()),
      createdAt: editingItem?.createdAt || new Date().toISOString()
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: { xs: 0, sm: 4 }, p: 1, m: { xs: 0, sm: 2 }, maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' } } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{editingItem ? 'Edit Vault Item' : 'New Vault Item & Template'}</span>
        <IconButton 
          onClick={() => setFormFavorite(!formFavorite)}
          color={formFavorite ? 'warning' : 'default'}
          title={formFavorite ? 'Pinned Favorite' : 'Mark as Favorite'}
        >
          {formFavorite ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <Stepper activeStep={itemStep} alternativeLabel sx={{ mb: 1 }}>
            <Step><StepLabel>Basics</StepLabel></Step>
            <Step><StepLabel>Details</StepLabel></Step>
          </Stepper>
          {formError && <Alert severity="error">{formError}</Alert>}
          <Box sx={{ display: itemStep === 0 ? 'flex' : 'none', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Item Name"
            required
            fullWidth
            value={formName}
            onChange={(e) => { setFormName(e.target.value); if (e.target.value.trim()) setFormError(''); }}
            error={Boolean(formError && !formName.trim())}
            helperText={formError && !formName.trim() ? formError : 'Use a recognizable name, such as GitHub or Personal email.'}
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
              <MenuItem value="Passkeys">🔑 Passkey (FIDO2 / WebAuthn)</MenuItem>
              <MenuItem value="Cards">💳 Credit / Debit Card</MenuItem>
              <MenuItem value="Notes">📝 Secure Note</MenuItem>
              <MenuItem value="ApiKeys">🔑 API Key / Token</MenuItem>
              <MenuItem value="Crypto">🪙 Crypto Wallet (Seed Phrase)</MenuItem>
              <MenuItem value="SSH">🖥️ Server SSH Key Config</MenuItem>
              <MenuItem value="Wifi">📶 Wi-Fi Router Credentials</MenuItem>
            </Select>
          </FormControl>

          {/* Tags / Groups (2FAS feature) */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                <LabelIcon fontSize="inherit" /> Tags & Groups
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center' }}>
              {PRESET_TAGS.map(tag => {
                const isSelected = formTags.includes(tag);
                return (
                  <Chip
                    key={tag}
                    label={`#${tag}`}
                    size="small"
                    clickable
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => handleToggleTag(tag)}
                    sx={{ fontWeight: 600, borderRadius: 1.5 }}
                  />
                );
              })}
              {formTags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
                <Chip
                  key={tag}
                  label={`#${tag}`}
                  size="small"
                  color="primary"
                  onDelete={() => handleToggleTag(tag)}
                  sx={{ fontWeight: 600, borderRadius: 1.5 }}
                />
              ))}
            </Box>
            <TextField
              size="small"
              placeholder="Add custom tag (Press Enter)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddCustomTag}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>

          {/* Website / Login URI (Bitwarden feature) */}
          </Box>
          <Box sx={{ display: itemStep === 1 ? 'flex' : 'none', flexDirection: 'column', gap: 2.5 }}>
          {(formCategory === 'Logins' || formCategory === 'Passkeys') && (
            <TextField
              label="Website / Service URL (e.g. https://github.com)"
              fullWidth
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LanguageIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
            />
          )}

          {/* Passkey Specific Template View */}
          {formCategory === 'Passkeys' && (
            <Box sx={{ p: 2.5, border: 1, borderColor: 'primary.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <KeyIcon fontSize="small" /> Passkey (FIDO2 / WebAuthn) Template
              </Typography>
              <TextField
                label="Relying Party ID (Domain)"
                fullWidth
                value={templateData.rpId || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, rpId: e.target.value }))}
                placeholder="github.com or apple.com"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="User Handle / Username"
                fullWidth
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                placeholder="user@example.com"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Credential ID (Base64)"
                fullWidth
                value={templateData.credentialId || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, credentialId: e.target.value }))}
                placeholder="AQIDBAUGBwgJCgsMDQ4PEBES..."
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Key Algorithm"
                fullWidth
                value={templateData.algorithm || 'ES256 (WebAuthn / FIDO2)'}
                onChange={(e) => setTemplateData(prev => ({ ...prev, algorithm: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <TextField
                label="Public Key (Base64 / COSE)"
                fullWidth
                multiline
                minRows={2}
                value={templateData.publicKey || ''}
                onChange={(e) => setTemplateData(prev => ({ ...prev, publicKey: e.target.value }))}
                placeholder="Base64-encoded credential public key"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
              />
              <Button variant="contained" onClick={registerPasskey} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff' }}>Register passkey on this device</Button>
              {passkeyStatus && <Typography variant="caption" color={passkeyStatus.includes('failed') || passkeyStatus.includes('cancelled') || passkeyStatus.includes('does not') ? 'error.main' : 'success.main'}>{passkeyStatus}</Typography>}
            </Box>
          )}

          {formCategory !== 'Crypto' && formCategory !== 'SSH' && formCategory !== 'Wifi' && formCategory !== 'Passkeys' && (
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
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <ButtonGroup variant="outlined" size="small" sx={{ height: '56px', borderRadius: 3, overflow: 'hidden' }}>
                    <Button 
                      onClick={generateRandomPassword} 
                      sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}
                      title="Generate random characters"
                    >
                      🔀 Random
                    </Button>
                    <Button 
                      onClick={generatePassphrase} 
                      sx={{ textTransform: 'none', fontWeight: 600, px: 1.5 }}
                      title="Generate memorable Diceware passphrase"
                    >
                      💬 Passphrase
                    </Button>
                  </ButtonGroup>
                </Box>

                {formPassword && (
                  <Box sx={{ px: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">Password Strength</Typography>
                      <Typography variant="caption" color={`${strength.color}.main`} sx={{ fontWeight: 700 }}>{strength.label}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={strength.score} color={strength.color} sx={{ height: 6, borderRadius: 3 }} />

                    {/* Real-Time Inline Breach Check Status (HIBP) */}
                    {checkingInlinePwned && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.8 }}>
                        <CircularProgress size={12} />
                        <Typography variant="caption" color="text.secondary">
                          Checking HaveIBeenPwned breach database...
                        </Typography>
                      </Box>
                    )}
                    {!checkingInlinePwned && inlinePwnedCount !== null && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: 'block', 
                          mt: 0.8, 
                          fontWeight: 700, 
                          color: inlinePwnedCount > 0 ? 'error.main' : 'success.main' 
                        }}
                      >
                        {inlinePwnedCount > 0 
                          ? `🚨 Warning: Found in ${inlinePwnedCount.toLocaleString()} data breaches! Choose another password.` 
                          : '✨ Zero known breaches (Checked against HaveIBeenPwned)'}
                      </Typography>
                    )}
                    {!checkingInlinePwned && inlinePwnedCount === null && formPassword.length >= 6 && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: .8, fontWeight: 600 }}>
                        Unable to verify breach status right now. Saving is allowed, but verify this password when online.
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            </>
          )}

          {formCategory === 'Crypto' && (
            <Box sx={{ p: 2.5, border: 1, borderColor: 'primary.main', borderRadius: 3, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" color="primary.main" sx={{ fontWeight: 700 }}>🪙 Crypto Wallet Template</Typography>
                <IconButton size="small" onClick={() => setShowSeed(!showSeed)} aria-label={showSeed ? 'Hide recovery seed' : 'Show recovery seed'}>
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
                <IconButton size="small" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Hide private key' : 'Show private key'}>
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
            label="TOTP Secret Key or otpauth:// link (for 2FA)"
            fullWidth
            type={showTotp ? 'text' : 'password'}
            value={formTotp}
            onChange={handleTotpChange}
            placeholder="JBSWY3DPEHPK3PXP or otpauth://totp/..."
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

          {/* Custom Fields & Backup Codes (Bitwarden Feature) */}
          <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                🧩 Custom Fields & Backup Codes ({customFields.length})
              </Typography>
              <Button 
                size="small" 
                variant="outlined" 
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleAddCustomField}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
              >
                Add Field
              </Button>
            </Box>

            {customFields.map((cf) => (
              <Box key={cf.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label="Field Name"
                  placeholder="Security Question, Recovery Code, etc."
                  value={cf.name}
                  onChange={(e) => handleUpdateCustomField(cf.id, 'name', e.target.value)}
                  sx={{ width: '40%', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField
                  size="small"
                  label="Value"
                  type={cf.isSecret ? 'password' : 'text'}
                  value={cf.value}
                  onChange={(e) => handleUpdateCustomField(cf.id, 'value', e.target.value)}
                  sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton 
                          size="small" 
                          onClick={() => handleUpdateCustomField(cf.id, 'isSecret', !cf.isSecret)}
                          title={cf.isSecret ? 'Reveal' : 'Mask as Secret'}
                        >
                          {cf.isSecret ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <IconButton size="small" color="error" onClick={() => handleRemoveCustomField(cf.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            {customFields.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Add extra fields for security questions, backup recovery codes, or API secrets.
              </Typography>
            )}
          </Box>

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
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, position: 'sticky', bottom: 0, bgcolor: 'background.paper', zIndex: 1, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={itemStep === 0 ? onClose : () => setItemStep(0)} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>{itemStep === 0 ? 'Cancel' : 'Back'}</Button>
        {itemStep === 0 ? (
          <Button onClick={() => { if (!formName.trim()) { setFormError('Enter an item name to continue.'); return; } setFormError(''); setItemStep(1); }} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Continue</Button>
        ) : (
          <Button onClick={handleSubmit} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>Save Item</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
