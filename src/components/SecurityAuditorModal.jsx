import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, 
  Paper, Chip, Tabs, Tab, LinearProgress, Alert, CircularProgress 
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SecurityIcon from '@mui/icons-material/Security';
import DangerousIcon from '@mui/icons-material/Dangerous';
import { CryptoEngine } from '../utils/crypto';

export default function SecurityAuditorModal({ open, onClose, vaultItems = [] }) {
  const [tab, setTab] = useState(0);
  const [pwnedMap, setPwnedMap] = useState({});
  const [checkingPwned, setCheckingPwned] = useState(false);
  const [pwnedScanned, setPwnedScanned] = useState(false);

  // Group logins to find reused passwords
  const passwordCounts = {};
  vaultItems.forEach(item => {
    if (item.category === 'Logins' && item.password) {
      passwordCounts[item.password] = (passwordCounts[item.password] || 0) + 1;
    }
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const handleScanPwnedPasswords = async () => {
    setCheckingPwned(true);
    const results = {};
    const uniquePasswords = Array.from(new Set(vaultItems.map(i => i.password).filter(Boolean)));
    
    for (const pwd of uniquePasswords) {
      const count = await CryptoEngine.checkPwnedPassword(pwd);
      results[pwd] = count;
    }
    setPwnedMap(results);
    setCheckingPwned(false);
    setPwnedScanned(true);
    setTab(1); // Switch to Breached tab
  };

  const analysis = vaultItems.map(item => {
    const pwd = item.password || '';
    let issues = [];
    let isWeak = false;
    let isReused = false;
    let isMissing2fa = false;
    let isOld = false;
    let isBreached = false;
    let breachCount = 0;
    let ageDays = 0;

    if (item.category === 'Crypto' || item.category === 'SSH' || item.category === 'Notes') {
      return { 
        ...item, 
        score: 'Secure', 
        color: 'success', 
        issues: ['Specialized Template Item'],
        isWeak: false,
        isReused: false,
        isMissing2fa: false,
        isOld: false,
        isBreached: false,
        breachCount: 0,
        ageDays: 0
      };
    }

    // Check breach status
    if (pwnedMap[pwd] > 0) {
      isBreached = true;
      breachCount = pwnedMap[pwd];
      issues.push(`EXPOSED IN BREACH (${breachCount.toLocaleString()} times)`);
    } else if (pwnedScanned && pwd && pwnedMap[pwd] === null) {
      issues.push('BREACH CHECK UNAVAILABLE');
    }

    // Check strength
    if (pwd.length < 8) {
      issues.push('Very short (< 8 chars)');
      isWeak = true;
    } else if (pwd.length < 12) {
      issues.push('Short (< 12 chars)');
    }

    if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd) || !/[^A-Za-z0-9]/.test(pwd)) {
      issues.push('Missing character variety (uppercase/numbers/symbols)');
    }

    // Check reuse
    if (pwd && passwordCounts[pwd] > 1) {
      isReused = true;
      issues.push(`Reused across ${passwordCounts[pwd]} accounts`);
    }

    // Check missing 2FA
    if (item.category === 'Logins' && !item.totpSecret) {
      isMissing2fa = true;
      issues.push('Missing 2FA / Authenticator token');
    }

    // Check age
    if (item.passwordUpdatedAt) {
      ageDays = Math.floor((now - new Date(item.passwordUpdatedAt).getTime()) / DAY_MS);
      if (ageDays > 90) {
        isOld = true;
        issues.push(`Last rotated ${ageDays} days ago`);
      }
    }

    let score = 'Strong';
    let color = 'success';
    if (isBreached || isWeak) {
      score = 'Critical';
      color = 'error';
    } else if (isReused || isMissing2fa || isOld || issues.length > 0) {
      score = 'Needs Attention';
      color = 'warning';
    }

    return { ...item, score, color, issues, isWeak, isReused, isMissing2fa, isOld, isBreached, breachCount, ageDays };
  });

  const breachedItems = analysis.filter(i => i.isBreached);
  const weakItems = analysis.filter(i => i.isWeak);
  const reusedItems = analysis.filter(i => i.isReused);
  const missing2faItems = analysis.filter(i => i.isMissing2fa);
  const oldItems = analysis.filter(i => i.isOld);

  // Calculate vault health score (0 - 100)
  let penalty = (breachedItems.length * 35) + (weakItems.length * 20) + (reusedItems.length * 15) + (missing2faItems.length * 5) + (oldItems.length * 5);
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (vaultItems.length > 0 ? (penalty / vaultItems.length) : 0))));

  const getHealthColor = () => {
    if (healthScore >= 80) return 'success';
    if (healthScore >= 50) return 'warning';
    return 'error';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" /> Bitwarden-Grade Security Auditor
        </Box>
        <Button 
          variant="outlined" 
          size="small"
          disabled={checkingPwned}
          onClick={handleScanPwnedPasswords}
          startIcon={checkingPwned ? <CircularProgress size={16} /> : <DangerousIcon color="error" />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {checkingPwned ? 'Checking HIBP...' : pwnedScanned ? 'Re-scan Breaches (HIBP)' : 'Check Breaches (HIBP)'}
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          
          {/* Health Score Banner */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 2.5, 
              border: 1, 
              borderColor: 'divider', 
              borderRadius: 3, 
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.6)' : 'rgba(248, 250, 252, 0.9)'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Vault Health Rating
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: `${getHealthColor()}.main` }}>
                {healthScore}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={healthScore} 
              color={getHealthColor()} 
              sx={{ height: 8, borderRadius: 4, mb: 1.5 }} 
            />
            <Typography variant="body2" color="text.secondary">
              Analyzed {vaultItems.length} items: found <strong>{breachedItems.length}</strong> breached passwords, <strong>{reusedItems.length}</strong> reused credentials, <strong>{weakItems.length}</strong> weak passwords, and <strong>{missing2faItems.length}</strong> logins without 2FA.
            </Typography>
          </Paper>

          {/* Navigation Tabs */}
          <Tabs 
            value={tab} 
            onChange={(e, v) => setTab(v)} 
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}
          >
            <Tab label={`All Items (${analysis.length})`} />
            <Tab label={`🚨 Breached (${breachedItems.length})`} />
            <Tab label={`⚠️ Reused (${reusedItems.length})`} />
            <Tab label={`❌ Weak (${weakItems.length})`} />
            <Tab label={`📲 Missing 2FA (${missing2faItems.length})`} />
            <Tab label={`🕒 Age >90d (${oldItems.length})`} />
          </Tabs>

          {/* Tab 0: All Items */}
          {tab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {analysis.map(item => (
                <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ pr: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {item.username || 'No username'} • {item.category}
                    </Typography>
                    <Typography variant="caption" color={item.issues.length > 0 ? (item.isBreached ? 'error.main' : 'text.secondary') : 'success.main'}>
                      {item.issues.length > 0 ? item.issues.join(' • ') : '✨ Secure & optimal'}
                    </Typography>
                  </Box>
                  <Chip label={item.score} color={item.color} size="small" sx={{ fontWeight: 700 }} />
                </Paper>
              ))}
            </Box>
          )}

          {/* Tab 1: Breached Passwords (HIBP) */}
          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {!pwnedScanned ? (
                <Paper sx={{ p: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 3 }}>
                  <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>Check Against HaveIBeenPwned (HIBP)</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Uses privacy-preserving zero-knowledge k-Anonymity (SHA-1 prefix search). Your password or full hash never leaves your browser.
                  </Typography>
                  <Button variant="contained" color="error" onClick={handleScanPwnedPasswords} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
                    Check Vault Passwords for Breaches
                  </Button>
                </Paper>
              ) : breachedItems.length === 0 ? (
                <Alert severity="success">🎉 None of your vault passwords were found in public data breaches!</Alert>
              ) : (
                breachedItems.map(item => (
                  <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'error.main', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(239, 68, 68, 0.04)' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.username}</Typography>
                      <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 700 }}>
                        🚨 Found in public data breaches {item.breachCount.toLocaleString()} times! Change immediately.
                      </Typography>
                    </Box>
                    <Chip label="Compromised" color="error" size="small" sx={{ fontWeight: 700 }} />
                  </Paper>
                ))
              )}
            </Box>
          )}

          {/* Tab 2: Reused Passwords */}
          {tab === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {reusedItems.length === 0 ? (
                <Alert severity="success">✨ No reused passwords detected! All tested accounts use unique passwords.</Alert>
              ) : (
                reusedItems.map(item => (
                  <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'warning.main', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.username}</Typography>
                      <Typography variant="caption" color="warning.main" display="block" sx={{ fontWeight: 600 }}>
                        ⚠️ Shares password with {passwordCounts[item.password] - 1} other account(s)
                      </Typography>
                    </Box>
                    <Chip label="Reused" color="warning" size="small" sx={{ fontWeight: 700 }} />
                  </Paper>
                ))
              )}
            </Box>
          )}

          {/* Tab 3: Weak Passwords */}
          {tab === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {weakItems.length === 0 ? (
                <Alert severity="success">✨ No weak passwords found! All credentials satisfy minimum entropy standards.</Alert>
              ) : (
                weakItems.map(item => (
                  <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'error.main', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 600 }}>
                        Length: {(item.password || '').length} characters (Recommended: $\ge$ 14)
                      </Typography>
                    </Box>
                    <Chip label="Weak" color="error" size="small" sx={{ fontWeight: 700 }} />
                  </Paper>
                ))
              )}
            </Box>
          )}

          {/* Tab 4: Missing 2FA */}
          {tab === 4 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {missing2faItems.length === 0 ? (
                <Alert severity="success">✨ All login accounts have 2FA / TOTP authenticator tokens active!</Alert>
              ) : (
                missing2faItems.map(item => (
                  <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'info.main', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.username}</Typography>
                      <Typography variant="caption" color="info.main" display="block" sx={{ fontWeight: 600 }}>
                        💡 Enable 2FA on {item.name} and store the TOTP secret here for 2FAS protection
                      </Typography>
                    </Box>
                    <Chip label="No 2FA" color="info" size="small" sx={{ fontWeight: 700 }} />
                  </Paper>
                ))
              )}
            </Box>
          )}

          {/* Tab 5: Old Passwords (>90d) */}
          {tab === 5 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: '380px', overflowY: 'auto' }}>
              {oldItems.length === 0 ? (
                <Alert severity="success">✨ All credentials have been updated recently.</Alert>
              ) : (
                oldItems.map(item => (
                  <Paper key={item.id} elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.username}</Typography>
                      <Typography variant="caption" color="warning.main" display="block" sx={{ fontWeight: 600 }}>
                        🕒 Last rotated {item.ageDays} days ago
                      </Typography>
                    </Box>
                    <Chip label={`${item.ageDays}d old`} color="default" size="small" sx={{ fontWeight: 700 }} />
                  </Paper>
                ))
              )}
            </Box>
          )}

        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 3 }}>
          Close Auditor
        </Button>
      </DialogActions>
    </Dialog>
  );
}
