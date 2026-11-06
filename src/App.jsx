import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Container, Box, Snackbar } from '@mui/material';
import Navbar from './components/Navbar';
import SetupView from './components/SetupView';
import UnlockView from './components/UnlockView';
import VaultDashboard from './components/VaultDashboard';
import SecurityAuditorModal from './components/SecurityAuditorModal';
import ExportModal from './components/ExportModal';
import TrashModal from './components/TrashModal';
import ProfileManagerModal from './components/ProfileManagerModal';
import SettingsModal from './components/SettingsModal';
import { CryptoEngine } from './utils/crypto';

export default function App() {
  const [mode, setMode] = useState('dark');
  const theme = useMemo(() => createTheme({
    palette: {
      mode: mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      secondary: { main: '#10b981', light: '#34d399', dark: '#059669' },
      background: {
        default: mode === 'dark' ? '#090d16' : '#f8fafc',
        paper: mode === 'dark' ? '#111827' : '#ffffff',
      },
      divider: mode === 'dark' ? '#1f2937' : '#e5e7eb',
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 700, letterSpacing: '-0.025em' },
      h6: { fontWeight: 600, letterSpacing: '-0.015em' },
    },
  }), [mode]);

  const [profiles, setProfiles] = useState(['Default']);
  const [currentProfile, setCurrentProfile] = useState('Default');

  const [view, setView] = useState('loading');
  const [key, setKey] = useState(null);
  const [vaultItems, setVaultItems] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [openAuditor, setOpenAuditor] = useState(false);
  const [openExport, setOpenExport] = useState(false);
  const [openTrash, setOpenTrash] = useState(false);
  const [openProfileManager, setOpenProfileManager] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  const [settings, setSettings] = useState({
    showNextCodeAuto: false,
    passwordLength: 16,
    genUppercase: true,
    genLowercase: true,
    genNumbers: true,
    genSymbols: true,
    clipboardTimeout: 30,
    autoLockMinutes: 10
  });

  useEffect(() => {
    const savedProfiles = localStorage.getItem('ciphervault_profiles');
    let profList = ['Default'];
    if (savedProfiles) {
      try {
        profList = JSON.parse(savedProfiles);
      } catch (e) {}
    }
    setProfiles(profList);

    const savedSettings = localStorage.getItem('ciphervault_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {}
    }

    const activeProf = localStorage.getItem('ciphervault_active_profile') || 'Default';
    setCurrentProfile(activeProf);
    checkProfileState(activeProf);
  }, []);

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('ciphervault_settings', JSON.stringify(newSettings));
    setSuccessMsg('Vault preferences saved successfully!');
  };

  const checkProfileState = (prof) => {
    const pfx = prof === 'Default' ? '' : `_${prof}`;
    const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
    const savedCipher = localStorage.getItem(`ciphervault_vault${pfx}`);
    if (!savedSalt || !savedCipher) {
      setView('setup');
    } else {
      setView('unlock');
    }
  };

  const handleSwitchProfile = (newProf) => {
    setCurrentProfile(newProf);
    localStorage.setItem('ciphervault_active_profile', newProf);
    setKey(null);
    setVaultItems([]);
    setTrashItems([]);
    checkProfileState(newProf);
  };

  const handleCreateProfile = (name) => {
    if (profiles.includes(name)) {
      alert('Profile already exists.');
      return;
    }
    const updated = [...profiles, name];
    setProfiles(updated);
    localStorage.setItem('ciphervault_profiles', JSON.stringify(updated));
    handleSwitchProfile(name);
    setOpenProfileManager(false);
    setSuccessMsg(`Created and switched to profile [${name}]`);
  };

  const handleDeleteProfile = (name) => {
    if (profiles.length <= 1) {
      alert('You must have at least one profile.');
      return;
    }
    if (confirm(`Are you sure you want to delete profile [${name}] and all its data?`)) {
      const pfx = name === 'Default' ? '' : `_${name}`;
      localStorage.removeItem(`ciphervault_salt${pfx}`);
      localStorage.removeItem(`ciphervault_vault${pfx}`);
      localStorage.removeItem(`ciphervault_recovery${pfx}`);
      localStorage.removeItem(`ciphervault_hint${pfx}`);

      const updated = profiles.filter(p => p !== name);
      setProfiles(updated);
      localStorage.setItem('ciphervault_profiles', JSON.stringify(updated));
      handleSwitchProfile(updated[0]);
      setSuccessMsg(`Profile [${name}] deleted.`);
    }
  };

  const inactivityTimerRef = useRef(null);

  const resetInactivityTimer = () => {
    if (view === 'vault') {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      const timeoutMs = (settings.autoLockMinutes || 10) * 60 * 1000;
      inactivityTimerRef.current = setTimeout(() => {
        handleLockVault();
        setSuccessMsg('Vault locked automatically due to inactivity.');
      }, timeoutMs);
    }
  };

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

  const pfx = currentProfile === 'Default' ? '' : `_${currentProfile}`;

  const saveVaultToLocalStorage = async (updatedItems, updatedTrash, activeKey) => {
    const k = activeKey || key;
    const payload = { items: updatedItems, trash: updatedTrash };
    const encrypted = await CryptoEngine.encryptPayload(k, JSON.stringify(payload));
    localStorage.setItem(`ciphervault_vault${pfx}`, JSON.stringify(encrypted));
    setVaultItems(updatedItems);
    setTrashItems(updatedTrash);
  };

  const handleSaveItem = async (newItem) => {
    let updated = [...vaultItems];
    const index = updated.findIndex(i => i.id === newItem.id);
    if (index >= 0) {
      updated[index] = newItem;
    } else {
      updated.push(newItem);
    }
    await saveVaultToLocalStorage(updated, trashItems);
    setSuccessMsg('Vault item saved successfully!');
  };

  const handleDeleteItem = async (id) => {
    const itemToDelete = vaultItems.find(i => i.id === id);
    if (!itemToDelete) return;
    const updatedVault = vaultItems.filter(item => item.id !== id);
    const updatedTrash = [...trashItems, itemToDelete];
    await saveVaultToLocalStorage(updatedVault, updatedTrash);
    setSuccessMsg('Item moved to trash.');
  };

  const handleRestoreItem = async (id) => {
    const itemToRestore = trashItems.find(i => i.id === id);
    if (!itemToRestore) return;
    const updatedTrash = trashItems.filter(item => item.id !== id);
    const updatedVault = [...vaultItems, itemToRestore];
    await saveVaultToLocalStorage(updatedVault, updatedTrash);
    setSuccessMsg('Item restored from trash.');
  };

  const handleDeletePermanent = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this item?')) return;
    const updatedTrash = trashItems.filter(item => item.id !== id);
    await saveVaultToLocalStorage(vaultItems, updatedTrash);
    setSuccessMsg('Item permanently deleted.');
  };

  const handleImportTotpJson = async (data) => {
    try {
      let importedCount = 0;
      let newItems = [...vaultItems];
      const accounts = Array.isArray(data) ? data : (data.accounts || data.items || []);
      
      accounts.forEach(acc => {
        const name = acc.name || acc.issuer || 'Imported Account';
        const secret = acc.secret || acc.key || '';
        const username = acc.username || acc.email || '';
        if (secret) {
          newItems.push({
            id: Date.now().toString() + Math.random(),
            name: name,
            username: username,
            password: '',
            category: 'Logins',
            totpSecret: secret,
            attachment: null,
            templateData: {},
            notes: 'Imported via Google Auth QR / 2FAS'
          });
          importedCount++;
        }
      });

      if (importedCount > 0) {
        await saveVaultToLocalStorage(newItems, trashItems);
        setSuccessMsg(`Successfully imported ${importedCount} 2FA accounts!`);
      } else {
        alert('No valid accounts found.');
      }
    } catch (err) {
      alert('Import error: ' + err.message);
    }
  };

  const handleImportVaultJson = async (backup) => {
    try {
      localStorage.setItem(`ciphervault_salt${pfx}`, backup.salt);
      localStorage.setItem(`ciphervault_vault${pfx}`, JSON.stringify(backup.vault));
      if (backup.hint) localStorage.setItem(`ciphervault_hint${pfx}`, backup.hint);
      if (backup.recovery) localStorage.setItem(`ciphervault_recovery${pfx}`, backup.recovery);
      alert('Vault backup imported successfully! Please unlock with your master password.');
      window.location.reload();
    } catch (err) {
      alert('Failed to import vault backup: ' + err.message);
    }
  };

  const handleLockVault = () => {
    setKey(null);
    setVaultItems([]);
    setTrashItems([]);
    setView('unlock');
    setSuccessMsg('Vault locked successfully.');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        <Navbar 
          mode={mode} 
          setMode={setMode} 
          unlocked={view === 'vault'} 
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
        />

        <Container component="main" maxWidth="md" sx={{ mt: 6, mb: 6, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {successMsg && (
            <Snackbar 
              open 
              autoHideDuration={4000} 
              onClose={() => setSuccessMsg('')} 
              message={successMsg} 
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
          )}

          {view === 'setup' && (
            <SetupView profileName={currentProfile} onSetupSuccess={() => {
              const savedSalt = localStorage.getItem(`ciphervault_salt${pfx}`);
              const savedCipher = localStorage.getItem(`ciphervault_vault${pfx}`);
              CryptoEngine.deriveMasterKey(localStorage.getItem('ciphervault_temp_pw') || '', savedSalt).then(async k => {
                const dec = await CryptoEngine.decryptPayload(k, JSON.parse(savedCipher));
                const parsed = JSON.parse(dec);
                setKey(k);
                setVaultItems(parsed.items || []);
                setTrashItems(parsed.trash || []);
                setView('vault');
              }).catch(() => {
                setView('unlock');
              });
            }} />
          )}

          {view === 'unlock' && (
            <UnlockView 
              profileName={currentProfile}
              onUnlockSuccess={(derivedKey, items, trash) => {
                setKey(derivedKey);
                setVaultItems(items);
                setTrashItems(trash);
                setView('vault');
              }}
              onSwitchToSetup={() => setView('setup')}
            />
          )}

          {view === 'vault' && (
            <VaultDashboard 
              vaultItems={vaultItems}
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
              activeKey={key}
              settings={settings}
            />
          )}
        </Container>

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
          onRestore={handleRestoreItem}
          onDeletePermanent={handleDeletePermanent}
        />

        <ProfileManagerModal
          open={openProfileManager}
          onClose={() => setOpenProfileManager(false)}
          profiles={profiles}
          currentProfile={currentProfile}
          onSwitchProfile={handleSwitchProfile}
          onCreateProfile={handleCreateProfile}
          onDeleteProfile={handleDeleteProfile}
        />

        <SettingsModal
          open={openSettings}
          onClose={() => setOpenSettings(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
        />
      </Box>
    </ThemeProvider>
  );
}
