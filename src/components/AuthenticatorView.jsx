import React, { useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem, Paper, TextField, Typography } from '@mui/material';
import TOTPWidget from './TOTPWidget';
import { TOTP } from '../utils/totp';
import { isAuthenticator, normalizeOtp } from '../utils/accounts';
import { useFeedback } from './FeedbackProvider';

export default function AuthenticatorView({ vaultItems, settings, onSaveToken, onDeleteItem, onImport }) {
  const { confirm, notify } = useFeedback();
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tokens = vaultItems.filter(isAuthenticator);
  const logins = vaultItems.filter(item => item.category === 'Logins');
  const visible = tokens.filter(item => (!favorites || item.favorite) && `${item.name} ${item.username || ''} ${item.issuer || ''}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name));
  const open = item => {
    const parsed = item?.totpSecret ? TOTP.parseOtpAuthUrl(item.totpSecret) : {};
    setEditing(item || { id: crypto.randomUUID(), category: 'Authenticator' });
    setForm({ name: item?.name || '', username: parsed.account || item?.username || '', issuer: parsed.issuer || item?.issuer || '', secret: parsed.secret || '', algorithm: (parsed.algorithm || 'SHA1').replace('-', ''), digits: parsed.digits || 6, period: parsed.period || 30 });
    setLinks(logins.filter(login => login.totpId === item?.id).map(login => login.id));
    setError('');
  };
  const change = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const pasteSecret = value => {
    if (value.startsWith('otpauth://')) {
      const p = TOTP.parseOtpAuthUrl(value);
      setForm(old => ({ ...old, secret: p.secret, issuer: p.issuer, username: p.account, name: old.name || p.issuer || p.account, algorithm: p.algorithm.replace('-', ''), digits: p.digits, period: p.period }));
    } else change('secret', value);
  };
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!form.name?.trim()) throw new Error('Enter an account name.');
      await onSaveToken({ ...editing, name: form.name.trim(), username: form.username, issuer: form.issuer, totpSecret: normalizeOtp(form.secret, form) }, links);
      setEditing(null);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async token => {
    if (!await confirm({ title: 'Move authenticator to Trash?', message: 'Linked logins will remain, but their link to this token will be removed.', confirmLabel: 'Move to Trash' })) return;
    try { await onDeleteItem(token.id); } catch (e) { notify(e.message, 'error'); }
  };
  return <Box sx={{ display: 'grid', gap: 2 }}>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography variant="h5" sx={{ flex: 1 }}>Authenticator <Chip label={tokens.length} size="small" /></Typography>
      <Button component="label" variant="outlined">Import<input hidden type="file" accept=".json,.2fas" onChange={async event => { const file = event.target.files[0]; event.target.value = ''; if (file) try { onImport(JSON.parse(await file.text())); } catch (e) { notify(e.message, 'error'); } }} /></Button>
      <Button variant="contained" onClick={() => open()}>Add account</Button>
    </Box>
    <TextField label="Search authenticator accounts" value={query} onChange={event => setQuery(event.target.value)} />
    <FormControlLabel control={<Checkbox checked={favorites} onChange={event => setFavorites(event.target.checked)} />} label="Favorites only" />
    <Grid container spacing={2}>{visible.map(token => <Grid item xs={12} sm={6} key={token.id}>
      <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography variant="h6">{token.name}</Typography><Button aria-label={`Favorite ${token.name}`} onClick={() => onSaveToken({ ...token, favorite: !token.favorite }).catch(e => notify(e.message, 'error'))}>{token.favorite ? '★' : '☆'}</Button></Box>
        <Typography color="text.secondary" variant="body2">{token.username || token.issuer}</Typography>
        <TOTPWidget secret={token.totpSecret} name={token.username || token.name} issuer={token.issuer} settings={settings} />
        <Typography variant="caption">{logins.filter(login => login.totpId === token.id).length} linked logins</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}><Button onClick={() => open(token)}>Edit / link logins</Button><Button color="error" onClick={() => remove(token)}>Remove</Button></Box>
      </Paper>
    </Grid>)}</Grid>
    {!visible.length && <Alert severity="info">{tokens.length ? 'No matching accounts.' : 'Add an account or import a 2FAS backup to get started.'}</Alert>}
    <Dialog open={Boolean(editing)} onClose={() => !busy && setEditing(null)} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={save}><DialogTitle>Authenticator account</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField required label="Name" value={form.name || ''} onChange={e => change('name', e.target.value)} />
        <TextField label="Issuer" value={form.issuer || ''} onChange={e => change('issuer', e.target.value)} />
        <TextField label="Account / email" value={form.username || ''} onChange={e => change('username', e.target.value)} />
        <TextField required type="password" label="Secret or otpauth URL" value={form.secret || ''} onChange={e => pasteSecret(e.target.value.trim())} />
        <TextField select label="Algorithm" value={form.algorithm || 'SHA1'} onChange={e => change('algorithm', e.target.value)}>{['SHA1', 'SHA256', 'SHA512'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select label="Digits" value={form.digits || 6} onChange={e => change('digits', e.target.value)}>{[6, 7, 8].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField type="number" label="Period (seconds)" inputProps={{ min: 1, max: 300 }} value={form.period || 30} onChange={e => change('period', Number(e.target.value))} />
        <TextField select label="Linked logins" SelectProps={{ multiple: true }} value={links} onChange={e => setLinks(e.target.value)} helperText="A login links to one token. Changing this token updates the codes for every linked login.">{logins.map(login => <MenuItem key={login.id} value={login.id}>{login.name} — {login.username}</MenuItem>)}</TextField>
      </DialogContent><DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} type="submit" variant="contained">{busy ? 'Saving…' : 'Save account'}</Button></DialogActions></Box>
    </Dialog>
  </Box>;
}
