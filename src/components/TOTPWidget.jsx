import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { TOTP } from '../utils/totp';

export default function TOTPWidget({ secret, settings }) {
  const [code, setCode] = useState('------');
  const [nextCode, setNextCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);
  const showNextAuto = settings?.showNextCodeAuto || false;
  const [showNextToggle, setShowNextToggle] = useState(false);

  const displayNext = showNextAuto || showNextToggle;

  useEffect(() => {
    let isMounted = true;
    const updateTotp = async () => {
      if (!secret) return;
      
      const epoch = Math.floor(Date.now() / 1000);
      const nextEpoch = epoch + 30;
      const cleanSecret = secret.replace(/\s+/g, '').replace(/=+$/, '');
      const hexKey = TOTP.base32toHex(cleanSecret);

      const c = await TOTP.generate(secret);
      
      let nc = '------';
      try {
        const time = Math.floor(nextEpoch / 30);
        const timeHex = time.toString(16).padStart(16, '0');
        const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const timeBytes = new Uint8Array(timeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'HMAC', hash: { name: 'SHA-1' } },
          false,
          ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBytes);
        const hmacResult = new Uint8Array(signature);
        const offset = hmacResult[hmacResult.length - 1] & 0xf;
        const binary = 
          ((hmacResult[offset] & 0x7f) << 24) |
          ((hmacResult[offset + 1] & 0xff) << 16) |
          ((hmacResult[offset + 2] & 0xff) << 8) |
          (hmacResult[offset + 3] & 0xff);

        nc = (binary % 1000000).toString().padStart(6, '0');
      } catch (e) {
        nc = 'Error';
      }

      const t = TOTP.getTimeRemaining();
      if (isMounted) {
        setCode(c);
        setNextCode(nc);
        setTimeLeft(t);
      }
    };

    updateTotp();
    const interval = setInterval(updateTotp, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [secret]);

  if (!secret) return null;

  return (
    <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.selected', borderRadius: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            2FA Authenticator Code
          </Typography>
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, color: 'primary.main' }}>
            {code}
          </Typography>
        </Box>

        {displayNext && (
          <Box sx={{ borderLeft: 1, borderColor: 'divider', pl: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Next Code
            </Typography>
            <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, color: 'secondary.main' }}>
              {nextCode}
            </Typography>
          </Box>
        )}

        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, display: 'block' }}>
            {timeLeft}s
          </Typography>
          {!showNextAuto && (
            <Button size="small" onClick={() => setShowNextToggle(!showNextToggle)} sx={{ fontSize: '0.7rem', mt: 0.5, py: 0, px: 1, textTransform: 'none' }}>
              {showNextToggle ? 'Hide Next' : 'Show Next'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
