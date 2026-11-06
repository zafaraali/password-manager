import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, 
  Box, FormControl, InputLabel, Select, MenuItem, Alert 
} from '@mui/material';
import { QRCodeEncoder } from '../utils/qrcode';

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

  const printEmergencySheet = () => {
    const recovery = localStorage.getItem(`ciphervault_recovery${pfx}`) || 'Recovery code unavailable — export an encrypted backup first.';
    const created = localStorage.getItem(`ciphervault_created${pfx}`) || new Date().toISOString();
    const qrPayload = `ciphervault://recover?profile=${encodeURIComponent(profileName)}&code=${encodeURIComponent(recovery)}&encryptedBackup=${Boolean(localStorage.getItem(`ciphervault_vault${pfx}`))}`;
    const qr = QRCodeEncoder.renderSvg(qrPayload, { size: 180, margin: 3 });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>CipherVault Emergency Recovery Sheet</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:48px auto;color:#111}h1{font-size:28px}.card{border:2px solid #111;border-radius:14px;padding:24px;margin:24px 0}.code{font:700 24px monospace;letter-spacing:3px;word-break:break-all;background:#eee;padding:18px}.grid{display:flex;gap:30px;align-items:center}small{color:#555}@media print{button{display:none}}</style></head><body><h1>CipherVault Emergency Recovery Sheet</h1><p><b>Profile:</b> ${profileName}<br><b>Created:</b> ${new Date(created).toLocaleDateString()}</p><div class="card"><h2>Emergency recovery code</h2><div class="code">${recovery}</div><p><small>Keep this sheet offline. Anyone with this code may be able to recover the vault.</small></p></div><div class="card grid"><div><h2>Offline recovery marker</h2><p>Store this QR with your encrypted vault backup. It contains recovery metadata only.</p></div>${qr}</div><div class="card"><h2>Safe storage guidelines</h2><ul><li>Print only on a trusted printer.</li><li>Store in a sealed envelope inside a safe or deposit box.</li><li>Never photograph or upload this sheet.</li><li>Destroy old sheets when rotating your recovery code.</li></ul></div><button onclick="print()">Print sheet</button></body></html>`;
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ciphervault-${profileName}-emergency-recovery.html`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return;
    }
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }, { once: true });
    return;
    // Keep the window handle writable so the generated recovery sheet can be populated before printing.
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>CipherVault Emergency Recovery Sheet</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:48px auto;color:#111}h1{font-size:28px}.card{border:2px solid #111;border-radius:14px;padding:24px;margin:24px 0}.code{font:700 24px monospace;letter-spacing:3px;word-break:break-all;background:#eee;padding:18px}.grid{display:flex;gap:30px;align-items:center}small{color:#555}@media print{button{display:none}}</style></head><body><h1>CipherVault Emergency Recovery Sheet</h1><p><b>Profile:</b> ${profileName}<br><b>Created:</b> ${new Date(created).toLocaleDateString()}</p><div class="card"><h2>Emergency recovery code</h2><div class="code">${recovery}</div><p><small>Keep this sheet offline. Anyone with this code may be able to recover the vault.</small></p></div><div class="card grid"><div><h2>Offline recovery marker</h2><p>Store this QR with your encrypted vault backup. It contains recovery metadata only.</p></div>${qr}</div><div class="card"><h2>Safe storage guidelines</h2><ul><li>Print only on a trusted printer.</li><li>Store in a sealed envelope inside a safe or deposit box.</li><li>Never photograph or upload this sheet.</li><li>Destroy old sheets when rotating your recovery code.</li></ul></div><button onclick="print()">Print sheet</button></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
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
          <Button variant="outlined" onClick={printEmergencySheet} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, alignSelf: 'flex-start' }}>🖨️ Print Emergency Recovery Sheet</Button>
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
