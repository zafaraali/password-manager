import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItem, Stack, TextField, Typography } from '@mui/material';
import { readRemote, writeRemote, encryptedBackup } from '../utils/sync';
import { CryptoEngine } from '../utils/crypto';
import { validateVault } from '../utils/storage';

function signature(value) { return JSON.stringify(value); }

function compareSets(local = [], remote = [], scope) {
  const localMap = new Map(local.map(item => [item.id, item]));
  const remoteMap = new Map(remote.map(item => [item.id, item]));
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
  return [...ids].map(id => {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);
    const conflict = Boolean(localItem && remoteItem && signature(localItem) !== signature(remoteItem));
    return { id, scope, local: localItem, remote: remoteItem, conflict, choice: conflict ? 'local' : remoteItem ? 'remote' : 'local' };
  });
}

function mergeRows(rows, selections) {
  return rows.map(row => {
    if (!row.local) return row.remote;
    if (!row.remote) return row.local;
    return selections[`${row.scope}:${row.id}`] === 'remote' ? row.remote : row.local;
  }).filter(Boolean);
}

export default function SyncModal({ profile, storage, activeKey, onRestore, onApplyMergedPayload, onClose, isActive, onBackupRecorded }) {
  const [url, setUrl] = useState(localStorage.getItem('ciphervault_sync_url') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remote, setRemote] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [selections, setSelections] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [verified, setVerified] = useState(false);
  useEffect(() => { setRemote(null); setComparison(null); setSelections({}); setVerified(false); }, [url, username, password]);

  const rows = useMemo(() => comparison ? [...comparison.items, ...comparison.trash] : [], [comparison]);
  const conflicts = rows.filter(row => row.conflict);
  const run = async action => { setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } };

  const check = async () => {
    const result = await readRemote(url, username, password);
    if (!isActive()) return;
    setRemote(result); setVerified(false); setComparison(null); setSelections({});
    if (result.exists) {
      const record = storage.get(profile);
      if (record.salt === result.backup.salt) {
        try {
          const localPayload = validateVault(JSON.parse(await CryptoEngine.decryptPayload(activeKey, record.vault)));
          const remotePayload = validateVault(JSON.parse(await CryptoEngine.decryptPayload(activeKey, result.backup.vault)));
          const next = { items: compareSets(localPayload.items, remotePayload.items, 'items'), trash: compareSets(localPayload.trash, remotePayload.trash, 'trash') };
          const defaults = Object.fromEntries([...next.items, ...next.trash].filter(row => row.conflict).map(row => [`${row.scope}:${row.id}`, 'local']));
          setComparison(next); setSelections(defaults); setVerified(true);
        } catch { /* A different master password can still be handled through the verified restore flow. */ }
      }
    }
    localStorage.setItem('ciphervault_sync_url', url);
    setMessage(result.exists ? 'Remote encrypted backup found. Matching versions can be merged record by record.' : 'No remote backup exists. Upload to create one.');
  };

  const upload = async () => {
    if (!isActive() || !remote) return;
    const revision = storage.get(profile).revision;
    const record = storage.get(profile);
    await writeRemote(url, encryptedBackup(record, profile), remote.etag, username, password);
    if (!isActive()) return;
    if (storage.get(profile).revision !== revision) setMessage('Uploaded a snapshot, but this vault changed while uploading. Check the remote version and upload again.');
    else { const timestamp = new Date().toISOString(); localStorage.setItem('ciphervault_last_backup_' + profile, timestamp); onBackupRecorded?.(timestamp); setMessage('Encrypted backup uploaded. Check again before another upload.'); }
    setRemote(null); setComparison(null);
  };

  const merge = async () => {
    if (!comparison || !remote || !onApplyMergedPayload) return;
    const merged = { items: mergeRows(comparison.items, selections), trash: mergeRows(comparison.trash, selections) };
    const trashedIds = new Set(merged.trash.map(item => item.id));
    merged.items = merged.items.filter(item => !trashedIds.has(item.id));
    validateVault(merged);
    await onApplyMergedPayload(merged);
    const record = storage.get(profile);
    const encrypted = await CryptoEngine.encryptPayload(activeKey, JSON.stringify(merged));
    await writeRemote(url, encryptedBackup({ ...record, vault: encrypted }, profile), remote.etag, username, password);
    const timestamp = new Date().toISOString();
    localStorage.setItem('ciphervault_last_backup_' + profile, timestamp);
    onBackupRecorded?.(timestamp);
    setMessage('Merged records locally and uploaded the merged encrypted snapshot.');
    setRemote(null); setComparison(null);
  };

  return <Dialog open fullWidth maxWidth="md" onClose={() => !busy && onClose()}><DialogTitle>Device sync & backups</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2 }}>
    <Typography variant="body2">Connect an HTTPS WebDAV file endpoint to transfer encrypted vault snapshots. Credentials remain only while this dialog is open.</Typography>
    <TextField label="HTTPS backup file URL" value={url} onChange={e => setUrl(e.target.value)} />
    <TextField label="Server username (optional)" value={username} onChange={e => setUsername(e.target.value)} />
    <TextField label="Server password / app password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
    <Button disabled={busy || !url} variant="outlined" onClick={() => run(check)}>Check remote version</Button>
    {message && <Alert severity="info">{message}</Alert>}
    {remote?.exists && comparison && <Box sx={{ display: 'grid', gap: 1.5 }}><Alert severity={conflicts.length ? 'warning' : 'success'}>{conflicts.length ? `${conflicts.length} records differ. Choose which version to keep for each conflict.` : 'No conflicting records. The merge will combine additions from both devices.'}</Alert><Stack direction="row" spacing={1}><Chip size="small" label={`${comparison.items.length} vault records`} /><Chip size="small" label={`${comparison.trash.length} trash records`} /><Chip size="small" color="warning" label={`${conflicts.length} conflicts`} /></Stack>{conflicts.length > 0 && <List dense sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>{conflicts.map((row, index) => <React.Fragment key={`${row.scope}:${row.id}`}>{index > 0 && <Divider component="li" />}<ListItem sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" noWrap>{row.local?.name || row.remote?.name || 'Untitled record'}</Typography><Typography variant="caption" color="text.secondary">{row.scope === 'trash' ? 'Trash' : 'Vault'} · choose the version to keep</Typography></Box><Stack direction="row" spacing={.5}><Button size="small" variant={selections[`${row.scope}:${row.id}`] === 'local' ? 'contained' : 'outlined'} onClick={() => setSelections(current => ({ ...current, [`${row.scope}:${row.id}`]: 'local' }))}>Local</Button><Button size="small" variant={selections[`${row.scope}:${row.id}`] === 'remote' ? 'contained' : 'outlined'} onClick={() => setSelections(current => ({ ...current, [`${row.scope}:${row.id}`]: 'remote' }))}>Remote</Button></Stack></ListItem></React.Fragment>)}</List>}<Button disabled={busy || !verified} variant="contained" onClick={() => run(merge)}>Merge and upload encrypted result</Button></Box>}
    {remote?.exists && <Box sx={{ display: 'grid', gap: 1 }}><Alert severity="warning">Restore replaces the local vault after master-password verification. Upload replaces the checked remote snapshot.</Alert><Button disabled={busy} variant="outlined" onClick={() => run(upload)}>Keep local — upload encrypted snapshot</Button><Button disabled={busy} onClick={() => onRestore(remote.backup)}>Keep remote — verify and restore</Button></Box>}
    {remote && !remote.exists && <Button disabled={busy} variant="contained" onClick={() => run(upload)}>Create remote encrypted backup</Button>}
    <Typography variant="caption">{localStorage.getItem('ciphervault_last_backup_' + profile) ? 'Last backup: ' + new Date(localStorage.getItem('ciphervault_last_backup_' + profile)).toLocaleString() : 'No backup recorded for this profile.'}</Typography>
  </DialogContent><DialogActions><Button disabled={busy} onClick={onClose}>Close</Button></DialogActions></Dialog>;
}
