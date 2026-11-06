import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import Navbar from './components/Navbar';
import SetupView from './components/SetupView';
import UnlockView from './components/UnlockView';
import ProfileSelectionView from './components/ProfileSelectionView';
import VaultDashboard from './components/VaultDashboard';
import ItemModal from './components/ItemModal';
import SecurityAuditorModal from './components/SecurityAuditorModal';
import ExportModal from './components/ExportModal';
import TrashModal from './components/TrashModal';
import ProfileManagerModal from './components/ProfileManagerModal';
import SettingsModal from './components/SettingsModal';
import PasswordHistoryModal from './components/PasswordHistoryModal';
import AuthenticatorOnlyView from './components/AuthenticatorOnlyView';
import TOTPWidget from './components/TOTPWidget';
import { encryptData, decryptData } from './utils/crypto';

export default function App() {
  const getStoredProfiles = () => {
    try {
      return JSON.parse(localStorage.getItem('ciphervault_profiles')) || [];
    } catch {
      return [];
    }
  };

  const [profiles, setProfiles] = useState(getStoredProfiles);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [viewState, setViewState] = useState(() => {
    const list = getStoredProfiles();
    return list.length > 0 ? 'select_profile' : 'setup';
  });

  const [masterPassword, setMasterPassword] = useState('');
  const [vaultItems, setVaultItems] = useState([]);

  const [mode, setMode] = useState('dark');
  const [resolvedMode, setResolvedMode] = useState('dark');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [useGradient, setUseGradient] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState(0);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedQRItem, setSelectedQRItem] = useState(null);
  const [isAuthenticatorViewOpen, setIsAuthenticatorViewOpen] = useState(false);

  useEffect(() => {
    if (mode === 'system') {
      const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateSystemMode = (e) => setResolvedMode(e.matches ? 'dark' : 'light');
      setResolvedMode(darkQuery.matches ? 'dark' : 'light');
      darkQuery.addEventListener('change', updateSystemMode);
      return () => darkQuery.removeEventListener('change', updateSystemMode);
    } else {
      setResolvedMode(mode);
    }
  }, [mode]);

  // Auto-lock inactivity timer
  useEffect(() => {
    if (viewState !== 'unlocked' || autoLockMinutes <= 0) return;
    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLock();
      }, autoLockMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [viewState, autoLockMinutes]);

  const theme = createTheme({
    palette: {
      mode: resolvedMode,
      primary: {
        main: accentColor
      },
      background: {
        default: resolvedMode === 'dark' ? '#0f172a' : '#f8fafc',
        paper: resolvedMode === 'dark' ? '#1e293b' : '#ffffff'
      }
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
    }
  });

  const handleSetup = async (newUsername, password) => {
    const cleanUser = newUsername.trim();
    if (profiles.includes(cleanUser)) {
      alert(`Profile "${cleanUser}" already exists! Please choose another name or unlock the existing profile.`);
      return;
    }
    const emptyVault = [];
    const encrypted = await encryptData(emptyVault, password);
    const updatedProfiles = [...profiles, cleanUser];
    
    localStorage.setItem('ciphervault_profiles', JSON.stringify(updatedProfiles));
    localStorage.setItem(`ciphervault_data_${cleanUser}`, JSON.stringify(encrypted));
    
    setProfiles(updatedProfiles);
    setSelectedUsername(cleanUser);
    setMasterPassword(password);
    setVaultItems(emptyVault);
    setViewState('unlocked');
  };

  const handleSelectProfile = (profile) => {
    setSelectedUsername(profile);
    setViewState('unlock');
  };

  const handleUnlock = (password) => {
    try {
      const storedData = JSON.parse(localStorage.getItem(`ciphervault_data_${selectedUsername}`));
      if (!storedData) return false;
      decryptData(storedData, password).then(decrypted => {
        setMasterPassword(password);
        setVaultItems(decrypted);
        setViewState('unlocked');
      }).catch(() => {
        alert('Incorrect master password.');
      });
      return true;
    } catch (err) {
      return false;
    }
  };

  const handleLock = () => {
    setMasterPassword('');
    setVaultItems([]);
    setViewState('unlock');
  };

  const handleSwitchProfile = () => {
    setMasterPassword('');
    setVaultItems([]);
    setSelectedUsername('');
    setViewState(profiles.length > 0 ? 'select_profile' : 'setup');
  };

  const saveVaultChanges = async (newItems) => {
    setVaultItems(newItems);
    try {
      const encrypted = await encryptData(newItems, masterPassword);
      localStorage.setItem(`ciphervault_data_${selectedUsername}`, JSON.stringify(encrypted));
    } catch (err) {
      console.error('Failed to save vault:', err);
    }
  };

  const handleSaveItem = (item) => {
    const exists = vaultItems.some(i => i.id === item.id);
    let updated;
    if (exists) {
      updated = vaultItems.map(i => i.id === item.id ? item : i);
    } else {
      updated = [item, ...vaultItems];
    }
    saveVaultChanges(updated);
  };

  const handleDeleteItem = (id) => {
    const updated = vaultItems.filter(i => i.id !== id);
    saveVaultChanges(updated);
  };

  const handleDeleteProfile = (profileToDelete) => {
    if (window.confirm(`Are you sure you want to delete profile "${profileToDelete}" and all its vault data?`)) {
      const updatedProfiles = profiles.filter(p => p !== profileToDelete);
      localStorage.setItem('ciphervault_profiles', JSON.stringify(updatedProfiles));
      localStorage.removeItem(`ciphervault_data_${profileToDelete}`);
      setProfiles(updatedProfiles);
      if (selectedUsername === profileToDelete) {
        setSelectedUsername('');
        setViewState(updatedProfiles.length > 0 ? 'select_profile' : 'setup');
      }
    }
  };

  const handleRenameProfile = (newUsername) => {
    const cleanUser = newUsername.trim();
    if (!cleanUser || cleanUser === selectedUsername) return;
    if (profiles.includes(cleanUser)) {
      alert(`Profile name "${cleanUser}" is already taken.`);
      return;
    }
    const data = localStorage.getItem(`ciphervault_data_${selectedUsername}`);
    const updatedProfiles = profiles.map(p => p === selectedUsername ? cleanUser : p);
    
    localStorage.setItem('ciphervault_profiles', JSON.stringify(updatedProfiles));
    localStorage.setItem(`ciphervault_data_${cleanUser}`, data);
    localStorage.removeItem(`ciphervault_data_${selectedUsername}`);

    setProfiles(updatedProfiles);
    setSelectedUsername(cleanUser);
  };

  const handleDeleteCurrentVault = (password) => {
    try {
      const storedData = JSON.parse(localStorage.getItem(`ciphervault_data_${selectedUsername}`));
      decryptData(storedData, password).then(() => {
        handleDeleteProfile(selectedUsername);
        setIsProfileOpen(false);
      }).catch(() => {
        alert('Incorrect master password.');
      });
      return true;
    } catch (err) {
      return false;
    }
  };

  const backgroundStyle = useGradient ? {
    background: resolvedMode === 'dark'
      ? 'radial-gradient(circle at 20% 20%, #312e81 0%, #1e1b4b 40%, #0f172a 90%)'
      : 'radial-gradient(circle at 20% 20%, #e0e7ff 0%, #c7d2fe 45%, #f8fafc 90%)'
  } : {
    bgcolor: 'background.default'
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', ...backgroundStyle }}>
        {viewState === 'setup' ? (
          <SetupView onSetup={handleSetup} />
        ) : viewState === 'select_profile' ? (
          <ProfileSelectionView
            profiles={profiles}
            onSelectProfile={handleSelectProfile}
            onCreateNewProfile={() => setViewState('setup')}
            onDeleteProfile={handleDeleteProfile}
          />
        ) : viewState === 'unlock' ? (
          <UnlockView
            username={selectedUsername}
            onUnlock={handleUnlock}
            onResetVault={() => handleSwitchProfile()}
          />
        ) : (
          <>
            <Navbar
              username={selectedUsername}
              mode={resolvedMode}
              setMode={setMode}
              onLock={handleLock}
              onSwitchProfile={handleSwitchProfile}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenAuditor={() => setIsAuditorOpen(true)}
              onOpenExport={() => setIsExportOpen(true)}
              onOpenTrash={() => setIsTrashOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
              onOpenAuthenticatorView={() => setIsAuthenticatorViewOpen(true)}
              accentColor={accentColor}
            />

            {isAuthenticatorViewOpen ? (
              <AuthenticatorOnlyView vaultItems={vaultItems} onBack={() => setIsAuthenticatorViewOpen(false)} />
            ) : (
              <VaultDashboard
                vaultItems={vaultItems}
                onAddItem={() => { setEditingItem(null); setIsItemModalOpen(true); }}
                onEditItem={(item) => { setEditingItem(item); setIsItemModalOpen(true); }}
                onDeleteItem={handleDeleteItem}
                onOpenHistory={(item) => { setEditingItem(item); setIsHistoryOpen(true); }}
                onOpenQR={(item) => { setSelectedQRItem(item); setIsQROpen(true); }}
              />
            )}

            <ItemModal
              open={isItemModalOpen}
              onClose={() => setIsItemModalOpen(false)}
              onSave={handleSaveItem}
              editingItem={editingItem}
            />

            <SecurityAuditorModal
              open={isAuditorOpen}
              onClose={() => setIsAuditorOpen(false)}
              vaultItems={vaultItems}
            />

            <ExportModal
              open={isExportOpen}
              onClose={() => setIsExportOpen(false)}
              vaultItems={vaultItems}
              onImport={(imported) => saveVaultChanges([...imported, ...vaultItems])}
            />

            <TrashModal
              open={isTrashOpen}
              onClose={() => setIsTrashOpen(false)}
            />

            <ProfileManagerModal
              open={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              username={selectedUsername}
              onRenameProfile={handleRenameProfile}
              onDeleteVault={handleDeleteCurrentVault}
            />

            <SettingsModal
              open={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              mode={mode}
              setMode={setMode}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              useGradient={useGradient}
              setUseGradient={setUseGradient}
              autoLockMinutes={autoLockMinutes}
              setAutoLockMinutes={setAutoLockMinutes}
            />

            <PasswordHistoryModal
              open={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
              selectedItem={editingItem}
            />

            <TOTPWidget
              open={isQROpen}
              onClose={() => setIsQROpen(false)}
              selectedItem={selectedQRItem}
            />
          </>
        )}
      </Box>
    </ThemeProvider>
  );
}
