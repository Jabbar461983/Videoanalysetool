import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles/global.css';

try {
  if (localStorage.getItem('bdva-test') === '1') void import('./audio/testhook');
} catch {
  /* kein Zugriff auf localStorage */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
