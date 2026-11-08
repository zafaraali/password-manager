const fs = require('fs');
const edit = (file, fn) => fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')));
edit('src/components/ExportModal.jsx', s => {
  s = s.replace("import { exportTwoFas }", "import { exportTwoFas, exportBitwarden }");
  const a = s.indexOf('      const bwItems ='); const b = s.indexOf('\n      downloadFile(', a);
  s = s.slice(0, a) + "      let bwData;\n      try { bwData = exportBitwarden(vaultItems); } catch (error) { setExportError(error.message); return; }\n" + s.slice(b);
  s = s.replace("import { resolveAccounts, normalizeOtp }", "import { resolveAccounts }");
  s = s.replace('              {exportError && <Alert severity="error">{exportError}</Alert>}\n', '');
  s = s.replace('          <Typography variant="caption"', '          {exportError && <Alert severity="error">{exportError}</Alert>}\n          <Typography variant="caption"');
  return s;
});
edit('src/components/VaultDashboard.jsx', s => {
  s = s.replace("import TOTPWidget from './TOTPWidget';\n", '');
  s = s.replace("const [viewMode, setViewMode] = useState('grid');", "const [viewMode, setViewMode] = useState('list');");
  s = s.replaceAll('[{ name: parsed.issuer', '[{ ...parsed, name: parsed.issuer');
  s = s.replace('Passkey / WebAuthn credential', 'Passkey metadata reference');
  s = s.replace('Vault Dashboard [{currentProfile}]', 'Your vault');
  s = s.replace("sx={{ display: 'flex', alignItems: 'center', gap: 1 }}", "sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}");
  const a = s.indexOf('          <Button variant="outlined" component="label"', s.indexOf('      {/* Top Action Bar */}'));
  const b = s.indexOf('          <Button variant="contained" size="large"', a);
  s = s.slice(0, a) + `          <Button variant="outlined" aria-haspopup="menu" aria-expanded={Boolean(importAnchor)} onClick={event => setImportAnchor(event.currentTarget)}>Import accounts</Button>
          <Menu anchorEl={importAnchor} open={Boolean(importAnchor)} onClose={() => setImportAnchor(null)}>
            <MenuItem component="label" onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.querySelector('input').click(); }}>Bitwarden, 2FAS or vault backup<input hidden type="file" accept=".json,.2fas" onChange={e => { handleVaultJsonImport(e); setImportAnchor(null); }} /></MenuItem>
            <MenuItem component="label" onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.querySelector('input').click(); }}>QR image or authenticator file<input hidden type="file" accept=".json,.2fas,image/*" onChange={e => { handleAuthImport(e); setImportAnchor(null); }} /></MenuItem>
            <MenuItem onClick={() => { setImportAnchor(null); startCameraScanner(); }}>Scan QR with camera</MenuItem>
          </Menu>
` + s.slice(b);
  s = s.replace("sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, alignItems: 'center' }}", "sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%', alignItems: 'center' }}");
  s = s.replace('          placeholder="Search (Ctrl+K or /)..."', '          label="Search vault"\n          placeholder="Name, username or website"\n          inputProps={{ \'aria-label\': \'Search vault\' }}');
  s = s.replace('          <Tab label={`Cards', '          <Tab label={`Identities (${vaultItems.filter(i => i.category === \'Identities\').length})`} value="Identities" />\n          <Tab label={`Cards');
  s = s.replace('onClick={() => setShowPasswordMap', 'onClick={() => setShowPasswordMap');
  return s;
});
edit('src/components/Navbar.jsx', s => {
  s = s.replace('Badge, Select,', 'Badge, Select,');
  s = s.replace('component="div" onClick={onLogoClick}', 'component="button" onClick={onLogoClick}');
  s = s.replace("sx={{ flexGrow: 1, fontWeight: 850,", "sx={{ border: 0, p: 0, bgcolor: 'transparent', textAlign: 'left', fontSize: { xs: '1rem', sm: '1.25rem' }, minWidth: 0, flexGrow: 1, fontWeight: 850,");
  s = s.replace("gap: { xs: 1, sm: 2 }, py: 1", "gap: { xs: .75, sm: 2 }, flexWrap: { xs: 'wrap', sm: 'nowrap' }, py: 1");
  s = s.replace("minWidth: { xs: 106, sm: 140 }, maxWidth: { xs: 130, sm: 180 }", "minWidth: { xs: 90, sm: 140 }, maxWidth: { xs: 110, sm: 180 }");
  s = s.replace("sx={{ mr: 0, '& .MuiFormControlLabel-label'", "sx={{ display: { xs: 'none', sm: 'inline-flex' }, mr: 0, '& .MuiFormControlLabel-label'");
  s = s.replace('<Button variant="contained" color="error"', '<Button aria-label="Lock vault" variant="contained" color="primary"');
  s = s.replace('            <Divider />', `            <MenuItem onClick={() => menuAction(onOpenSettings)}>Settings</MenuItem>
            <MenuItem onClick={() => { setMode(previous => previous === 'dark' ? 'light' : 'dark'); closeMenu(); }}>Switch to {mode === 'dark' ? 'light' : 'dark'} theme</MenuItem>
            <Divider />`);
  return s;
});
edit('src/App.jsx', s => s.replace('sx={{ mt: 6, mb: 6,', "sx={{ mt: { xs: 2, sm: 4 }, mb: 4,").replace("justifyContent: 'center' }}>", "justifyContent: key ? 'flex-start' : 'center' }}>").replace('          vaultItems={resolveAccounts(vaultItems)}\n        /></Suspense>}', '          vaultItems={resolveAccounts(vaultItems).filter(item => !isAuthenticator(item))}\n        /></Suspense>}'));
edit('src/components/ItemModal.jsx', s => s.replace('<MenuItem value="Cards">', '<MenuItem value="Identities">Identity</MenuItem>\n              <MenuItem value="Cards">').replace("  const [passkeyStatus, setPasskeyStatus] = useState('');\n", '').replace("    setPasskeyStatus('');\n", '').replace(/              \{passkeyStatus[^\n]+\n/g, '').replace("  const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));\n\n", ''));
