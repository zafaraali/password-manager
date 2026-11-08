import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol) && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('sw.js', location.href)).catch(() => {}));
}
