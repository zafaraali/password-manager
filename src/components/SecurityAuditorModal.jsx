import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Paper, Chip } from '@mui/material';

export default function SecurityAuditorModal({ open, onClose, vaultItems }) {
  const analysis = vaultItems.map(item => {
    const pwd = item.password || '';
    let score = 'Strong';
    let color = 'success';
    let issues = [];

    if (item.category === 'Crypto' || item.category === 'SSH' || item.category === 'Notes') {
      return { ...item, score: 'Secure', color: 'success', issues: ['Specialized Template Item'] };
    }

    if (pwd.length < 8) {
      issues.push('Too short (< 8 chars)');
      score = 'Weak';
      color = 'error';
    } else if (!/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      issues.push('Missing uppercase or number');
      score = 'Fair';
      color = 'warning';
    }

    return { ...item, score, color, issues };
  });

  const weakCount = analysis.filter(i => i.score === 'Weak').length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>🛡️ Security Audit Report</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Audit Summary: {vaultItems.length} items analyzed. 
              {weakCount > 0 ? ` ⚠️ ${weakCount} weak passwords found.` : ' ✨ All passwords meet good standards.'}
            </Typography>
          </Paper>

          {analysis.map(item => (
            <Paper key={item.id} sx={{ p: 2, border: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{item.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.issues.length > 0 ? item.issues.join(', ') : 'No security issues detected'}
                </Typography>
              </Box>
              <Chip label={item.score} color={item.color} size="small" />
            </Paper>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
