import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import App from './App';
import './styles/tailwind.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1e1e1e',
          border: '1px solid #2a2a2a',
          color: '#e8e8e8',
          fontSize: '13px',
        },
      }}
    />
  </React.StrictMode>
);
