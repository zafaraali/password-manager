import { enableDeviceUnlock } from './utils/deviceUnlock';
import { isAuthenticator, resolveAccounts, saveAccount, removeAccount } from './utils/accounts';
import { parseMigration, applyMigration } from './utils/migration';
import { verifyBackup } from './utils/backup';
import { parseLegacyAuthenticator, migrateAuthenticator } from './utils/authenticatorMigration';
import { vaultStorage, DATABASE_KEY } from './utils/storage';
import { VaultSession } from './utils/vaultSession';
import { pinSession } from './utils/pinSession';
import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Box, Button, Tabs, Tab, Snackbar, CircularProgress, Typography, Alert } from '@mui/material';
import Navbar from './components/Navbar';
import SetupView from './components/SetupView';
import UnlockView from './components/UnlockView';
const VaultDashboard = lazy(() => import('./components/VaultDashboard'));
const SecurityAuditorModal = lazy(() => import('./components/SecurityAuditorModal'));
const ExportModal = lazy(() => import('./components/ExportModal'));
const TrashModal = lazy(() => import('./components/TrashModal'));
const ProfileManagerModal = lazy(() => import('./components/ProfileManagerModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const AuthenticatorView = lazy(() => import('./components/AuthenticatorView'));
const ImportPreview = lazy(() => import('./components/ImportPreview'));
const SyncModal = lazy(() => import('./components/SyncModal'));
const ActivityLogModal = lazy(() => import('./components/ActivityLogModal'));
import { CryptoEngine } from './utils/crypto';
import { FeedbackProvider, useFeedback } from './components/FeedbackProvider';
import { getVaultHealth } from './utils/securityHealth';
import { generateSecurePassword } from './utils/passwordGenerator';

function AppContent() {
  const { notify, confirm, password, cancel } = useFeedback();
  const session = useRef(new VaultSession(vaultStorage));
  const [mode, setMode] = useState(() => localStorage.getItem('ciphervault_theme_mode') || 'dark');
  const [systemMode, setSystemMode] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [autoLockRemaining, setAutoLockRemaining] = useState(0);
  const [backupTimestamp, setBackupTimestamp] = useState(() => localStorage.getItem('ciphervault_last_backup_Default'));
  const effectiveMode = mode === 'system' ? systemMode : mode;

  useEffect(() => {
    localStorage.setItem('ciphervault_theme_mode', mode);
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = event => setSystemMode(event.matches ? 'dark' : 'light');
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [mode]);

  const [settings, setSettings] = useState({
    accentColor: '#6366f1',
    showNextCodeAuto: false,
    passwordLength: 16,
    genUppercase: true,
    genLowercase: true,
    genNumbers: true,
    genSymbols: true,
    clipboardTimeout: 30,
    autoLockMinutes: 10,
    lockOnBlur: false
  });

  const theme = useMemo(() => createTheme({
    palette: {
      mode: effectiveMode,
      primary: { main: settings.accentColor || '#6366f1' },
      secondary: { main: '#10b981', light: '#34d399', dark: '#059669' },
      background: {
        default: effectiveMode === 'dark' ? '#090d16' : '#f8fafc',
        paper: effectiveMode === 'dark' ? '#111827' : '#ffffff',
      },
      divider: effectiveMode === 'dark' ? '#1f2937' : '#e5e7eb',
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 700, letterSpacing: '-0.025em' },
      h6: { fontWeight: 600, letterSpacing: '-0.015em' },
    },
    components: {
      MuiCssBaseline: { styleOverrides: { body: { backgroundImage: effectiveMode === 'dark' ? 'radial-gradient(circle at 15% 0%, rgba(99,102,241,.12), transparent 34rem)' : 'radial-gradient(circle at 15% 0%, rgba(99,102,241,.08), transparent 34rem)', backgroundAttachment: 'fixed' }, '*:focus-visible': { outline: `3px solid ${settings.accentColor || '#6366f1'}`, outlineOffset: 2 } } },
      MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 650 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  }), [effectiveMode, settings.accentColor]);

  const [profiles, setProfiles] = useState(['Default']);
  const [currentProfile, setCurrentProfile] = useState('Default');

  useEffect(() => {
    setBackupTimestamp(localStorage.getItem('ciphervault_last_backup_' + currentProfile));
  }, [currentProfile]);

  const [view, setView] = useState('loading');
  const [initializing, setInitializing] = useState(true);
  const [key, setKey] = useState(null);
  const [vaultItems, setVaultItems] = useState([]);
  const [activity, setActivity] = useState([]);
  const auditSummary = useMemo(() => getVaultHealth(vaultItems), [vaultItems]);
  const [trashItems, setTrashItems] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [openAuditor, setOpenAuditor] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  const [openTrash, setOpenTrash] = useState(false);
  const [openProfileManager, setOpenProfileManager] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [incoming, setIncoming] = useState(null);
  const [openSync, setOpenSync] = useState(false);
  const [openActivity, setOpenActivity] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await vaultStorage.initialize();
        if (!active) return;
        const names = vaultStorage.names();
        setProfiles(names);
        const saved = localStorage.getItem('ciphervault_active_profile');
        const name = names.includes(saved) ? saved : names[0];
        setCurrentProfile(name);
        checkProfileState(name);
        const savedSettings = localStorage.getItem('ciphervault_settings');
        if (savedSettings) setSettings(current => ({ ...current, ...JSON.parse(savedSettings) }));
      } catch (error) { notify('Unable to open local vault storage: ' + error.message, 'error'); setView('storage_error'); }
      finally { if (active) setInitializing(false); }
    })();
    return () => { active = false; };
  }, []);

  const handleSaveSettings = (newSettings, persist = true) => {
    setSettings(newSettings);
    if (persist) {
      localStorage.setItem('ciphervault_settings', JSON.stringify(newSettings));
      setSuccessMsg('Vault preferences saved successfully!');
    }
  };

  const checkProfileState = (prof) => {
    const savedSalt = vaultStorage.get(prof)?.salt;
    const savedCipher = vaultStorage.get(prof)?.vault;
    if (!savedSalt || !savedCipher) {
      setView('setup');
    } else {
      setView('unlock');
    }
  };

  const clearSensitiveState = () => {
    session.current.lock();
    cancel();
    setKey(null); setVaultItems([]); setTrashItems([]); setActivity([]);
    setIncoming(null); setOpenSync(false);
    setOpenAuditor(false); setOpenExport(false); setOpenTrash(false); setOpenSettings(false);
  };

  const handleSwitchProfile = (newProf) => {
    clearSensitiveState();
    pinSession.clear();
    setCurrentProfile(newProf);
    localStorage.setItem('ciphervault_active_profile', newProf);
    setKey(null);
    setVaultItems([]);
    setTrashItems([]);
    checkProfileState(newProf);
  };

  const handleCreateProfile = async (name) => {
    try {
      await vaultStorage.create(name);
      setProfiles(vaultStorage.names());
      handleSwitchProfile(name);
      setOpenProfileManager(false);
    } catch (error) { notify(error.message, 'error'); }
  };

  const handleRenameProfile = async (oldName, newName) => {
    try {
      await vaultStorage.rename(oldName, newName);
      pinSession.clear();
      setProfiles(vaultStorage.names());
      if (currentProfile === oldName) handleSwitchProfile(newName);
    } catch (error) { notify(error.message, 'error'); }
  };

  const handleDeleteProfile = async (name) => {
    const epoch = session.current.epoch;
    try {
      const record = vaultStorage.get(name);
      if (vaultStorage.names().length <= 1) throw new Error('You must keep at least one profile.');
      if (record?.salt && record?.vault) localStorage.setItem('ciphervault_safety_backup_' + name, JSON.stringify({ format: 'ciphervault-backup', version: 1, profile: name, salt: record.salt, vault: record.vault, hint: record.hint || '', exportedAt: new Date().toISOString(), safety: true }));
      if (record?.vault) {
        const pw = await password({ title: 'Authorize profile deletion', message: 'Enter the master password for [' + name + '].' });
        if (!pw) return;
        const deleteKey = await CryptoEngine.deriveMasterKey(pw, record.salt);
        await CryptoEngine.decryptPayload(deleteKey, record.vault);
      }
      if (epoch !== session.current.epoch) return;
      if (!await confirm({ title: 'Delete profile permanently?', message: 'Delete [' + name + '] and its retained previous version? This cannot be undone.', confirmLabel: 'Delete profile', severity: 'error' })) return;
      await vaultStorage.remove(name, record.revision, () => epoch === session.current.epoch);
      pinSession.clear(name);
      const names = vaultStorage.names();
      setProfiles(names);
      if (currentProfile === name) handleSwitchProfile(names[0]);
    } catch (error) { notify('Deletion failed: ' + error.message, 'error'); }
  };

  const inactivityTimerRef = useRef(null);

  const resetInactivityTimer = () => {
    if (view === 'vault' || view === 'authenticator_only') {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      const timeoutMs = (settings.autoLockMinutes || 10) * 60 * 1000;
      setAutoLockRemaining(timeoutMs);
      inactivityTimerRef.current = setTimeout(() => {
        handleLockVault();
        setAutoLockRemaining(0);
        setSuccessMsg('Vault locked automatically due to inactivity.');
      }, timeoutMs);
    }
    else setAutoLockRemaining(0);
  };

  useEffect(() => {
    if (!['vault', 'authenticator_only'].includes(view)) return undefined;
    const interval = setInterval(() => setAutoLockRemaining(value => Math.max(0, value - 1000)), 1000);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach(event => window.addEventListener(event, handleActivity));
    resetInactivityTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [view, settings.autoLockMinutes]);

  useEffect(() => {
    if (!settings.lockOnBlur || !['vault', 'authenticator_only'].includes(view)) return undefined;
    const handleBlur = () => handleLockVault();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleBlur();
    };
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [view, settings.lockOnBlur]);

  // Global hotkeys (Ctrl+L to lock vault)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l' && ['vault', 'authenticator_only'].includes(view)) {
        e.preventDefault();
        handleLockVault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view]);

  const mutateVault = async (change, metadata, action = 'Updated vault') => {
    const epoch = session.current.epoch;
    const currentRecord = vaultStorage.get(currentProfile);
    if (currentRecord?.salt && currentRecord?.vault) {
      localStorage.setItem('ciphervault_safety_backup_' + currentProfile, JSON.stringify({ format: 'ciphervault-backup', version: 1, profile: currentProfile, salt: currentRecord.salt, vault: currentRecord.vault, hint: currentRecord.hint || '', exportedAt: new Date().toISOString(), safety: true }));
    }
    try {
      const payload = await session.current.mutate(async current => {
        const next = await change(current);
        return { ...next, activity: [...(next.activity || []), { id: crypto.randomUUID(), action, kind: 'Vault', profile: currentProfile, at: new Date().toISOString() }].slice(-100) };
      }, metadata);
      if (epoch !== session.current.epoch) throw new Error('Vault was locked.');
      setVaultItems(payload.items); setTrashItems(payload.trash); setActivity(payload.activity || []);
      return payload;
    } catch (error) { notify(error.message, 'error'); throw error; }
  };

  const handleSaveItem = async item => {
    await mutateVault(payload => saveAccount(payload, item), undefined, item.id ? `Updated ${item.name}` : `Created ${item.name}`);
    setSuccessMsg('Vault item saved successfully!');
  };
  const handleRepairItem = async item => {
    const password = generateSecurePassword();
    await mutateVault(payload => saveAccount(payload, { ...item, password, passwordUpdatedAt: new Date().toISOString() }), undefined, `Generated stronger password for ${item.name}`);
    notify(`Generated and saved a stronger password for ${item.name}.`, 'success');
  };
  const handleDeleteItem = id => mutateVault(payload => removeAccount(payload, id), undefined, 'Moved item to Trash');
  const handleRestoreItem = id => mutateVault(payload => {
    const item = payload.trash.find(i => i.id === id);
    if (item) { payload.trash = payload.trash.filter(i => i.id !== id); payload.items.push(item); }
    return payload;
  }, undefined, 'Restored item from Trash');
  const handleDeletePermanent = async id => {
    const epoch = session.current.epoch;
    if (!await confirm({ title: 'Delete permanently?', message: 'Remove this item from Trash?', confirmLabel: 'Delete', severity: 'error' })) return;
    if (epoch !== session.current.epoch) return;
    await mutateVault(payload => ({ ...payload, trash: payload.trash.filter(i => i.id !== id) }), undefined, 'Permanently deleted item');
  };
  const handleEmptyTrash = async () => {
    const epoch = session.current.epoch;
    if (!await confirm({ title: 'Empty Trash?', message: 'Remove all items from Trash?', confirmLabel: 'Empty Trash', severity: 'error' })) return;
    if (epoch !== session.current.epoch) return;
    await mutateVault(payload => ({ ...payload, trash: [] }), undefined, 'Emptied Trash');
  };
  const handleImportItems = data => {
    try { setIncoming(parseMigration(data)); } catch (error) { notify('Import failed: ' + error.message, 'error'); }
  };
  const handleImportTotpJson = data => handleImportItems(data);
  const handleSaveToken = (token, links) => mutateVault(payload => {
    payload = saveAccount(payload, token);
    if (links) for (const item of payload.items) {
      if (item.category !== 'Logins') continue;
      if (links.includes(item.id)) item.totpId = token.id;
      else if (item.totpId === token.id) delete item.totpId;
    }
    return payload;
  });
  const handleEnableDevice = async () => {
    const epoch = session.current.epoch;
    const deviceUnlock = await enableDeviceUnlock(key, currentProfile);
    if (epoch !== session.current.epoch) throw new Error('Vault was locked.');
    await mutateVault(payload => payload, { deviceUnlock });
  };

  const handleImportVaultJson = async backup => {
    const profile = currentProfile;
    const epoch = session.current.epoch;
    const record = vaultStorage.get(profile);
    try {
      if (backup?.format === 'ciphervault-expiring-share' && backup.expiresAt && Date.parse(backup.expiresAt) <= Date.now()) throw new Error('This share package has expired.');
      if (backup?.format === 'ciphervault-protected-export' || backup?.format === 'ciphervault-expiring-share') {
        const exportPassword = await password({ title: 'Protected export password', message: 'Enter the separate password used for this export.' });
        if (!exportPassword) return;
        if (typeof backup.kdf?.salt !== 'string' || backup.kdf?.iterations !== 600000) throw new Error('Unsupported backup KDF.');
        const exportKey = await CryptoEngine.deriveMasterKey(exportPassword, backup.kdf.salt);
        backup = JSON.parse(await CryptoEngine.decryptPayload(exportKey, backup.payload));
      }
      if (typeof backup?.salt !== 'string' || !backup?.vault) throw new Error('Invalid backup package.');
      const pw = await password({ title: 'Verify backup', message: 'Enter the original master password for the vault in this backup. The existing vault is kept until verification succeeds.' });
      if (!pw) return;
      const verified = await verifyBackup(backup, pw);
      if (!await confirm({ title: 'Replace current vault?', message: 'Replace [' + profile + '] with this verified backup? Its previous encrypted version will be retained locally.', confirmLabel: 'Replace vault', severity: 'warning' })) return;
      await vaultStorage.commit(profile, record.revision, () => verified.patch, () => session.current.epoch === epoch);
      pinSession.clear(profile);
      handleLockVault();
      notify('Verified backup imported. Unlock with its original master password.', 'success');
    } catch (error) { notify('Import failed: ' + error.message, 'error'); }
  };

  const handleLockVault = () => {
    clearSensitiveState();
    setView('unlock');
    setSuccessMsg('Vault locked.');
  };

  const handleUnlocked = (derivedKey, items = [], trash = [], revision, authenticator = false) => {
    const record = vaultStorage.get(currentProfile);
    if (record?.revision !== revision) { notify('Vault changed during unlock. Try again.', 'warning'); return; }
    session.current.start(currentProfile, derivedKey, { items, trash }, revision);
    setKey(derivedKey); setVaultItems(session.current.payload.items); setTrashItems(session.current.payload.trash); setActivity(session.current.payload.activity || []); setView(authenticator ? 'authenticator_only' : 'vault');
  };

  useEffect(() => {
    const changed = event => {
      if (event.key !== DATABASE_KEY && event.key !== null) return;
      const names = vaultStorage.names();
      setProfiles(names);
      const record = vaultStorage.get(currentProfile);
      if (!record) { handleSwitchProfile(names[0]); return; }
      if (session.current.key && record.revision !== session.current.revision) {
        pinSession.clear(currentProfile);
        handleLockVault();
        notify('Vault changed in another tab. Unlock again to load the latest version.', 'warning');
      }
    };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, [currentProfile]);

  const migrateLegacyAuthenticator = async () => {
    const raw = localStorage.getItem('ciphervault_standalone_2fa');
    if (!raw) { setView('authenticator_only'); return; }
    const epoch = session.current.epoch;
    try {
      const accounts = parseLegacyAuthenticator(raw);
      if (!await confirm({ title: 'Encrypt existing authenticator accounts?', message: 'Move ' + accounts.length + ' previously unencrypted accounts into [' + currentProfile + ']? The plaintext copy is removed only after a successful encrypted save.', confirmLabel: 'Encrypt accounts' })) return;
      if (epoch !== session.current.epoch) return;
      const payload = await migrateAuthenticator(session.current, localStorage, raw);
      if (epoch !== session.current.epoch) return;
      setVaultItems(payload.items); setTrashItems(payload.trash);
      setView('authenticator_only');
    } catch (error) { notify('Authenticator migration failed: ' + error.message, 'error'); }
  };

  useEffect(() => {
    if (key && localStorage.getItem('ciphervault_standalone_2fa')) migrateLegacyAuthenticator();
  }, [key]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <Navbar 
          mode={mode} 
          setMode={setMode} 
          unlocked={Boolean(key)} 
          onLock={handleLockVault}
          onOpenAuditor={() => setOpenAuditor(true)}
          onOpenExport={() => setOpenExport(true)}
          trashCount={trashItems.length}
          onOpenTrash={() => setOpenTrash(true)}
          profiles={profiles}
          currentProfile={currentProfile}
          onSwitchProfile={handleSwitchProfile}
          onOpenProfileManager={() => setOpenProfileManager(true)}
          onOpenSettings={() => setOpenSettings(true)}
          onOpenSync={() => setOpenSync(true)}
          backupTimestamp={backupTimestamp}
          autoLockRemaining={autoLockRemaining}
          onOpenActivity={() => setOpenActivity(true)}
          auditScore={auditSummary.score}
          auditIssueCount={auditSummary.issues}
          onLogoClick={() => {
            if (key) {
              setView('vault');
            } else {
              checkProfileState(currentProfile);
            }
          }}
        />

        <Container component="main" maxWidth="md" sx={{ mt: { xs: 2, sm: 4 }, mb: 4, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: key ? 'flex-start' : 'center' }}>
          {successMsg && (
            <Snackbar 
              open 
              autoHideDuration={4000} 
              onClose={() => setSuccessMsg('')} 
              message={successMsg} 
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
          )}
          {!online && <Alert severity="warning" sx={{ mb: 2 }}>You are offline. Your local vault still works, but breach checks, clock sync, and some QR scanning features may be unavailable.</Alert>}

          {key && <Box sx={{ mb: 3 }}><Tabs value={view === 'authenticator_only' ? 'authenticator_only' : 'vault'} onChange={(event, value) => setView(value)} aria-label="Vault sections">
            <Tab label="Vault" value="vault" /><Tab label="Authenticator" value="authenticator_only" />
          </Tabs><Button onClick={() => setOpenSync(true)} sx={{ mt: 1 }}>Device sync & backups</Button>
          {(!localStorage.getItem('ciphervault_last_backup_' + currentProfile) || Date.now() - new Date(localStorage.getItem('ciphervault_last_backup_' + currentProfile)).getTime() > 7 * 86400000) && <Alert severity="info" sx={{ mt: 1 }}>Keep a recent encrypted backup. Export one or upload a snapshot from Device sync & backups.</Alert>}
          </Box>}
          <Suspense fallback={<CircularProgress aria-label="Loading vault view" />}>
          {initializing || view === 'loading' ? (
            <Box sx={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <CircularProgress size={34} />
              <Typography color="text.secondary">Loading your vault…</Typography>
            </Box>
          ) : view === 'setup' ? (
            <SetupView key={currentProfile}
              profileName={currentProfile} 
              onSetupSuccess={handleUnlocked} 
            />
          ) : view === 'unlock' ? (
            <UnlockView key={currentProfile}
              profileName={currentProfile}
              profiles={profiles}
              onUnlockSuccess={handleUnlocked}
              onSwitchToSetup={() => { clearSensitiveState(); setView('setup'); }}
            />
          ) : view === 'authenticator_only' ? (
            <AuthenticatorView vaultItems={vaultItems} settings={settings} onSaveToken={handleSaveToken} onDeleteItem={handleDeleteItem} onImport={handleImportItems} />
          ) : view === 'storage_error' ? (<Alert severity="error">Unable to open vault storage. Check browser storage permissions and reload. Your existing data has been preserved.</Alert>) : view === 'vault' ? (
            <Box><VaultDashboard 
              vaultItems={resolveAccounts(vaultItems).filter(item => !isAuthenticator(item))}
              authenticatorItems={vaultItems.filter(isAuthenticator)}
              trashItems={trashItems}
              onSaveItem={handleSaveItem} 
              onDeleteItem={handleDeleteItem}
              onRestoreItem={handleRestoreItem}
              onDeletePermanent={handleDeletePermanent}
              profiles={profiles}
              currentProfile={currentProfile}
              onSwitchProfile={handleSwitchProfile}
              onCreateProfile={handleCreateProfile}
              onDeleteProfile={handleDeleteProfile}
              onImportTotpJson={handleImportTotpJson}
              onImportVaultJson={handleImportVaultJson}
              onImportItems={handleImportItems}
              activeKey={key}
              settings={settings}
            /></Box>
          ) : null}
          </Suspense>
        </Container>

        {key && <Suspense fallback={null}><SecurityAuditorModal
          open={openAuditor}
          onClose={() => setOpenAuditor(false)}
          vaultItems={resolveAccounts(vaultItems).filter(item => !isAuthenticator(item))}
          onRepairItem={handleRepairItem}
        /></Suspense>}

        {key && openExport && <Suspense fallback={null}><ExportModal
          open={openExport}
          onClose={() => setOpenExport(false)}
          profileName={currentProfile}
          vaultItems={vaultItems}
        /></Suspense>}

        {key && openTrash && <Suspense fallback={null}><TrashModal
          open={openTrash}
          onClose={() => setOpenTrash(false)}
          trashItems={trashItems}
          onRestore={handleRestoreItem}
          onDeletePermanent={handleDeletePermanent}
          onEmptyTrash={handleEmptyTrash}
        /></Suspense>}

        <Suspense fallback={null}><ProfileManagerModal
          open={openProfileManager}
          onClose={() => setOpenProfileManager(false)}
          profiles={profiles}
          currentProfile={currentProfile}
          onSwitchProfile={handleSwitchProfile}
          onCreateProfile={handleCreateProfile}
          onDeleteProfile={handleDeleteProfile}
          onRenameProfile={handleRenameProfile}
        /></Suspense>

        <Suspense fallback={null}><SettingsModal key={currentProfile + Boolean(key)}
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          currentProfile={currentProfile}
          onDeleteProfile={handleDeleteProfile}
          activeKey={key}
          deviceEnabled={Boolean(vaultStorage.get(currentProfile)?.deviceUnlock)}
          onEnableDevice={handleEnableDevice}
          onDisableDevice={() => mutateVault(payload => payload, { deviceUnlock: null })}
        /></Suspense>
        {key && incoming && <Suspense fallback={null}><ImportPreview incoming={incoming} existing={vaultItems} onClose={() => setIncoming(null)} onImport={skip => mutateVault(payload => applyMigration(payload, incoming, skip))} /></Suspense>}
        {key && openSync && <Suspense fallback={null}><SyncModal profile={currentProfile} storage={vaultStorage} activeKey={key} onRestore={handleImportVaultJson} onApplyMergedPayload={payload => mutateVault(() => payload)} onClose={() => setOpenSync(false)} isActive={() => Boolean(session.current.key)} onBackupRecorded={setBackupTimestamp} /></Suspense>}
        {key && <Suspense fallback={null}><ActivityLogModal open={openActivity} events={activity} onClose={() => setOpenActivity(false)} /></Suspense>}
      </Box>
    </ThemeProvider>
  );
}

export default function App() {
  return <FeedbackProvider><AppContent /></FeedbackProvider>;
}
