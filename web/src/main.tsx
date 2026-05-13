import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AnalysisStoreProvider } from './store/AnalysisStore';
import { ThemeProvider } from './store/ThemeContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AnalysisStoreProvider>
        <App />
      </AnalysisStoreProvider>
    </ThemeProvider>
  </StrictMode>,
);
