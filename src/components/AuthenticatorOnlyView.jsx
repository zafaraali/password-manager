import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, Card, CardContent, Chip, LinearProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { generateTOTP } from '../utils/totp';

export default function AuthenticatorOnlyView({ vaultItems, onBack }) {
  const [totpCodes, setTotpCodes] = useState({});
  const [nextCodes, setNextCodes] = useState({});
  const [timeLeft, setTimeLeft] = useState(30);
  const totpItems = vaultItems.filter(i => i.category === 'totp' && i.password);

  useEffect(() => {
    const updateCodesAndTimer = async () => {
      const epoch = Math.floor(Date.now() / 1000);
      const remaining = 30 - (epoch % 30);
      setTimeLeft(remaining);

      const codes = {};
      const nexts = {};
      for (const item of totpItems) {
        codes[item.id] = await generateTOTP(item.password, 30, 6, 0);
        nexts[item.id] = await generateTOTP(item.password, 30, 6, 30);
      }
      setTotpCodes(codes);
      setNextCodes(nexts);
    };

    updateCodesAndTimer();
    const interval = setInterval(updateCodesAndTimer, 1000);
    return () => clearInterval(interval);
  }, [vaultItems]);

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined" sx={{ textTransform: 'none', borderRadius: 2 }}>
          Back to Vault
        </Button>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          2FA Authenticators Dashboard
        </Typography>
      </Box>

      {totpItems.length === 0 ? (
        <Paper sx={{ overflowY: 'visible', p: 6, textAlign: 'center', borderRadius: 3 }}>
          <Typography variant="h6" color="text.secondary">
            No 2FA authenticator items found in your vault.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
          {totpItems.map(item => (
            <Card key={item.id} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.username || 'No account identifier'}
                </Typography>
                
                <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Current Code</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Next Code</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                      label={totpCodes[item.id] || '------'}
                      color="primary"
                      sx={{ flex: 1, fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', py: 2.5, borderRadius: 2 }}
                    />
                    <Chip
                      label={nextCodes[item.id] || '------'}
                      variant="outlined"
                      sx={{ flex: 1, fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', py: 2.5, borderRadius: 2, opacity: 0.75 }}
                    />
                  </Box>
                </Box>

                <Box sx={{ width: '100%', mt: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Refreshes in</Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{timeLeft}s</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={(timeLeft / 30) * 100} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
