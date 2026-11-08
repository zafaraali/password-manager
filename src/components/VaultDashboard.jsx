import React, { useState, useEffect, useRef } from 'react';
import { 
  Paper, Typography, Button, Box, Tabs, Tab, TextField, Grid, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress, Menu, MenuItem, Divider,
  Select, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import ItemModal from './ItemModal';
import PasswordHistoryModal from './PasswordHistoryModal';
import TOTPWidget from './TOTPWidget';
import { CryptoEngine } from '../utils/crypto';
import { TOTP } from '../utils/totp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LaunchIcon from '@mui/icons-material/Launch';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SortIcon from '@mui/icons-material/Sort';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import ClearIcon from '@mui/icons-material/Clear';
import { copyToClipboard } from '../utils/clipboard';
import { useFeedback } from './FeedbackProvider';

export default function VaultDashboard({ 
  vaultItems = [], trashItems = [], onSaveItem, onDeleteItem, onRestoreItem, onDeletePermanent,
  profiles, currentProfile, onSwitchProfile, onCreateProfile, onDeleteProfile, onImportTotpJson,
  onImportVaultJson, onImportItems, activeKey, settings, authenticatorItems = []
}) {
  const { notify, input } = useFeedback();
  const [filterCategory, setFilterCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [showCustomFieldMap, setShowCustomFieldMap] = useState({});
  const [historyItem, setHistoryItem] = useState(null);
  const [copiedMsg, setCopiedMsg] = useState('');
  const [clipboardRemaining, setClipboardRemaining] = useState(0);
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('list');
  const [importAnchor, setImportAnchor] = useState(null);

  // Keep navigation preferences per profile so the vault feels consistent
  // across unlocks and profile switches.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`ciphervault_ui_${currentProfile}`) || '{}');
      if (saved.filterCategory) setFilterCategory(saved.filterCategory);
      if (saved.selectedTag) setSelectedTag(saved.selectedTag);
      if (saved.sortBy) setSortBy(saved.sortBy);
      if (saved.viewMode) setViewMode(saved.viewMode);
    } catch {
      // Ignore malformed preference data and keep safe defaults.
    }
  }, [currentProfile]);

  useEffect(() => {
    if (!currentProfile) return;
    localStorage.setItem(`ciphervault_ui_${currentProfile}`, JSON.stringify({ filterCategory, selectedTag, sortBy, viewMode }));
  }, [currentProfile, filterCategory, selectedTag, sortBy, viewMode]);

  // Live Camera QR Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const searchInputRef = useRef(null);
  const clipboardTimerRef = useRef(null);
  const clipboardOwnerRef = useRef(0);

  const clearManagedClipboard = async (owner = clipboardOwnerRef.current) => {
    if (owner !== clipboardOwnerRef.current) return;
    clearInterval(clipboardTimerRef.current);
    clipboardTimerRef.current = null;
    setClipboardRemaining(0);
    try { await copyToClipboard(''); } catch (error) { /* Clipboard may be unavailable after navigation. */ }
  };

  useEffect(() => () => {
    clearInterval(clipboardTimerRef.current);
    clipboardOwnerRef.current += 1;
  }, []);

  // Global search shortcut (Ctrl+K or /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setOpenModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setOpenModal(true);
  };

  const handleToggleFavorite = async (item) => {
    const updated = { ...item, favorite: !item.favorite };
    try { await onSaveItem(updated); } catch (error) { notify(error.message, 'error'); }
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
      passwordHistory: updatedHistory,
      passwordUpdatedAt: new Date().toISOString()
    };

    try { await onSaveItem(updatedItem); } catch (error) { notify(error.message, 'error'); throw error; }
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
      await copySecret(valToCopy, item.name, true);
    } catch (err) {
      notify('Failed to copy to clipboard: ' + err.message, 'error');
    }
  };

  const handleCopyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsg(`Copied ${label}!`);
      setTimeout(() => setCopiedMsg(''), 2500);
    } catch (err) {}
  };

  const copySecret = async (text, label, clearAfter = false) => {
    if (!text) { setCopiedMsg(`${label} is empty.`); return; }
    try {
      const copied = await copyToClipboard(text);
      if (!copied) throw new Error('Clipboard unavailable');
      const timeoutSec = settings?.clipboardTimeout || 30;
      if (clearAfter) {
        clearInterval(clipboardTimerRef.current);
        const owner = ++clipboardOwnerRef.current;
        setClipboardRemaining(timeoutSec);
        setCopiedMsg(`${label} copied · clears in ${timeoutSec}s`);
        clipboardTimerRef.current = setInterval(() => setClipboardRemaining(value => {
          if (value <= 1) {
            clearManagedClipboard(owner);
            setCopiedMsg('Clipboard cleared');
            return 0;
          }
          setCopiedMsg(`${label} copied · clears in ${value - 1}s`);
          return value - 1;
        }), 1000);
      }
      else setTimeout(() => setCopiedMsg(''), 2200);
    } catch (err) { setCopiedMsg(`Could not copy ${label.toLowerCase()}.`); }
  };

  const handleCopyTotp = async (item) => {
    const code = await TOTP.generate(item.totpSecret);
    await copySecret(code, '2FA code');
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
      notify('Failed to decrypt and download attachment: ' + err.message, 'error');
    }
  };

  // Unified Importer: Handles CipherVault backups, Bitwarden JSON exports, and 2FAS JSON backups
  const handleVaultJsonImport = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if ((data.salt && data.vault) || data.format === 'ciphervault-protected-export') await onImportVaultJson(data);
      else onImportItems(data);
    } catch (error) { notify('Import failed: ' + error.message, 'error'); }
  };

  const handleAuthImport = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
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
                  } else if (qrText.startsWith('otpauth://')) {
                    const parsed = TOTP.parseOtpAuthUrl(qrText);
                    onImportTotpJson([{ ...parsed, name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
                    return;
                  }
                }
              } catch (err) {}
            }

            const manualUrl = await input({ title: 'QR could not be read automatically', message: 'Paste an otpauth:// URL, otpauth-migration:// URL, or raw secret.', label: 'QR data' });
            if (manualUrl) {
              if (manualUrl.startsWith('otpauth-migration://')) {
                const accounts = TOTP.parseGoogleMigrationUrl(manualUrl);
                onImportTotpJson({ accounts });
              } else if (manualUrl.startsWith('otpauth://')) {
                const parsed = TOTP.parseOtpAuthUrl(manualUrl);
                onImportTotpJson([{ ...parsed, name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
              } else {
                onImportTotpJson([{ name: 'Imported Secret', secret: manualUrl }]);
              }
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        notify('QR image processing error: ' + err.message, 'error');
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.services) {
          const accounts = TOTP.parse2FasJson(data);
          onImportTotpJson({ accounts });
        } else {
          onImportTotpJson(data);
        }
      } catch (err) {
        notify('Failed to parse 2FA file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // --- Live Webcam QR Code Scanner ---
  const startCameraScanner = async () => {
    setCameraError('');
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      startScanLoop();
    } catch (err) {
      setCameraError('Unable to access webcam: ' + err.message);
    }
  };

  const stopCameraScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startScanLoop = () => {
    let active = true;
    const interval = setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
      if ('BarcodeDetector' in window) {
        try {
          const detector = new BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const rawVal = barcodes[0].rawValue;
            active = false;
            clearInterval(interval);
            stopCameraScanner();

            if (rawVal.startsWith('otpauth-migration://')) {
              const accounts = TOTP.parseGoogleMigrationUrl(rawVal);
              onImportTotpJson({ accounts });
            } else if (rawVal.startsWith('otpauth://')) {
              const parsed = TOTP.parseOtpAuthUrl(rawVal);
              onImportTotpJson([{ ...parsed, name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
            } else {
              onImportTotpJson([{ name: 'Scanned 2FA Account', secret: rawVal }]);
            }
          }
        } catch (e) {}
      }
    }, 400);
  };

  // Unique tags
  const allTags = Array.from(new Set(vaultItems.flatMap(i => i.tags || [])));

  // Filtered items
  const matchingItems = vaultItems.filter(item => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchesTag = selectedTag === 'All' || (item.tags && item.tags.includes(selectedTag));
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.website && item.website.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesTag && matchesSearch;
  });

  const filteredItems = [...matchingItems].sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'favorite') return Number(b.favorite) - Number(a.favorite);
    return new Date(b.passwordUpdatedAt || b.createdAt || 0).getTime() - new Date(a.passwordUpdatedAt || a.createdAt || 0).getTime();
  });

  const pinnedItems = filteredItems.filter(i => i.favorite);
  const regularItems = filteredItems.filter(i => !i.favorite);

  const renderItemCard = (item, isPinnedBadge = false) => {
    const isRevealed = showPasswordMap[item.id];
    const hasHistory = item.passwordHistory && item.passwordHistory.length > 0;
    const hasCustomFields = item.customFields && item.customFields.length > 0;
    
    // Resolve favicon from website or email domain
    let domain = null;
    if (item.website) {
      try {
        const u = new URL(item.website.startsWith('http') ? item.website : 'https://' + item.website);
        domain = u.hostname;
      } catch (e) {}
    } else if (item.username && item.username.includes('@')) {
      domain = item.username.split('@')[1];
    }
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;

    return (
      <Grid item xs={12} sm={viewMode === 'list' ? 12 : 6} key={item.id}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 3, 
            borderRadius: 4, 
            border: 1, 
            borderColor: item.favorite ? 'primary.main' : 'divider', 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between', 
            height: '100%', 
            position: 'relative', 
            bgcolor: 'background.paper', 
            boxShadow: item.favorite ? '0 4px 16px rgba(99, 102, 241, 0.08)' : 'none',
            '&:hover': { borderColor: 'primary.main', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', transform: 'translateY(-2px)' }, 
            transition: 'all 0.25s ease-in-out' 
          }}
        >
          <Box>
            {/* Header: Name, Favicon, Favorite Star, Category */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1, mr: 1 }}>
                {faviconUrl && (
                  <Box 
                    component="img" 
                    src={faviconUrl} 
                    alt="" 
                    sx={{ width: 26, height: 26, borderRadius: 1.5 }} 
                    onError={(e) => e.target.style.display = 'none'} 
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </Typography>
                  {(item.passwordUpdatedAt || item.createdAt) && <Typography variant="caption" color="text.secondary">Updated {new Date(item.passwordUpdatedAt || item.createdAt).toLocaleDateString()}</Typography>}
                  {item.website && (
                    <Box 
                      component="a" 
                      href={item.website.startsWith('http') ? item.website : 'https://' + item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 0.5, 
                        color: 'primary.main', 
                        fontSize: '0.75rem', 
                        textDecoration: 'none',
                        fontWeight: 600,
                        '&:hover': { textDecoration: 'underline' }
                      }}
                    >
                      {domain || 'Website'} <LaunchIcon sx={{ fontSize: '0.75rem' }} />
                    </Box>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton 
                  size="small" 
                  onClick={() => handleToggleFavorite(item)}
                  color={item.favorite ? 'warning' : 'default'}
                  title={item.favorite ? 'Remove Favorite' : 'Mark as Favorite'}
                  aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {item.favorite ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
                <Chip label={item.category} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5 }} />
              </Box>
            </Box>

            {/* Tags Badges */}
            {item.tags && item.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1.5 }}>
                {item.tags.map(t => (
                  <Chip 
                    key={t} 
                    label={`#${t}`} 
                    size="small" 
                    variant="outlined" 
                    onClick={() => setSelectedTag(t)}
                    sx={{ fontSize: '0.7rem', height: 20, borderRadius: 1 }} 
                  />
                ))}
              </Box>
            )}

            {/* Template Specific Views */}
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

            {item.category === 'Passkeys' && item.templateData && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(99, 102, 241, 0.08)', borderRadius: 2, border: 1, borderColor: 'primary.main' }}>
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: .75 }}>🔑 Passkey metadata reference</Typography>
                <Typography variant="body2">{item.templateData.rpId || 'No relying party ID'}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .5 }}>Algorithm: {item.templateData.algorithm || 'Not specified'}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>Credential: {item.templateData.credentialId || 'Not registered'}</Typography>
              </Box>
            )}
            {item.category !== 'Crypto' && item.category !== 'SSH' && item.category !== 'Wifi' && item.category !== 'Passkeys' && (
              <>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary', mb: 1, fontSize: '0.85rem' }}>
                  {item.username || 'No username'}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1.5, p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRadius: 2, border: 1, borderColor: 'divider', fontSize: '0.9rem' }}>
                  {isRevealed ? item.password : '••••••••••••'}
                </Typography>
              </>
            )}

            {/* Custom Fields & Backup Codes Section */}
            {hasCustomFields && (
              <Box sx={{ my: 1.5, p: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  🧩 Custom Fields & Backup Codes:
                </Typography>
                {item.customFields.map((cf) => {
                  const fieldKey = `${item.id}_${cf.id}`;
                  const isFieldRevealed = showCustomFieldMap[fieldKey];
                  return (
                    <Box key={cf.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', mr: 1 }}>
                        {cf.name}:
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {cf.isSecret && !isFieldRevealed ? '••••••••' : cf.value}
                        </Typography>
                        {cf.isSecret && (
                          <IconButton 
                            size="small" 
                            onClick={() => setShowCustomFieldMap(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }))}
                            sx={{ p: 0.3 }}
                          >
                            {isFieldRevealed ? <VisibilityOff sx={{ fontSize: '0.85rem' }} /> : <Visibility sx={{ fontSize: '0.85rem' }} />}
                          </IconButton>
                        )}
                        <IconButton 
                          size="small" 
                          onClick={() => handleCopyText(cf.value, cf.name)}
                          sx={{ p: 0.3 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: '0.85rem' }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* 2FAS Radial Authenticator Widget */}
            {item.totpSecret && (
              <TOTPWidget 
                secret={item.totpSecret} 
                name={item.name} 
                issuer={item.name} 
                settings={settings} 
              />
            )}

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
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, mb: 1.5, display: 'block' }}>
                {item.notes}
              </Typography>
            )}
          </Box>

          {/* Footer Controls */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small" 
                  variant="text" 
                  startIcon={isRevealed ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />} 
                  onClick={() => {
                    const nextVisible = !isRevealed;
                    setShowPasswordMap(prev => ({ ...prev, [item.id]: nextVisible }));
                    if (nextVisible) setTimeout(() => setShowPasswordMap(prev => ({ ...prev, [item.id]: false })), 15000);
                  }} 
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                >
                  {isRevealed ? 'Hide' : 'Reveal'}
                </Button>
                <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Tooltip title="Copy username"><Button size="small" variant="outlined" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => copySecret(item.username, 'Username')} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>User</Button></Tooltip>
                  <Tooltip title={`Copy password · clears in ${settings?.clipboardTimeout || 30}s`}><Button size="small" variant="contained" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => copySecret(item.password, 'Password', true)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff' }}>Pass</Button></Tooltip>
                  {item.totpSecret && <Tooltip title="Copy current 2FA code"><Button size="small" variant="outlined" color="secondary" startIcon={<ContentCopyIcon fontSize="small" />} onClick={() => handleCopyTotp(item)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>2FA</Button></Tooltip>}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => handleOpenEdit(item)} title="Edit" aria-label={`Edit ${item.name}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDeleteItem(item.id).catch(error => notify(error.message, 'error'))} title="Delete" aria-label={`Delete ${item.name}`} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1 }}>
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
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Action Bar */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3.5 }, borderRadius: 4, border: 1, borderColor: 'divider', background: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Your vault</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <span>🛡️ {vaultItems.length} secure item{vaultItems.length === 1 ? '' : 's'} stored locally.</span>
            <Chip size="small" label={`${vaultItems.filter(item => item.favorite).length} favorites`} variant="outlined" />
            <Chip size="small" label={`${vaultItems.filter(item => item.totpSecret).length} with 2FA`} variant="outlined" color="secondary" />
            {copiedMsg && <Box component="span" role="status" aria-live="polite" sx={{ color: 'secondary.main', fontWeight: 650 }}>{copiedMsg}</Box>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" aria-haspopup="menu" aria-expanded={Boolean(importAnchor)} onClick={event => setImportAnchor(event.currentTarget)}>Import accounts</Button>
          <Menu anchorEl={importAnchor} open={Boolean(importAnchor)} onClose={() => setImportAnchor(null)}>
            <MenuItem component="label" onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.querySelector('input').click(); }}>Bitwarden, 2FAS or vault backup<input hidden type="file" accept=".json,.2fas" onChange={e => { handleVaultJsonImport(e); setImportAnchor(null); }} /></MenuItem>
            <MenuItem component="label" onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.querySelector('input').click(); }}>QR image or authenticator file<input hidden type="file" accept=".json,.2fas,image/*" onChange={e => { handleAuthImport(e); setImportAnchor(null); }} /></MenuItem>
            <MenuItem onClick={() => { setImportAnchor(null); startCameraScanner(); }}>Scan QR with camera</MenuItem>
          </Menu>
          <Button variant="contained" size="large" onClick={handleOpenAdd} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
            + Add Item
          </Button>
        </Box>
      </Paper>

      {/* Category Pills & Search */}
      <Box sx={{ position: 'sticky', top: { xs: 8, sm: 12 }, zIndex: 5, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'center', py: 1.5, px: { xs: 1, sm: 2 }, mx: { xs: -1, sm: -2 }, bgcolor: 'background.default', backdropFilter: 'blur(12px)', borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={filterCategory} 
          onChange={(e, val) => setFilterCategory(val)} 
          variant="scrollable"
          scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', minHeight: 44, borderRadius: 2, mr: 1 } }}
        >
          <Tab label={`All (${vaultItems.length})`} value="All" />
          <Tab label={`Logins (${vaultItems.filter(i => i.category === 'Logins').length})`} value="Logins" />
          <Tab label={`Identities (${vaultItems.filter(i => i.category === 'Identities').length})`} value="Identities" />
          <Tab label={`Cards (${vaultItems.filter(i => i.category === 'Cards').length})`} value="Cards" />
          <Tab label={`Notes (${vaultItems.filter(i => i.category === 'Notes').length})`} value="Notes" />
          <Tab label={`API Keys (${vaultItems.filter(i => i.category === 'ApiKeys').length})`} value="ApiKeys" />
          <Tab label={`Passkeys (${vaultItems.filter(i => i.category === 'Passkeys').length})`} value="Passkeys" />
          <Tab label={`Crypto (${vaultItems.filter(i => i.category === 'Crypto').length})`} value="Crypto" />
          <Tab label={`SSH (${vaultItems.filter(i => i.category === 'SSH').length})`} value="SSH" />
          <Tab label={`Wifi (${vaultItems.filter(i => i.category === 'Wifi').length})`} value="Wifi" />
        </Tabs>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%', alignItems: 'center' }}>
        <TextField
          inputRef={searchInputRef}
          size="small"
          label="Search vault"
          placeholder="Name, username or website"
          inputProps={{ 'aria-label': 'Search vault' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />
            ),
            endAdornment: searchQuery ? (
              <IconButton size="small" aria-label="Clear vault search" onClick={() => setSearchQuery('')} edge="end"><ClearIcon fontSize="small" /></IconButton>
            ) : undefined,
          }}
          sx={{ flex: 1, minWidth: 0, width: { xs: 'auto', sm: '280px' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
        <Select size="small" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort vault items" sx={{ minWidth: 112, borderRadius: 3 }}>
          <MenuItem value="recent">Recent</MenuItem>
          <MenuItem value="name">Name</MenuItem>
          <MenuItem value="favorite">Favorites</MenuItem>
        </Select>
        <ToggleButtonGroup size="small" exclusive value={viewMode} onChange={(e, value) => value && setViewMode(value)} aria-label="Vault view">
          <ToggleButton value="grid" aria-label="Grid view"><GridViewIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="list" aria-label="List view"><ViewListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Tags Filter Chips (2FAS Grouping feature) */}
      {allTags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>Filter by Tag:</Typography>
          <Chip 
            label="All Tags" 
            size="small" 
            clickable 
            color={selectedTag === 'All' ? 'primary' : 'default'} 
            onClick={() => setSelectedTag('All')}
            sx={{ fontWeight: 600, borderRadius: 1.5 }}
          />
          {allTags.map(tag => (
            <Chip 
              key={tag} 
              label={`#${tag}`} 
              size="small" 
              clickable 
              color={selectedTag === tag ? 'primary' : 'default'} 
              variant={selectedTag === tag ? 'filled' : 'outlined'}
              onClick={() => setSelectedTag(selectedTag === tag ? 'All' : tag)}
              sx={{ fontWeight: 600, borderRadius: 1.5 }}
            />
          ))}
        </Box>
      )}

      {/* Pinned Favorites Section */}
      {pinnedItems.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon fontSize="small" /> Pinned Favorites ({pinnedItems.length})
          </Typography>
          <Grid container spacing={viewMode === 'list' ? 1.5 : 3}>
            {pinnedItems.map(item => renderItemCard(item, true))}
          </Grid>
        </Box>
      )}

      {/* Main Vault Items Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {pinnedItems.length > 0 && regularItems.length > 0 && (
          <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mt: 1 }}>
            All Vault Items ({regularItems.length})
          </Typography>
        )}
        <Grid container spacing={viewMode === 'list' ? 1.5 : 3}>
          {filteredItems.length === 0 ? (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="h3" sx={{ mb: 2 }}>📭</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{searchQuery || filterCategory !== 'All' || selectedTag !== 'All' ? 'No matching items' : 'Your vault is ready'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery || filterCategory !== 'All' || selectedTag !== 'All' ? 'Try a different search term or clear your filters.' : 'Add your first credential or import an existing encrypted backup to get started.'}
                </Typography>
                {searchQuery || filterCategory !== 'All' || selectedTag !== 'All' ? <Button variant="outlined" onClick={() => { setSearchQuery(''); setFilterCategory('All'); setSelectedTag('All'); }} sx={{ borderRadius: 2 }}>Clear filters</Button> : <Button variant="contained" onClick={handleOpenAdd} sx={{ borderRadius: 2, color: '#fff' }}>Add your first item</Button>}
              </Paper>
            </Grid>
          ) : (
            regularItems.map(item => renderItemCard(item, false))
          )}
        </Grid>
      </Box>

      {/* Live Camera Scanner Dialog */}
      <Dialog open={cameraActive} onClose={stopCameraScanner} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1, textAlign: 'center' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.15rem' }}>📷 Scan 2FA QR Code with Camera</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Point your webcam or phone camera at the 2FA barcode on screen.
          </Typography>

          {cameraError ? (
            <Alert severity="error">{cameraError}</Alert>
          ) : (
            <Box sx={{ position: 'relative', width: '100%', height: 260, bgcolor: '#000', borderRadius: 3, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline autoPlay muted />
              <Box sx={{ position: 'absolute', width: 180, height: 180, border: '2px dashed #10b981', borderRadius: 2, pointerEvents: 'none' }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={stopCameraScanner} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <ItemModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSave={async (item) => {
          await onSaveItem(item);
          setOpenModal(false);
        }}
        editingItem={editingItem}
        activeKey={activeKey}
        settings={settings}
        authenticatorItems={authenticatorItems}
      />

      {historyItem && (
        <PasswordHistoryModal
          open={Boolean(historyItem)}
          onClose={() => setHistoryItem(null)}
          item={historyItem}
          onRestoreOldPassword={handleRestoreOldPassword}
        />
      )}
    </Box>
  );
}
