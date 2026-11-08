import React, { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, LinearProgress, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { previewMigration } from '../utils/migration';
export default function ImportPreview({ incoming, existing, onImport, onClose }) {
  const rows = useMemo(() => previewMigration(incoming, existing), [incoming, existing]);
  const [selectedIds, setSelectedIds] = useState(() => new Set(rows.filter(row => !row.duplicate).map(row => row.item.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const duplicateCount = rows.filter(row => row.duplicate).length;
  const selectedCount = rows.filter(row => selectedIds.has(row.item.id)).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const setAll = checked => setSelectedIds(checked ? new Set(rows.map(row => row.item.id)) : new Set());
  const toggle = id => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return <Dialog open fullWidth maxWidth="md" onClose={() => !busy && onClose()} aria-labelledby="import-preview-title">
    <DialogTitle id="import-preview-title">Review import</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        <Alert severity={duplicateCount ? 'warning' : 'info'}>
          {incoming.length} records found. {duplicateCount} exact duplicate{duplicateCount === 1 ? '' : 's'} detected. Existing records are never changed by this import.
        </Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel control={<Checkbox checked={allSelected} indeterminate={selectedCount > 0 && !allSelected} onChange={e => setAll(e.target.checked)} />} label={`Select all (${selectedCount} selected)`} />
          <Stack direction="row" spacing={1}><Chip size="small" color="success" label={`${rows.filter(row => !row.duplicate).length} new`} /><Chip size="small" color="warning" label={`${duplicateCount} duplicates`} /></Stack>
        </Box>
        <List dense sx={{ maxHeight: 440, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }} aria-label="Import records">
          {rows.map(({ item, duplicate }, index) => <React.Fragment key={item.id}>
            {index > 0 && <Divider component="li" />}
            <ListItem secondaryAction={<Checkbox edge="end" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} inputProps={{ 'aria-label': `Import ${item.name}` }} />}>
              <ListItemText primary={item.name} secondary={<>{item.category} · {item.username || 'No account label'}{duplicate && <Typography component="span" color="warning.main"> · exact duplicate</Typography>}</>} />
            </ListItem>
          </React.Fragment>)}
        </List>
        {!rows.length && <Typography color="text.secondary">No valid records were found in this file.</Typography>}
      </Stack>
    </DialogContent>
    {busy && <LinearProgress aria-label="Importing records" />}
    <DialogActions><Button disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !selectedCount} variant="contained" onClick={async () => { setBusy(true); setError(''); try { await onImport({ selectedIds: [...selectedIds] }); onClose(); } catch (e) { setError(e.message || 'Import failed.'); } finally { setBusy(false); } }}>Import {selectedCount} records</Button></DialogActions>
  </Dialog>;
}
