import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Slider, FormControlLabel, Checkbox, TextField, IconButton, Tooltip, Alert } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export default function PasswordGeneratorModal({ open, onClose, onApplyPassword }) {
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeSimilar, setExcludeSimilar] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = () => {
    let uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    let numberChars = '0123456789';
    let symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (excludeSimilar) {
      uppercaseChars = uppercaseChars.replace(/[IO]/g, '');
      lowercaseChars = lowercaseChars.replace(/[l1o]/g, '');
      numberChars = numberChars.replace(/[01]/g, '');
    }

    let charPool = '';
    if (includeUppercase) charPool += uppercaseChars;
    if (includeLowercase) charPool += lowercaseChars;
    if (includeNumbers) charPool += numberChars;
    if (includeSymbols) charPool += symbolChars;

    if (!charPool) {
      setGeneratedPassword('');
      return;
    }

    let password = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += charPool[array[i] % charPool.length];
    }
    setGeneratedPassword(password);
    setCopied(false);
  };

  useEffect(() => {
    if (open) {
      generate();
    }
  }, [open, length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, excludeSimilar]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleApply = () => {
    if (onApplyPassword && generatedPassword) {
      onApplyPassword(generatedPassword);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color="primary" /> Password Generator
      </DialogTitle>
      <DialogContent sx={{ overflowY: 'visible', display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            fullWidth
            value={generatedPassword}
            readOnly
            size="small"
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, fontSize: '15px' } }}
          />
          <Tooltip title="Regenerate">
            <IconButton onClick={generate} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy Password">
            <IconButton onClick={handleCopy} color={copied ? 'success' : 'default'}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {copied && <Alert severity="success" sx={{ py: 0 }}>Copied to clipboard!</Alert>}

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Length: {length} characters
          </Typography>
          <Slider
            value={length}
            min={8}
            max={64}
            step={1}
            valueLabelDisplay="auto"
            onChange={(e, val) => setLength(val)}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Character Sets
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={includeUppercase} onChange={(e) => setIncludeUppercase(e.target.checked)} />}
            label="Uppercase (A-Z)"
          />
          <FormControlLabel
            control={<Checkbox checked={includeLowercase} onChange={(e) => setIncludeLowercase(e.target.checked)} />}
            label="Lowercase (a-z)"
          />
          <FormControlLabel
            control={<Checkbox checked={includeNumbers} onChange={(e) => setIncludeNumbers(e.target.checked)} />}
            label="Numbers (0-9)"
          />
          <FormControlLabel
            control={<Checkbox checked={includeSymbols} onChange={(e) => setIncludeSymbols(e.target.checked)} />}
            label="Symbols (!@#$%^&*)"
          />
          <FormControlLabel
            control={<Checkbox checked={excludeSimilar} onChange={(e) => setExcludeSimilar(e.target.checked)} />}
            label="Exclude Similar (l, 1, I, o, 0, O)"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit" sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        {onApplyPassword && (
          <Button onClick={handleApply} variant="contained" sx={{ textTransform: 'none', borderRadius: 2 }}>
            Use Password
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
