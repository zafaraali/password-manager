const fs = require('fs');
const edit = (file, fn) => fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')));
edit('src/utils/vaultSession.js', s => "import { normalizeAccounts } from './accounts.js';\n" + s.replace('this.payload = validateVault(payload);', 'this.payload = normalizeAccounts(validateVault(payload));').replace('mutate(change) {', 'mutate(change, metadata = {}) {').replace('return { vault: await', 'return { ...metadata, vault: await'));
edit('src/utils/storage.js', s => s.replace('        if (old.vault) next.previous', "        if (patch.salt && patch.salt !== old.salt) delete next.deviceUnlock;\n        if (old.vault) next.previous"));
edit('src/App.jsx', s => {
  s = "import { enableDeviceUnlock } from './utils/deviceUnlock';\nimport { isAuthenticator, resolveAccounts, saveAccount, removeAccount } from './utils/accounts';\nimport { parseMigration, applyMigration } from './utils/migration';\n" + s;
  s = s.replace('Box, Button, Snackbar,', 'Box, Button, Tabs, Tab, Snackbar,');
  s = s.replace("const AuthenticatorOnlyView = lazy(() => import('./components/AuthenticatorOnlyView'));", "const AuthenticatorView = lazy(() => import('./components/AuthenticatorView'));\nconst ImportPreview = lazy(() => import('./components/ImportPreview'));\nconst SyncModal = lazy(() => import('./components/SyncModal'));");
  s = s.replace("  const [openSettings, setOpenSettings] = useState(false);", "  const [openSettings, setOpenSettings] = useState(false);\n  const [incoming, setIncoming] = useState(null);\n  const [openSync, setOpenSync] = useState(false);");
  s = s.replace('    setKey(null); setVaultItems([]); setTrashItems([]);', '    setKey(null); setVaultItems([]); setTrashItems([]);\n    setIncoming(null); setOpenSync(false);');
  s = s.replace('const mutateVault = async change =>', 'const mutateVault = async (change, metadata) =>').replace('session.current.mutate(change);', 'session.current.mutate(change, metadata);');
  const a = s.indexOf('    await mutateVault(payload => {', s.indexOf('  const handleSaveItem'));
  const b = s.indexOf("    setSuccessMsg('Vault item saved successfully!');", a);
  s = s.slice(0, a) + '    await mutateVault(payload => saveAccount(payload, item));\n' + s.slice(b);
  const c = s.indexOf('  const handleDeleteItem =');
  const d = s.indexOf('  const handleRestoreItem', c);
  s = s.slice(0, c) + '  const handleDeleteItem = id => mutateVault(payload => removeAccount(payload, id));\n' + s.slice(d);
  const e = s.indexOf('  const handleImportItems =');
  const f = s.indexOf('  const handleImportVaultJson =', e);
  s = s.slice(0, e) + `  const handleImportItems = data => {
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

` + s.slice(f);
  s = s.replace('    setKey(derivedKey); setVaultItems(items); setTrashItems(trash);', '    setKey(derivedKey); setVaultItems(session.current.payload.items); setTrashItems(session.current.payload.trash);');
  s = s.replace('          <Suspense fallback={<CircularProgress aria-label="Loading vault view" />}>', `          {key && <Box sx={{ mb: 3 }}><Tabs value={view === 'authenticator_only' ? 'authenticator_only' : 'vault'} onChange={(event, value) => setView(value)} aria-label="Vault sections">
            <Tab label="Vault" value="vault" /><Tab label="Authenticator" value="authenticator_only" />
          </Tabs><Button onClick={() => setOpenSync(true)} sx={{ mt: 1 }}>Device sync & backups</Button>
          {(!localStorage.getItem('ciphervault_last_backup_' + currentProfile) || Date.now() - new Date(localStorage.getItem('ciphervault_last_backup_' + currentProfile)).getTime() > 7 * 86400000) && <Alert severity="info" sx={{ mt: 1 }}>Keep a recent encrypted backup. Export one or upload a snapshot from Device sync & backups.</Alert>}
          </Box>}
          <Suspense fallback={<CircularProgress aria-label="Loading vault view" />}>`);
  const g = s.indexOf('            <AuthenticatorOnlyView');
  const h = s.indexOf("          ) : view === 'storage_error'", g);
  s = s.slice(0, g) + `            <AuthenticatorView vaultItems={vaultItems} settings={settings} onSaveToken={handleSaveToken} onDeleteItem={handleDeleteItem} onImport={handleImportItems} />
` + s.slice(h);
  s = s.replace('<Box><Button variant="outlined" onClick={migrateLegacyAuthenticator} sx={{ mb: 2 }}>Open encrypted 2FA authenticator</Button><VaultDashboard', '<Box><VaultDashboard');
  s = s.replace('              vaultItems={vaultItems}', '              vaultItems={resolveAccounts(vaultItems).filter(item => !isAuthenticator(item))}\n              authenticatorItems={vaultItems.filter(isAuthenticator)}');
  s = s.replace('          vaultItems={vaultItems}\n        /></Suspense>}', '          vaultItems={resolveAccounts(vaultItems)}\n        /></Suspense>}');
  s = s.replace('          profileName={currentProfile}\n          vaultItems={resolveAccounts(vaultItems)}', '          profileName={currentProfile}\n          vaultItems={vaultItems}');
  s = s.replace('          activeKey={key}\n        /></Suspense>', `          activeKey={key}
          deviceEnabled={Boolean(vaultStorage.get(currentProfile)?.deviceUnlock)}
          onEnableDevice={handleEnableDevice}
          onDisableDevice={() => mutateVault(payload => payload, { deviceUnlock: null })}
        /></Suspense>`);
  s = s.replace('      </Box>\n    </ThemeProvider>', `        {key && incoming && <Suspense fallback={null}><ImportPreview incoming={incoming} existing={vaultItems} onClose={() => setIncoming(null)} onImport={skip => mutateVault(payload => applyMigration(payload, incoming, skip))} /></Suspense>}
        {key && openSync && <Suspense fallback={null}><SyncModal profile={currentProfile} storage={vaultStorage} activeKey={key} onRestore={handleImportVaultJson} onClose={() => setOpenSync(false)} isActive={() => Boolean(session.current.key)} /></Suspense>}
      </Box>
    </ThemeProvider>`);
  return s;
});
edit('src/components/VaultDashboard.jsx', s => {
  s = s.replace('onImportVaultJson, onImportItems, activeKey, settings', 'onImportVaultJson, onImportItems, activeKey, settings, authenticatorItems = []');
  const a = s.indexOf('  const handleVaultJsonImport =');
  const b = s.indexOf('\n  const ', a + 10);
  s = s.slice(0, a) + `  const handleVaultJsonImport = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if ((data.salt && data.vault) || data.format === 'ciphervault-protected-export') await onImportVaultJson(data);
      else onImportItems(data);
    } catch (error) { notify('Import failed: ' + error.message, 'error'); }
  };
` + s.slice(b);
  s = s.replace('        settings={settings}\n      />', '        settings={settings}\n        authenticatorItems={authenticatorItems}\n      />');
  return s;
});
edit('src/components/ItemModal.jsx', s => {
  s = s.replace('editingItem, activeKey, settings })', 'editingItem, activeKey, settings, authenticatorItems = [] })');
  s = s.replace("  const [formTotp, setFormTotp] = useState('');", "  const [formTotp, setFormTotp] = useState('');\n  const [totpId, setTotpId] = useState('');");
  s = s.replace("      setFormTotp(editingItem.totpSecret || '');", "      setFormTotp(editingItem.totpSecret || '');\n      setTotpId(editingItem.totpId || '');");
  s = s.replace("      setFormTotp('');", "      setFormTotp('');\n      setTotpId('');");
  s = s.replace('      totpSecret: formTotp,', '      totpSecret: formTotp,\n      totpId: totpId || undefined,');
  const a = s.indexOf('  const registerPasskey ='); const b = s.indexOf('  // Real-time inline breach', a);
  s = s.slice(0, a) + s.slice(b);
  s = s.replace('🔑 Passkey (FIDO2 / WebAuthn)', '🔑 Passkey metadata').replace('Passkey (FIDO2 / WebAuthn) Template', 'Passkey metadata reference');
  s = s.replace(/              <Button variant="contained" onClick=\{registerPasskey\}[^\n]+\n/, '              <Alert severity="info">This record stores passkey metadata only. CipherVault does not create, store or autofill passkey private keys for other websites.</Alert>\n');
  const tokenField = s.indexOf('label="2FA');
  const anchor = s.lastIndexOf('            <TextField', tokenField);
  if (tokenField >= 0) s = s.slice(0, anchor) + `            <TextField select label="Link an authenticator account" value={totpId} onChange={e => { setTotpId(e.target.value); setFormTotp(authenticatorItems.find(item => item.id === e.target.value)?.totpSecret || ''); }} helperText="Linked logins share one secret. Choose New / none to add or remove a link.">
              <MenuItem value="">New / none</MenuItem>{authenticatorItems.map(item => <MenuItem key={item.id} value={item.id}>{item.name} — {item.username || ''}</MenuItem>)}
            </TextField>
` + s.slice(anchor);
  return s;
});
edit('src/components/SettingsModal.jsx', s => "import DeviceUnlockSettings from './DeviceUnlockSettings';\n" + s.replace('onDeleteProfile, activeKey })', 'onDeleteProfile, activeKey, deviceEnabled, onEnableDevice, onDisableDevice })').replace('          {/* Quick PIN Unlock Configuration', '          <DeviceUnlockSettings enabled={deviceEnabled} activeKey={activeKey} onEnable={onEnableDevice} onDisable={onDisableDevice} />\n\n          {/* Quick PIN Unlock Configuration'));
edit('src/components/UnlockView.jsx', s => {
  s = "import { unlockWithDevice } from '../utils/deviceUnlock';\n" + s;
  const a = s.indexOf('\n  return (');
  s = s.slice(0, a) + `
  const handleDeviceUnlock = async () => {
    if (busy) return;
    const attempt = ++generation.current; setBusy(true); setError('');
    try {
      const record = vaultStorage.get(profileName);
      const key = await unlockWithDevice(record.deviceUnlock);
      const payload = validateVault(JSON.parse(await CryptoEngine.decryptPayload(key, record.vault)));
      if (attempt === generation.current) onUnlockSuccess(key, payload.items, payload.trash, record.revision, authenticator);
    } catch (error) { if (attempt === generation.current) setError('Device unlock failed: ' + error.message); }
    finally { if (attempt === generation.current) setBusy(false); }
  };
` + s.slice(a);
  s = s.replace('        {error && <Alert severity="error">{error}</Alert>}', '        {error && <Alert severity="error">{error}</Alert>}\n        {vaultStorage.get(profileName)?.deviceUnlock && <Button variant="outlined" disabled={busy} onClick={handleDeviceUnlock}>Unlock with device</Button>}');
  return s;
});
edit('src/components/ExportModal.jsx', s => {
  s = "import { exportTwoFas } from '../utils/migration';\nimport { resolveAccounts, normalizeOtp } from '../utils/accounts';\n" + s;
  s = s.replace('const bwItems = vaultItems.map', 'const bwItems = resolveAccounts(vaultItems).map');
  s = s.replace('        else if (item.category === \'Cards\') bwType = 3;', "        else if (item.category === 'Cards') bwType = 3;\n        else if (item.category === 'Identities') bwType = 4;");
  s = s.replace('          notes: item.notes || \'\',', "          notes: item.notes || '',\n          card: item.category === 'Cards' ? item.templateData : null,\n          identity: item.category === 'Identities' ? item.templateData : null,\n          fields: (item.customFields || []).map(field => ({ name: field.name, value: field.value, type: field.isSecret ? 1 : 0 })),");
  s = s.replace("uris: item.website ? [{ match: null, uri: item.website }] : [],", "uris: item.uris?.length ? item.uris : item.website ? [{ match: null, uri: item.website }] : [],");
  s = s.replace('item.totpSecret ? `otpauth://totp/${encodeURIComponent(item.name)}?secret=${item.totpSecret}` : null', 'item.totpSecret ? normalizeOtp(item.totpSecret, item) : null');
  const a = s.indexOf('      const services = vaultItems'); const b = s.indexOf('\n      downloadFile(', a);
  s = s.slice(0, a) + '      const twoFasData = exportTwoFas(vaultItems);\n' + s.slice(b);
  s = s.replace('const rows = vaultItems.map', 'const rows = resolveAccounts(vaultItems).map');
  s = s.replace('    a.click();', "    a.click();\n    if (mimeType === 'application/json' && filename.includes('encrypted')) localStorage.setItem('ciphervault_last_backup_' + profileName, new Date().toISOString());");
  return s;
});
edit('index.html', s => s.replace(/  <script>\n[\s\S]*?  <\/script>\n/, ''));
edit('src/main.jsx', s => s + "\nif ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol) && import.meta.env.PROD) {\n  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('sw.js', location.href)).catch(() => {}));\n}\n");
edit('package.json', s => { const p = JSON.parse(s); p.version = '3.5.0'; p.scripts['build:extension'] = 'node scripts/build-extension.js'; return JSON.stringify(p, null, 2) + '\n'; });
edit('.gitignore', s => s + '\ndist-extension/\n');
