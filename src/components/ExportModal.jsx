import { exportTwoFas, exportBitwarden } from '../utils/migration';
import { resolveAccounts } from '../utils/accounts';
import { vaultStorage } from '../utils/storage';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, 
  Box, FormControl, InputLabel, Select, MenuItem, Alert, FormControlLabel, Switch, TextField
} from '@mui/material';
import { CryptoEngine } from '../utils/crypto';

export default function ExportModal({ open, onClose, profileName, vaultItems = [] }) {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [exportFormat, setExportFormat] = useState('encrypted'); // 'encrypted' | 'share' | 'bitwarden' | '2fas' | 'csv'
  const [protectExport, setProtectExport] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [confirmExportPassword, setConfirmExportPassword] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [shareExpiryDays, setShareExpiryDays] = useState(7);

  const handleClose = () => {
    setExportPassword('');
    setConfirmExportPassword('');
    setProtectExport(false);
    setExportError('');
    setExporting(false);
    onClose();
  };

  const downloadFile = (content, filename, mimeType) => {
    if (!active.current) return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    if (exportFormat === 'encrypted' && !filename.includes('previous')) localStorage.setItem('ciphervault_last_backup_' + profileName, new Date().toISOString());
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleClose();
  };

  const handleExport = async () => {
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Native Encrypted Backup
    if (exportFormat === 'encrypted') {
      const record = vaultStorage.get(profileName);
      const backupData = { format: 'ciphervault-backup', version: 1, profile: profileName, salt: record.salt, vault: record.vault, hint: record.hint || '', exportedAt: new Date().toISOString() };
      if (protectExport) {
        if (exportPassword.length < 8) { setExportError('Export password must be at least 8 characters.'); return; }
        if (exportPassword !== confirmExportPassword) { setExportError('Export passwords do not match.'); return; }
        setExportError('');
        setExporting(true);
        try {
          const passwordSalt = await CryptoEngine.generateSalt();
          const exportKey = await CryptoEngine.deriveMasterKey(exportPassword, passwordSalt);
          const protectedPayload = await CryptoEngine.encryptPayload(exportKey, JSON.stringify(backupData));
          downloadFile(JSON.stringify({ format: 'ciphervault-protected-export', version: 1, kdf: { salt: passwordSalt, iterations: 600000 }, payload: protectedPayload }, null, 2), `ciphervault-${profileName}-password-protected-${dateStr}.json`, 'application/json');
        } catch (error) {
          setExporting(false);
          setExportError(`Could not prepare export: ${error.message}`);
        }
        return;
      }
      downloadFile(
        JSON.stringify(backupData, null, 2), 
        `ciphervault-${profileName}-encrypted-${dateStr}.json`, 
        'application/json'
      );
      return;
    }

    if (exportFormat === 'share') {
      if (exportPassword.length < 8) { setExportError('Share password must be at least 8 characters.'); return; }
      if (exportPassword !== confirmExportPassword) { setExportError('Share passwords do not match.'); return; }
      setExporting(true);
      try {
        const record = vaultStorage.get(profileName);
        const passwordSalt = await CryptoEngine.generateSalt();
        const exportKey = await CryptoEngine.deriveMasterKey(exportPassword, passwordSalt);
        const expiresAt = new Date(Date.now() + Number(shareExpiryDays) * 86400000).toISOString();
        const payload = { format: 'ciphervault-backup', version: 1, profile: profileName, salt: record.salt, vault: record.vault, hint: record.hint || '', exportedAt: new Date().toISOString(), expiresAt };
        const share = { format: 'ciphervault-expiring-share', version: 1, expiresAt, kdf: { salt: passwordSalt, iterations: 600000 }, payload: await CryptoEngine.encryptPayload(exportKey, JSON.stringify(payload)) };
        downloadFile(JSON.stringify(share, null, 2), `ciphervault-${profileName}-expiring-share-${dateStr}.json`, 'application/json');
      } catch (error) { setExporting(false); setExportError(`Could not prepare share: ${error.message}`); }
      return;
    }

    // 2. Bitwarden JSON Format
    if (exportFormat === 'bitwarden') {
      let bwData;
      try { bwData = exportBitwarden(vaultItems); } catch (error) { setExportError(error.message); return; }

      downloadFile(
        JSON.stringify(bwData, null, 2), 
        `bitwarden-export-${profileName}-${dateStr}.json`, 
        'application/json'
      );
      return;
    }

    // 3. Official 2FAS Backup Format
    if (exportFormat === '2fas') {
      const twoFasData = exportTwoFas(vaultItems);

      downloadFile(
        JSON.stringify(twoFasData, null, 2), 
        `2fas-backup-${profileName}-${dateStr}.2fas`, 
        'application/json'
      );
      return;
    }

    // 4. Standard Plaintext CSV Format
    if (exportFormat === 'csv') {
      const escapeCsv = (val) => {
        const s = (val || '').toString().replace(/"/g, '""');
        return `"${s}"`;
      };

      const headers = ['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'];
      const rows = resolveAccounts(vaultItems).map(item => [
        escapeCsv(''),
        escapeCsv(item.favorite ? '1' : '0'),
        escapeCsv(item.category),
        escapeCsv(item.name),
        escapeCsv(item.notes),
        escapeCsv(''),
        escapeCsv('0'),
        escapeCsv(item.website),
        escapeCsv(item.username),
        escapeCsv(item.password),
        escapeCsv(item.totpSecret)
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      downloadFile(
        csvContent, 
        `ciphervault-${profileName}-export-${dateStr}.csv`, 
        'text/csv'
      );
    }
  };

  const downloadPrevious = () => {
    const previous = vaultStorage.get(profileName)?.previous;
    if (!previous?.vault) { setExportError('No previous version is available.'); return; }
    downloadFile(JSON.stringify({ format: 'ciphervault-backup', version: 1, profile: profileName, salt: previous.salt, vault: previous.vault, hint: previous.hint || '' }, null, 2), 'ciphervault-previous-encrypted.json', 'application/json');
  };

  const downloadSafetyBackup = () => {
    const raw = localStorage.getItem('ciphervault_safety_backup_' + profileName);
    if (!raw) { setExportError('No automatic safety backup is available yet.'); return; }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ciphervault-${profileName}-automatic-safety-backup.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
        📦 Export Vault & 2FA Tokens [{profileName}]
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Choose your desired export destination format. CipherVault provides full two-way compatibility with Bitwarden and 2FAS.
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Export Target Format</InputLabel>
            <Select
              value={exportFormat}
              label="Export Target Format"
              onChange={(e) => setExportFormat(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="encrypted">🔒 Encrypted CipherVault Container (AES-256-GCM)</MenuItem>
              <MenuItem value="share">Expiring encrypted share package</MenuItem>
              <MenuItem value="bitwarden">🛡️ Bitwarden JSON Format (Importable to Bitwarden)</MenuItem>
              <MenuItem value="2fas">📲 2FAS Authenticator Backup (.2fas / JSON)</MenuItem>
              <MenuItem value="csv">📄 Standard Plaintext CSV Table</MenuItem>
            </Select>
          </FormControl>

          {exportFormat !== 'encrypted' && exportFormat !== 'share' ? (
            <Alert severity="warning">
              <strong>Plaintext Warning:</strong> This export format creates a decrypted file. Keep this file stored securely or delete it immediately after migrating to another password manager.
            </Alert>
          ) : exportFormat === 'share' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}><Alert severity="warning">This package is encrypted and expires automatically. It cannot be revoked after download.</Alert><TextField select size="small" label="Expires after" value={shareExpiryDays} onChange={e => setShareExpiryDays(e.target.value)}><MenuItem value={1}>1 day</MenuItem><MenuItem value={7}>7 days</MenuItem><MenuItem value={30}>30 days</MenuItem></TextField><Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}><TextField fullWidth size="small" type="password" label="Share password" value={exportPassword} onChange={e => setExportPassword(e.target.value)} /><TextField fullWidth size="small" type="password" label="Confirm share password" value={confirmExportPassword} onChange={e => setConfirmExportPassword(e.target.value)} /></Box></Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Alert severity="info"><strong>Zero-Knowledge Backup:</strong> The file is encrypted with your vault master key. You can add a separate export password for safer sharing or cloud storage.</Alert>
              <FormControlLabel control={<Switch checked={protectExport} onChange={(e) => { setProtectExport(e.target.checked); setExportError(''); }} />} label="Add a separate password to protect this export" />
              {protectExport && <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField fullWidth size="small" type="password" label="Export password" value={exportPassword} onChange={(e) => setExportPassword(e.target.value)} />
                <TextField fullWidth size="small" type="password" label="Confirm export password" value={confirmExportPassword} onChange={(e) => setConfirmExportPassword(e.target.value)} />
              </Box>}
            </Box>
          )}

          {exportError && <Alert severity="error">{exportError}</Alert>}
          <Typography variant="caption" color="text.secondary">
            Ready to export {vaultItems.length} vault items (including {vaultItems.filter(i => i.totpSecret).length} 2FA accounts).
          </Typography>
<Alert severity="info">Keep an encrypted backup and its original master password. There is no recovery code or password reset. A separate export password adds protection but does not replace the master password.</Alert>
          <Button variant="outlined" onClick={downloadPrevious} disabled={!vaultStorage.get(profileName)?.previous?.vault}>Download previous encrypted version</Button>
          <Button variant="outlined" onClick={downloadSafetyBackup} disabled={!localStorage.getItem('ciphervault_safety_backup_' + profileName)}>Download automatic safety backup</Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={handleClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleExport} disabled={exporting} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>
          {exporting ? 'Preparing export…' : 'Download Export File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
