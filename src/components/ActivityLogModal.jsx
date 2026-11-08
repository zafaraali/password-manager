import React, { useMemo, useState } from 'react';
import { Alert, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Button, List, ListItem, ListItemText, Typography, TextField, MenuItem } from '@mui/material';

export default function ActivityLogModal({ open, onClose, events = [] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const filtered = useMemo(() => events.filter(event => (kind === 'all' || event.kind === kind) && `${event.action} ${event.profile || ''}`.toLowerCase().includes(query.toLowerCase())), [events, kind, query]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="activity-log-title">
    <DialogTitle id="activity-log-title">Vault activity</DialogTitle>
    <DialogContent dividers>
      {!events.length ? <Alert severity="info">No activity has been recorded yet.</Alert> : <><TextField size="small" fullWidth label="Filter activity" value={query} onChange={e => setQuery(e.target.value)} sx={{ mb: 1.5 }} /><TextField select size="small" label="Type" value={kind} onChange={e => setKind(e.target.value)} sx={{ mb: 1.5, minWidth: 140 }}><MenuItem value="all">All activity</MenuItem><MenuItem value="Vault">Vault changes</MenuItem></TextField><List dense>{filtered.slice().reverse().map(event => <ListItem key={event.id} divider><ListItemText primary={event.action} secondary={`${new Date(event.at).toLocaleString()} · ${event.profile || 'Current profile'}`} /><Chip size="small" label={event.kind || 'Vault'} variant="outlined" /></ListItem>)}{!filtered.length && <Alert severity="info">No activity matches this filter.</Alert>}</List></>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Activity is encrypted inside the vault and is unavailable while the vault is locked.</Typography>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
