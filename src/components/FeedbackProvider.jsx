import React, { createContext, useContext, useMemo, useState, useRef } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, TextField } from '@mui/material';

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const ask = value => new Promise(resolve => {
    pending.current?.(null);
    pending.current = resolve;
    setRequest({ ...value, resolve });
  });

  const api = useMemo(() => ({
    cancel() { pending.current?.(null); pending.current = null; setRequest(null); },
    notify(message, severity = 'info') {
      setToast({ message, severity });
    },
    confirm({ title, message, confirmLabel = 'Confirm', severity = 'warning' }) {
      return ask({ kind: 'confirm', title, message, confirmLabel, severity });
    },
    password({ title, message, confirmLabel = 'Continue' }) {
      return ask({ kind: 'password', title, message, confirmLabel, value: '' });
    },
    input({ title, message, confirmLabel = 'Continue', label = 'Value' }) {
      return ask({ kind: 'input', title, message, confirmLabel, label, value: '' });
    }
  }), []);

  const closeRequest = (value) => {
    pending.current?.(value);
    pending.current = null;
    setRequest(null);
  };

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast && <Alert onClose={() => setToast(null)} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert>}
      </Snackbar>
      <Dialog open={Boolean(request)} onClose={() => closeRequest(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{request?.title}</DialogTitle>
        <DialogContent>
          {request?.message && <Alert severity={request.severity || 'info'} sx={{ mb: 2 }}>{request.message}</Alert>}
          {(request?.kind === 'password' || request?.kind === 'input') && <TextField autoFocus fullWidth type={request.kind === 'password' ? 'password' : 'text'} label={request.label || 'Password'} value={request.value} onChange={e => setRequest(current => ({ ...current, value: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') closeRequest(request.value); }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => closeRequest(null)}>Cancel</Button>
          <Button variant="contained" color={request?.severity === 'error' ? 'error' : 'primary'} onClick={() => closeRequest(['password', 'input'].includes(request?.kind) ? request.value : true)}>{request?.confirmLabel || 'Continue'}</Button>
        </DialogActions>
      </Dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used inside FeedbackProvider');
  return value;
}
