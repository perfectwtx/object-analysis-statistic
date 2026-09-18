import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { applyTheme } from './theme.js';
import './styles.css';
import './job-progress.css';
import './styles/dashboard.css';
import './styles/workbench-align.css';

applyTheme();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
