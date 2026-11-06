import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, FormControlLabel, Checkbox, IconButton, Tooltip, InputAdornment, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PasswordGeneratorModal from './PasswordGeneratorModal';

export default function ItemModal({ open, onClose, onSave, editingItem }) {
  const [formCategory, setFormCategory] = useState('login');
  const [formTitle, setFormTitle] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formCustomIcon, setFormCustomIcon] = useState('');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  useEffect(() => {
    if (editingItem) {
      setFormCategory(editingItem.category || 'login');
      setFormTitle(editingItem.title || '');
      setFormUsername(editingItem.username || '');
      setFormPassword(editingItem.password || '');
      setFormUrl(editingItem.url || '');
      setFormNotes(editingItem.notes || '');
      setFormCustomIcon(editingItem.customIcon || '');
      setFormIsPinned(editingItem.isPinned || false);
    } else {
      setFormCategory('login');
      setFormTitle('');
      setFormUsername('');
      setFormPassword('');
      setFormUrl('');
      setFormNotes('');
      setFormCustomIcon('');
      setFormIsPinned(false);
    }
    setShowPassword(true);
  }, [editingItem, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    onSave({
      id: editingItem ? editingItem.id : Date.now().toString(),
      createdAt: editingItem ? editingItem.createdAt : Date.now(),
      category: formCategory,
      title: formTitle,
      username: formUsername,
      password: formPassword,
      url: formUrl,
      notes: formNotes,
      customIcon: formCustomIcon,
      isPinned: formIsPinned
    });
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
            {editingItem ? 'Edit Vault Item' : 'Add New Vault Item'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
            <TextField
              select
              label="Category"
              size="small"
              fullWidth
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              <MenuItem value="login">Login</MenuItem>
              <MenuItem value="secure_note">Secure Note</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="identity">Identity</MenuItem>
              <MenuItem value="wifi">Wi-Fi</MenuItem>
              <MenuItem value="database">Database</MenuItem>
              <MenuItem value="crypto_wallet">Crypto Wallet</MenuItem>
              <MenuItem value="totp">2FA Authenticator</MenuItem>
            </TextField>

            <TextField
              label="Title"
              size="small"
              fullWidth
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />

            <TextField
              label="Username / Email"
              size="small"
              fullWidth
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
              <TextField
                label="Password / Secret"
                size="small"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
              <Tooltip title="Generate Strong Password">
                <IconButton color="primary" onClick={() => setIsGeneratorOpen(true)}>
                  <AutoAwesomeIcon />
                </IconButton>
              </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                label="Website URL"
                size="small"
                fullWidth
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
              <TextField
                label="Custom Emoji / Icon"
                size="small"
                fullWidth
                value={formCustomIcon}
                placeholder="e.g. 🔑 or Shield"
                onChange={(e) => setFormCustomIcon(e.target.value)}
              />
            </Box>

            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />

            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={formIsPinned}
                  onChange={(e) => setFormIsPinned(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Pin to top of vault</Typography>}
              sx={{ m: 0 }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 1 }}>
            <Button onClick={onClose} color="inherit" size="small" sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" size="small" sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}>
              Save Item
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <PasswordGeneratorModal
        open={isGeneratorOpen}
        onClose={() => setIsGeneratorOpen(false)}
        onApplyPassword={(pwd) => {
          setFormPassword(pwd);
          setShowPassword(true);
        }}
      />
    </>
  );
}
