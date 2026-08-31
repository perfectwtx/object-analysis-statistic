import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { applyTheme } from './theme.js';
import './styles.css';

// index.html 的内联脚本已经设过 data-theme，这里补一次 color-scheme（原生控件跟随）
applyTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
