import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, 
  Box, FormControl, InputLabel, Select, MenuItem, Alert 
} from '@mui/material';

export default function ExportModal({ open, onClose, profileName, vaultItems = [] }) {
  const [exportFormat, setExportFormat] = useState('encrypted'); // 'encrypted' | 'bitwarden' | '2fas' | 'csv'
  const pfx = profileName === 'Default' ? '' : `_${profileName}`;

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const handleExport = () => {
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Native Encrypted Backup
    if (exportFormat === 'encrypted') {
      const salt = localStorage.getItem(`ciphervault_salt${pfx}`);
      const vault = localStorage.getItem(`ciphervault_vault${pfx}`);
      const hint = localStorage.getItem(`ciphervault_hint${pfx}`);
      const recovery = localStorage.getItem(`ciphervault_recovery${pfx}`);

      const backupData = {
        profile: profileName,
        salt,
        vault: JSON.parse(vault || '{}'),
        hint,
        recovery,
        exportedAt: new Date().toISOString()
      };
      downloadFile(
        JSON.stringify(backupData, null, 2), 
        `ciphervault-${profileName}-encrypted-${dateStr}.json`, 
        'application/json'
      );
      return;
    }

    // 2. Bitwarden JSON Format
    if (exportFormat === 'bitwarden') {
      const bwItems = vaultItems.map(item => {
        let bwType = 1; // Login
        if (item.category === 'Notes') bwType = 2;
        else if (item.category === 'Cards') bwType = 3;

        return {
          id: item.id,
          organizationId: null,
          folderId: null,
          type: bwType,
          name: item.name || 'Untitled',
          notes: item.notes || '',
          favorite: Boolean(item.favorite),
          login: {
            uris: item.website ? [{ match: null, uri: item.website }] : [],
            username: item.username || '',
            password: item.password || '',
            totp: item.totpSecret ? `otpauth://totp/${encodeURIComponent(item.name)}?secret=${item.totpSecret}` : null
          }
        };
      });

      const bwData = {
        encrypted: false,
        folders: [],
        items: bwItems
      };

      downloadFile(
        JSON.stringify(bwData, null, 2), 
        `bitwarden-export-${profileName}-${dateStr}.json`, 
        'application/json'
      );
      return;
    }

    // 3. Official 2FAS Backup Format
    if (exportFormat === '2fas') {
      const services = vaultItems
        .filter(item => item.totpSecret)
        .map(item => ({
          name: item.name,
          secret: item.totpSecret,
          otp: {
            tokenType: 'TOTP',
            digits: 6,
            period: 30,
            algorithm: 'SHA1'
          },
          updatedAt: Date.now()
        }));

      const twoFasData = {
        version: 4,
        services: services
      };

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
      const rows = vaultItems.map(item => [
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
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
              <MenuItem value="bitwarden">🛡️ Bitwarden JSON Format (Importable to Bitwarden)</MenuItem>
              <MenuItem value="2fas">📲 2FAS Authenticator Backup (.2fas / JSON)</MenuItem>
              <MenuItem value="csv">📄 Standard Plaintext CSV Table</MenuItem>
            </Select>
          </FormControl>

          {exportFormat !== 'encrypted' ? (
            <Alert severity="warning">
              <strong>Plaintext Warning:</strong> This export format creates a decrypted file. Keep this file stored securely or delete it immediately after migrating to another password manager.
            </Alert>
          ) : (
            <Alert severity="info">
              <strong>Zero-Knowledge Backup:</strong> The file is fully encrypted with your master key (AES-256-GCM) and can be safely saved on cloud drives or offline storage.
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary">
            Ready to export {vaultItems.length} vault items (including {vaultItems.filter(i => i.totpSecret).length} 2FA accounts).
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleExport} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3 }}>
          Download Export File
        </Button>
      </DialogActions>
    </Dialog>
  );
}
