import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, TextField } from '@mui/material';

export default function ExportModal({ open, onClose, vaultItems, onImport }) {
  const [importJson, setImportJson] = useState('');

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vaultItems, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ciphervault_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJson);
      if (Array.isArray(parsed)) {
        onImport(parsed);
        setImportJson('');
        onClose();
      } else {
        alert('Invalid backup format.');
      }
    } catch (err) {
      alert('Failed to parse JSON.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Export & Import Vault</DialogTitle>
      <DialogContent sx={{ overflowY: 'visible', display: 'flex', flexDirection: 'column', gap: 3, pt: '8px !important' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Export Backup
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Download an encrypted JSON backup file of all your vault items.
          </Typography>
          <Button variant="outlined" onClick={handleExport} sx={{ textTransform: 'none', borderRadius: 2 }}>
            Download Backup JSON
          </Button>
        </Box>

        <Box component="form" onSubmit={handleImportSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Import Backup
          </Typography>
          <TextField
            label="Paste backup JSON data"
            multiline
            rows={4}
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
          />
          <Button type="submit" variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
            Import Items
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
