import React, { useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, Chip, TextField, InputAdornment, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';

export default function TrashModal({ open, onClose, trashItems = [], onRestore, onDeletePermanent, onEmptyTrash }) {
  const [query, setQuery] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const filtered = useMemo(() => trashItems.filter(item => `${item.name} ${item.username || ''} ${item.category || ''}`.toLowerCase().includes(query.toLowerCase())), [trashItems, query]);
  const emptyTrash = () => { if (trashItems.length) setConfirmEmpty(true); };
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
    <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>🗑️ Trash <Chip label={trashItems.length} size="small" color="error" sx={{ ml: 1 }} /></span><Button color="error" size="small" startIcon={<DeleteSweepOutlinedIcon />} onClick={emptyTrash} disabled={!trashItems.length} sx={{ textTransform: 'none', fontWeight: 700 }}>Empty Trash</Button></DialogTitle>
    <DialogContent dividers>
      <TextField fullWidth size="small" placeholder="Search deleted items..." value={query} onChange={e => setQuery(e.target.value)} sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      {trashItems.length > 0 && filtered.length === 0 && <Alert severity="info">No deleted items match your search.</Alert>}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{!trashItems.length ? <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>Trash is empty.</Typography> : filtered.map(item => <Paper key={item.id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}><Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.username || 'No username'} · Deleted {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : 'date unavailable'}</Typography><Chip label={item.category || 'Uncategorized'} size="small" variant="outlined" sx={{ mt: .75 }} /></Box><Box sx={{ display: 'flex', gap: .75, flexShrink: 0 }}><Button size="small" variant="outlined" onClick={() => onRestore(item.id)} sx={{ textTransform: 'none' }}>Restore</Button><Button size="small" color="error" onClick={() => onDeletePermanent(item.id)} sx={{ textTransform: 'none' }}>Delete</Button></Box></Paper>)}</Box>
    </DialogContent><DialogActions sx={{ p: 2 }}><Button onClick={onClose} variant="contained" sx={{ textTransform: 'none' }}>Close</Button></DialogActions>
    <Dialog open={confirmEmpty} onClose={() => setConfirmEmpty(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Empty trash permanently?</DialogTitle>
      <DialogContent><Typography color="text.secondary">This will permanently remove {trashItems.length} deleted item{trashItems.length === 1 ? '' : 's'}. This action cannot be undone.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmEmpty(false)}>Cancel</Button><Button color="error" variant="contained" onClick={() => { setConfirmEmpty(false); onEmptyTrash(); }}>Delete permanently</Button></DialogActions>
    </Dialog>
  </Dialog>;
}
