import React, { useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
export default function DeviceUnlockSettings({ enabled, activeKey, onEnable, onDisable }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async action => { setBusy(true); setMessage(''); try { await action(); setMessage('Device unlock settings saved.'); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };
  return <Box sx={{ display: 'grid', gap: 1 }}><Typography variant="subtitle2">Device-backed unlock</Typography>
    <Typography variant="body2" color="text.secondary">Use a compatible passkey or security key to decrypt this vault on this browser. Your device may request a fingerprint, face scan, or device PIN. Keep your master password for backups and other devices.</Typography>
    <Button variant="outlined" disabled={busy || !activeKey} onClick={() => run(enabled ? onDisable : onEnable)}>{busy ? 'Waiting for device…' : enabled ? 'Remove device unlock' : 'Set up device unlock'}</Button>
    {message && <Alert severity="info">{message}</Alert>}
  </Box>;
}
