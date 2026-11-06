import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, IconButton, Tooltip, Chip, Card, CardContent, InputAdornment, LinearProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HistoryIcon from '@mui/icons-material/History';
import PinIcon from '@mui/icons-material/PushPin';
import QrCodeIcon from '@mui/icons-material/QrCode';
import { generateTOTP } from '../utils/totp';

export default function VaultDashboard({
  vaultItems,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onOpenHistory,
  onOpenQR
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [totpCodes, setTotpCodes] = useState({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [clipboardCountdown, setClipboardCountdown] = useState(null);

  useEffect(() => {
    const updateCodesAndTimer = async () => {
      const epoch = Math.floor(Date.now() / 1000);
      const remaining = 30 - (epoch % 30);
      setTimeLeft(remaining);

      const codes = {};
      for (const item of vaultItems) {
        if (item.category === 'totp' && item.password) {
          codes[item.id] = await generateTOTP(item.password);
        }
      }
      setTotpCodes(codes);
    };

    updateCodesAndTimer();
    const interval = setInterval(updateCodesAndTimer, 1000);
    return () => clearInterval(interval);
  }, [vaultItems]);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setClipboardCountdown(5);
    const timer = setInterval(() => {
      setClipboardCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const filteredItems = vaultItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.url && item.url.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
      {clipboardCountdown !== null && (
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'success.main', color: 'success.contrastText', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Copied to clipboard! Clears in {clipboardCountdown}s
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <TextField
          placeholder="Search vault items..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAddItem} sx={{ textTransform: 'none', borderRadius: 2 }}>
          Add Item
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 1 }}>
        {['all', 'login', 'secure_note', 'credit_card', 'identity', 'wifi', 'database', 'crypto_wallet', 'totp'].map(cat => (
          <Chip
            key={cat}
            label={cat.replace('_', ' ').toUpperCase()}
            onClick={() => setSelectedCategory(cat)}
            color={selectedCategory === cat ? 'primary' : 'default'}
            variant={selectedCategory === cat ? 'filled' : 'outlined'}
            sx={{ fontWeight: 600, borderRadius: 2, textTransform: 'capitalize' }}
          />
        ))}
      </Box>

      {filteredItems.length === 0 ? (
        <Paper sx={{ overflowY: 'visible', p: 6, textAlign: 'center', borderRadius: 3, bgcolor: 'background.paper' }}>
          <Typography variant="h6" color="text.secondary">
            No vault items found.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredItems.map(item => (
            <Card key={item.id} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '16px !important', flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: 1 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {item.customIcon || '🔑'}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, truncate: true }}>
                        {item.title}
                      </Typography>
                      {item.isPinned && <PinIcon fontSize="small" color="primary" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {item.username || item.url || item.category}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, flexWrap: 'wrap' }}>
                  {item.category === 'totp' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', px: 1.5, py: 0.5, borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', letterSpacing: '1px' }}>
                        {totpCodes[item.id] || '------'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        ({timeLeft}s)
                      </Typography>
                    </Box>
                  )}

                  {item.password && (
                    <>
                      <Tooltip title="Copy Password">
                        <IconButton size="small" onClick={() => copyToClipboard(item.password)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Toggle Visibility">
                        <IconButton size="small" onClick={() => togglePasswordVisibility(item.id)}>
                          {visiblePasswords[item.id] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}

                  {item.category === 'totp' && item.password && (
                    <Tooltip title="Show QR Code">
                      <IconButton size="small" onClick={() => onOpenQR(item)}>
                        <QrCodeIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}

                  <Tooltip title="Password History">
                    <IconButton size="small" onClick={() => onOpenHistory(item)}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => onEditItem(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => onDeleteItem(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
