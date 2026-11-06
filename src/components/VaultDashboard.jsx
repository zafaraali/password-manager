import React, { useState } from 'react';
import { Paper, Typography, Button, Box, Tabs, Tab, TextField, Grid, Chip, IconButton } from '@mui/material';
import ItemModal from './ItemModal';
import SecurityAuditorModal from './SecurityAuditorModal';
import ExportModal from './ExportModal';
import TrashModal from './TrashModal';
import ProfileManagerModal from './ProfileManagerModal';
import PasswordHistoryModal from './PasswordHistoryModal';
import TOTPWidget from './TOTPWidget';
import { CryptoEngine } from '../utils/crypto';
import { TOTP } from '../utils/totp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function VaultDashboard({ 
  vaultItems, trashItems, onSaveItem, onDeleteItem, onRestoreItem, onDeletePermanent,
  profiles, currentProfile, onSwitchProfile, onCreateProfile, onDeleteProfile, onImportTotpJson,
  onImportVaultJson, activeKey, settings
}) {
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [openAuditor, setOpenAuditor] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  const [openTrash, setOpenTrash] = useState(false);
  const [openProfileManager, setOpenProfileManager] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [copiedMsg, setCopiedMsg] = useState('');

  const handleOpenAdd = () => {
    setEditingItem(null);
    setOpenModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setOpenModal(true);
  };

  const handleRestoreOldPassword = async (itemId, oldPassword) => {
    const item = vaultItems.find(i => i.id === itemId);
    if (!item) return;
    
    const existingHistory = item.passwordHistory || [];
    const updatedHistory = [
      { password: item.password, timestamp: new Date().toISOString() },
      ...existingHistory
    ].slice(0, 5);

    const updatedItem = {
      ...item,
      password: oldPassword,
      passwordHistory: updatedHistory
    };

    await onSaveItem(updatedItem);
    setCopiedMsg(`Restored previous password for ${item.name}!`);
  };

  const handleCopyValue = async (item) => {
    let valToCopy = item.password || '';
    if (item.category === 'Crypto' && item.templateData) {
      valToCopy = item.templateData.seedPhrase || '';
    } else if (item.category === 'SSH' && item.templateData) {
      valToCopy = item.templateData.privateKey || '';
    } else if (item.category === 'Wifi' && item.templateData) {
      valToCopy = item.password || '';
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(valToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = valToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      const timeoutSec = settings?.clipboardTimeout || 30;
      setCopiedMsg(`Copied [${item.name}]! Clears in ${timeoutSec}s.`);
      
      setTimeout(async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const currentClip = await navigator.clipboard.readText();
            if (currentClip === valToCopy) {
              await navigator.clipboard.writeText('');
            }
          }
        } catch (err) {}
      }, timeoutSec * 1000);
    } catch (err) {
      alert('Failed to copy to clipboard: ' + err.message);
    }
  };

  const handleDownloadAttachment = async (att) => {
    try {
      const decryptedBuf = await CryptoEngine.decryptFile(activeKey, att);
      const blob = new Blob([decryptedBuf], { type: att.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to decrypt and download attachment: ' + err.message);
    }
  };

  const handleVaultJsonImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (!backup.salt || !backup.vault) {
          throw new Error('Invalid vault backup format.');
        }
        onImportVaultJson(backup);
      } catch (err) {
        alert('Failed to import vault backup JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleAuthImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            if ('BarcodeDetector' in window) {
              try {
                const detector = new BarcodeDetector({ formats: ['qr_code'] });
                const codes = await detector.detect(canvas);
                if (codes.length > 0) {
                  const qrText = codes[0].rawValue;
                  if (qrText.startsWith('otpauth-migration://')) {
                    const accounts = TOTP.parseGoogleMigrationUrl(qrText);
                    onImportTotpJson({ accounts });
                    return;
                  }
                }
              } catch (err) {}
            }

            const manualUrl = prompt('Could not auto-scan QR from screenshot directly in this browser. Please paste the Google Authenticator migration URL (otpauth-migration://...) or secret key:');
            if (manualUrl) {
              if (manualUrl.startsWith('otpauth-migration://')) {
                const accounts = TOTP.parseGoogleMigrationUrl(manualUrl);
                onImportTotpJson({ accounts });
              } else {
                onImportTotpJson([{ name: 'Imported Secret', secret: manualUrl }]);
              }
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        alert('QR Image processing error: ' + err.message);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.services || (data.version && data.encrypted !== undefined)) {
          const accounts = TOTP.parse2FasJson(data);
          onImportTotpJson({ accounts });
        } else {
          onImportTotpJson(data);
        }
      } catch (err) {
        alert('Failed to parse 2FA / Google Auth JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const filteredItems = vaultItems.filter(item => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 4, border: 1, borderColor: 'divider', background: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Vault Dashboard [{currentProfile}]</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>🛡️ {vaultItems.length} secure item{vaultItems.length === 1 ? '' : 's'} stored locally.</span>
            {copiedMsg && <Box component="span" sx={{ color: 'secondary.main', fontWeight: 600, bgcolor: 'secondary.main', bgOpacity: 0.1, px: 1, py: 0.2, borderRadius: 1 }}>{copiedMsg}</Box>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
            📥 Import JSON
            <input type="file" hidden accept=".json" onChange={handleVaultJsonImport} />
          </Button>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
            📷 Import 2FA
            <input type="file" hidden accept=".json,image/*" onChange={handleAuthImport} />
          </Button>
          <Button variant="contained" size="large" onClick={handleOpenAdd} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
            + Add Item
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs 
          value={filterCategory} 
          onChange={(e, val) => setFilterCategory(val)} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', minHeight: 44, borderRadius: 2, mr: 1 } }}
        >
          <Tab label="All" value="All" />
          <Tab label="Logins" value="Logins" />
          <Tab label="Cards" value="Cards" />
          <Tab label="Notes" value="Notes" />
          <Tab label="API Keys" value="ApiKeys" />
          <Tab label="Crypto" value="Crypto" />
          <Tab label="SSH" value="SSH" />
          <Tab label="Wifi" value="Wifi" />
        </Tabs>
        <TextField
          size="small"
          placeholder="Search vault..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: { xs: '100%', sm: '260px' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
      </Box>

      <Grid container spacing={3}>
        {filteredItems.length === 0 ? (
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
              <Typography variant="h3" sx={{ mb: 2 }}>📭</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No vault items found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Get started by adding your first login, secure note, or encrypted template.
              </Typography>
              <Button variant="contained" onClick={handleOpenAdd} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff' }}>
                + Add Item Now
              </Button>
            </Paper>
          </Grid>
        ) : (
          filteredItems.map(item => {
            const isRevealed = showPasswordMap[item.id];
            const hasHistory = item.passwordHistory && item.passwordHistory.length > 0;
            const domain = item.username && item.username.includes('@') ? item.username.split('@')[1] : null;
            const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;

            return (
              <Grid item xs={12} sm={6} key={item.id}>
                <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', position: 'relative', bgcolor: 'background.paper', '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', transform: 'translateY(-2px)' }, transition: 'all 0.25s ease-in-out' }}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {faviconUrl && (
                          <Box component="img" src={faviconUrl} alt="" sx={{ width: 24, height: 24, borderRadius: 1 }} onError={(e) => e.target.style.display = 'none'} />
                        )}
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{item.name}</Typography>
                      </Box>
                      <Chip label={item.category} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
                    </Box>

                    {item.category === 'Crypto' && item.templateData && (
                      <Box sx={{ mb: 2, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>🪙 Crypto Wallet Seed</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                          {isRevealed ? item.templateData.seedPhrase : '••••••••••••••••••••••••••••'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                          Path: {item.templateData.derivationPath}
                        </Typography>
                      </Box>
                    )}

                    {item.category === 'SSH' && item.templateData && (
                      <Box sx={{ mb: 2, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>🖥️ SSH Config ({item.templateData.host}:{item.templateData.port})</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.85rem' }}>
                          {isRevealed ? item.templateData.privateKey : '-----BEGIN RSA PRIVATE KEY-----'}
                        </Typography>
                      </Box>
                    )}

                    {item.category === 'Wifi' && item.templateData && (
                      <Box sx={{ mb: 2, p: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                        <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>📶 Wi-Fi ({item.templateData.ssid})</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                          Password: {isRevealed ? item.password : '••••••••••••'}
                        </Typography>
                      </Box>
                    )}

                    {item.category !== 'Crypto' && item.category !== 'SSH' && item.category !== 'Wifi' && (
                      <>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary', mb: 1.5, fontSize: '0.85rem' }}>
                          {item.username || 'No username'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1.5, p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRadius: 2, border: 1, borderColor: 'divider', fontSize: '0.9rem' }}>
                          {isRevealed ? item.password : '••••••••••••'}
                        </Typography>
                      </>
                    )}

                    {item.totpSecret && <TOTPWidget secret={item.totpSecret} settings={settings} />}

                    {item.attachment && (
                      <Box sx={{ mt: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          📎 {item.attachment.name}
                        </Typography>
                        <Button size="small" onClick={() => handleDownloadAttachment(item.attachment)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                          Download
                        </Button>
                      </Box>
                    )}

                    {item.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, mb: 2, display: 'block' }}>
                        {item.notes}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="text" startIcon={isRevealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />} onClick={() => setShowPasswordMap(prev => ({ ...prev, [item.id]: !prev[item.id] }))} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                          {isRevealed ? 'Hide' : 'Reveal'}
                        </Button>
                        <Button size="small" variant="contained" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => handleCopyValue(item)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff', bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}>
                          Copy
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => handleOpenEdit(item)} title="Edit" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => onDeleteItem(item.id)} title="Delete" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    {hasHistory && (
                      <Button size="small" variant="text" onClick={() => setHistoryItem(item)} sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', p: 0, color: 'primary.main' }}>
                        🕒 View Password History ({item.passwordHistory.length})
                      </Button>
                    )}
                  </Box>
                </Paper>
              </Grid>
            );
          })
        )}
      </Grid>

      <ItemModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={(item) => {
          onSaveItem(item);
          setOpenModal(false);
        }}
        editingItem={editingItem}
        activeKey={activeKey}
        settings={settings}
      />

      {historyItem && (
        <PasswordHistoryModal
          open={Boolean(historyItem)}
          onClose={() => setHistoryItem(null)}
          item={historyItem}
          onRestoreOldPassword={handleRestoreOldPassword}
        />
      )}

      <SecurityAuditorModal
        open={openAuditor}
        onClose={() => setOpenAuditor(false)}
        vaultItems={vaultItems}
      />

      <ExportModal
        open={openExport}
        onClose={() => setOpenExport(false)}
        profileName={currentProfile}
      />

      <TrashModal
        open={openTrash}
        onClose={() => setOpenTrash(false)}
        trashItems={trashItems}
        onRestore={onRestoreItem}
        onDeletePermanent={onDeletePermanent}
      />

      <ProfileManagerModal
        open={openProfileManager}
        onClose={() => setOpenProfileManager(false)}
        profiles={profiles}
        currentProfile={currentProfile}
        onSwitchProfile={onSwitchProfile}
        onCreateProfile={onCreateProfile}
        onDeleteProfile={onDeleteProfile}
      />
    </Box>
  );
}
