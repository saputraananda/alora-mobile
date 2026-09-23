import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './app/App.jsx';
import { startPwaInstallCapture } from './utils/pwaInstallCapture.js';
import { startPwaAutoReload } from './utils/pwaAutoReload.js';
import './index.css';

startPwaInstallCapture();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true).then(() => {
      window.location.reload();
    });
  },
});

startPwaAutoReload();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
