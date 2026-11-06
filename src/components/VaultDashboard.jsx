import React, { useState, useEffect, useRef } from 'react';
import { 
  Paper, Typography, Button, Box, Tabs, Tab, TextField, Grid, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress
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
import { copyToClipboard } from '../utils/clipboard';

export default function VaultDashboard({ 
  vaultItems = [], trashItems = [], onSaveItem, onDeleteItem, onRestoreItem, onDeletePermanent,
  profiles, currentProfile, onSwitchProfile, onCreateProfile, onDeleteProfile, onImportTotpJson,
  onImportVaultJson, onImportItems, activeKey, settings
}) {
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

  // Live Camera QR Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const searchInputRef = useRef(null);
  const clipboardTimerRef = useRef(null);

  useEffect(() => () => clearInterval(clipboardTimerRef.current), []);

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
    await onSaveItem(updated);
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
      setCopiedMsg(`Copied [${item.name}]! Auto-clearing in ${timeoutSec}s.`);
      
      setTimeout(async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText('');
          }
        } catch (err) {}
      }, timeoutSec * 1000);
    } catch (err) {
      alert('Failed to copy to clipboard: ' + err.message);
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
        setClipboardRemaining(timeoutSec);
        setCopiedMsg(`${label} copied · clears in ${timeoutSec}s`);
        clipboardTimerRef.current = setInterval(() => setClipboardRemaining(value => {
          if (value <= 1) {
            clearInterval(clipboardTimerRef.current);
            copyToClipboard('');
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
      alert('Failed to decrypt and download attachment: ' + err.message);
    }
  };

  // Unified Importer: Handles CipherVault backups, Bitwarden JSON exports, and 2FAS JSON backups
  const handleVaultJsonImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // 1. Native CipherVault backup
        if (data.salt && data.vault) {
          onImportVaultJson(data);
          return;
        }

        // 2. Bitwarden Export format
        if (data.items && Array.isArray(data.items)) {
          const typeMap = { 1: 'Logins', 2: 'Notes', 3: 'Cards', 4: 'Identities' };
          const converted = data.items.map(bi => {
            let totpSecret = '';
            if (bi.login?.totp) {
              const parsed = TOTP.parseOtpAuthUrl(bi.login.totp);
              totpSecret = parsed.secret || bi.login.totp;
            }
            return {
              id: Date.now().toString() + Math.random(),
              name: bi.name || 'Bitwarden Item',
              username: bi.login?.username || '',
              password: bi.login?.password || '',
              category: typeMap[bi.type] || 'Logins',
              website: bi.login?.uris?.[0]?.uri || '',
              favorite: Boolean(bi.favorite),
              totpSecret: totpSecret,
              notes: bi.notes || '',
              tags: [],
              customFields: [],
              attachment: null,
              templateData: {},
              passwordHistory: [],
              passwordUpdatedAt: new Date().toISOString()
            };
          });

          if (onImportItems) {
            onImportItems(converted, 'Bitwarden items');
          } else {
            converted.forEach(item => onSaveItem(item));
          }
          return;
        }

        // 3. 2FAS Backup format
        if (data.services && Array.isArray(data.services)) {
          const accounts = TOTP.parse2FasJson(data);
          const converted = accounts.map(acc => ({
            id: Date.now().toString() + Math.random(),
            name: acc.name,
            username: acc.username,
            password: '',
            category: 'Logins',
            website: '',
            favorite: false,
            tags: ['2FAS'],
            customFields: [],
            totpSecret: acc.secret,
            notes: 'Imported from 2FAS backup',
            attachment: null,
            templateData: {},
            passwordHistory: [],
            passwordUpdatedAt: new Date().toISOString()
          }));

          if (onImportItems) {
            onImportItems(converted, '2FAS accounts');
          } else {
            converted.forEach(item => onSaveItem(item));
          }
          return;
        }

        // 4. Raw array of items
        if (Array.isArray(data)) {
          if (onImportItems) {
            onImportItems(data, 'vault items');
          } else {
            data.forEach(item => onSaveItem(item));
          }
          return;
        }

        throw new Error('Unrecognized JSON format. Expected CipherVault backup, Bitwarden export, or 2FAS export.');
      } catch (err) {
        alert('Import error: ' + err.message);
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
                  } else if (qrText.startsWith('otpauth://')) {
                    const parsed = TOTP.parseOtpAuthUrl(qrText);
                    onImportTotpJson([{ name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
                    return;
                  }
                }
              } catch (err) {}
            }

            const manualUrl = prompt('Could not auto-scan QR from screenshot in this browser. Please paste the otpauth:// or otpauth-migration:// URL, or raw secret:');
            if (manualUrl) {
              if (manualUrl.startsWith('otpauth-migration://')) {
                const accounts = TOTP.parseGoogleMigrationUrl(manualUrl);
                onImportTotpJson({ accounts });
              } else if (manualUrl.startsWith('otpauth://')) {
                const parsed = TOTP.parseOtpAuthUrl(manualUrl);
                onImportTotpJson([{ name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
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
        if (data.services) {
          const accounts = TOTP.parse2FasJson(data);
          onImportTotpJson({ accounts });
        } else {
          onImportTotpJson(data);
        }
      } catch (err) {
        alert('Failed to parse 2FA file: ' + err.message);
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
              onImportTotpJson([{ name: parsed.issuer || parsed.account, username: parsed.account, secret: parsed.secret }]);
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
  const filteredItems = vaultItems.filter(item => {
    const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
    const matchesTag = selectedTag === 'All' || (item.tags && item.tags.includes(selectedTag));
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.username && item.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.website && item.website.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (item.tags && item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesTag && matchesSearch;
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
      <Grid item xs={12} sm={6} key={item.id}>
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
                <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: .75 }}>🔑 Passkey / WebAuthn credential</Typography>
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
                  onClick={() => setShowPasswordMap(prev => ({ ...prev, [item.id]: !prev[item.id] }))} 
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
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Action Bar */}
      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 4, border: 1, borderColor: 'divider', background: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Vault Dashboard [{currentProfile}]</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>🛡️ {vaultItems.length} secure item{vaultItems.length === 1 ? '' : 's'} stored locally.</span>
            {copiedMsg && <Box component="span" sx={{ color: 'secondary.main', fontWeight: 600, ml: 1 }}>{copiedMsg}</Box>}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
            📥 Import JSON / Bitwarden / 2FAS
            <input type="file" hidden accept=".json" onChange={handleVaultJsonImport} />
          </Button>
          <Button variant="outlined" component="label" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
            📷 Import 2FA
            <input type="file" hidden accept=".json,image/*" onChange={handleAuthImport} />
          </Button>
          <Button variant="outlined" startIcon={<CameraAltIcon />} onClick={startCameraScanner} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, px: 2 }}>
            Scan Camera QR
          </Button>
          <Button variant="contained" size="large" onClick={handleOpenAdd} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff', px: 3, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
            + Add Item
          </Button>
        </Box>
      </Paper>

      {/* Category Pills & Search */}
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
          inputRef={searchInputRef}
          size="small"
          placeholder="Search (Ctrl+K or /)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon fontSize="small" color="action" sx={{ mr: 1 }} />
            ),
          }}
          sx={{ width: { xs: '100%', sm: '280px' }, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
        />
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
          <Grid container spacing={3}>
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
        <Grid container spacing={3}>
          {filteredItems.length === 0 ? (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
                <Typography variant="h3" sx={{ mb: 2 }}>📭</Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>No vault items found</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Add your credentials, import your Bitwarden or 2FAS backup, or adjust your search filter.
                </Typography>
                <Button variant="contained" onClick={handleOpenAdd} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, color: '#fff' }}>
                  + Add Item Now
                </Button>
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
    </Box>
  );
}
