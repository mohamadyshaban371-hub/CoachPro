import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import InstallPrompt from './components/InstallPrompt.tsx';
import { registerPWA, captureInstallPrompt } from './lib/pwa';
import { ThemeProvider } from './lib/theme';
import { I18nProvider } from './lib/i18n';
import './index.css';

captureInstallPrompt();
registerPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
        <InstallPrompt />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
