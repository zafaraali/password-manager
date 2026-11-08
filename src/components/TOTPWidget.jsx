import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCodeIcon from '@mui/icons-material/QrCode';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { TOTP } from '../utils/totp';
import { QRCodeEncoder } from '../utils/qrcode';
import { useFeedback } from './FeedbackProvider';

export default function TOTPWidget({ secret, name = 'Account', issuer = '', settings }) {
  const { notify } = useFeedback();
  const [code, setCode] = useState('------');
  const [nextCode, setNextCode] = useState('------');
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);
  const [openQr, setOpenQr] = useState(false);
  const [qrSvg, setQrSvg] = useState('');

  const showNextAuto = settings?.showNextCodeAuto || false;
  const [showNextToggle, setShowNextToggle] = useState(false);
  const displayNext = showNextAuto || showNextToggle;

  const parsedConfig = typeof secret === 'string' && secret.startsWith('otpauth://') 
    ? TOTP.parseOtpAuthUrl(secret) 
    : { secret, period: 30 };
  const period = parsedConfig.period || 30;

  useEffect(() => {
    let isMounted = true;
    const updateTotp = async () => {
      if (!secret) return;
      
      const c = await TOTP.generate(secret, parsedConfig);
      
      let nc = '------';
      try {
        nc = await TOTP.generate(secret, { ...parsedConfig, epochOffset: period });
      } catch (e) {
        nc = 'Error';
      }

      const t = TOTP.getTimeRemaining(period);
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
  }, [secret, period]);

  const handleCopyCode = async (codeToCopy) => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleOpenQr = () => {
    const rawSecret = parsedConfig.secret || secret;
    const otpUrl = secret.startsWith('otpauth://') 
      ? secret 
      : TOTP.buildOtpAuthUrl({ issuer, name, secret: rawSecret, period: period, digits: parsedConfig.digits, algorithm: parsedConfig.algorithm });
    
    try {
      const svg = QRCodeEncoder.renderSvg(otpUrl, { size: 240, margin: 2, color: '#090d16', bgColor: '#ffffff' });
      setQrSvg(svg);
      setOpenQr(true);
    } catch (err) {
      notify('Failed to generate QR code: ' + err.message, 'error');
    }
  };

  if (!secret) return null;

  // Circular gauge calculations
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / period) * circumference;
  const ringColor = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#10b981';

  return (
    <Box 
      sx={{ 
        mt: 1.5, 
        p: 2, 
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.7)' : 'rgba(243, 244, 246, 0.8)', 
        borderRadius: 3, 
        border: 1, 
        borderColor: 'divider',
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1.5 
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Code & Timer Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* 2FAS Radial Timer Gauge */}
          <Box sx={{ position: 'relative', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="38" height="38" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="19"
                cy="19"
                r={radius}
                fill="none"
                stroke="currentColor"
                opacity="0.15"
                strokeWidth="3.5"
              />
              <circle
                cx="19"
                cy="19"
                r={radius}
                fill="none"
                stroke={ringColor}
                strokeWidth="3.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
              />
            </svg>
            <Typography 
              variant="caption" 
              sx={{ 
                position: 'absolute', 
                fontSize: '0.72rem', 
                fontFamily: 'monospace', 
                fontWeight: 800, 
                color: ringColor 
              }}
            >
              {timeLeft}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
              2FA Authenticator Token
            </Typography>
            <Typography 
              variant="h5" 
              onClick={() => handleCopyCode(code)}
              sx={{ 
                fontFamily: 'monospace', 
                fontWeight: 800, 
                letterSpacing: 3, 
                color: 'primary.main',
                cursor: 'pointer',
                userSelect: 'all',
                '&:hover': { opacity: 0.85 }
              }}
              title="Click to copy 2FA token"
            >
              {code}
            </Typography>
          </Box>
        </Box>

        {/* Actions: Copy & QR */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy 2FA Code'}>
            <IconButton 
              size="small" 
              onClick={() => handleCopyCode(code)}
              sx={{ 
                border: 1, 
                borderColor: copied ? 'secondary.main' : 'divider', 
                borderRadius: 2, 
                bgcolor: copied ? 'secondary.main' : 'background.paper',
                color: copied ? '#fff' : 'inherit',
                '&:hover': { bgcolor: copied ? 'secondary.dark' : 'action.hover' }
              }}
            >
              {copied ? <CheckCircleOutlineIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Tooltip title="View 2FA QR Code (for 2FAS / Phone pairing)">
            <IconButton 
              size="small" 
              onClick={handleOpenQr}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
            >
              <QrCodeIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Next Code Section */}
      {displayNext && (
        <Box sx={{ pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Next Token Preview:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, color: 'secondary.main' }}>
              {nextCode}
            </Typography>
            <IconButton size="small" onClick={() => handleCopyCode(nextCode)} title="Copy Next Token">
              <ContentCopyIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Toggle button if not auto-enabled */}
      {!showNextAuto && (
        <Button 
          size="small" 
          variant="text" 
          onClick={() => setShowNextToggle(!showNextToggle)} 
          sx={{ alignSelf: 'flex-start', textTransform: 'none', fontSize: '0.75rem', p: 0, minHeight: 'auto', color: 'text.secondary' }}
        >
          {showNextToggle ? '▲ Hide Next Code' : '▼ Preview Next Code'}
        </Button>
      )}

      {/* QR Code Modal for Phone / 2FAS sync */}
      <Dialog open={openQr} onClose={() => setOpenQr(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1, textAlign: 'center' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.15rem' }}>📲 2FA QR Code Pairing</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Scan with the <strong>2FAS</strong> mobile app, Google Authenticator, or Bitwarden to copy this authenticator secret to that app. This does not establish ongoing device synchronization.
          </Typography>

          <Box 
            sx={{ 
              p: 2, 
              bgcolor: '#ffffff', 
              borderRadius: 3, 
              display: 'inline-block',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              mb: 2 
            }}
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2, textAlign: 'left' }}>
            <Typography variant="caption" color="text.secondary" display="block">Secret Key (Manual Entry):</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, wordBreak: 'break-all' }}>
              {parsedConfig.secret || secret}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            variant="outlined" 
            size="small"
            onClick={() => {
              navigator.clipboard.writeText(parsedConfig.secret || secret);
              notify('2FA secret copied to clipboard!', 'success');
            }}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
          >
            Copy Secret Key
          </Button>
          <Button onClick={() => setOpenQr(false)} variant="contained" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, color: '#fff' }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
