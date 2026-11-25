import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

(window as unknown as { __FRAITH_MOUNTED__?: boolean }).__FRAITH_MOUNTED__ = true;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

