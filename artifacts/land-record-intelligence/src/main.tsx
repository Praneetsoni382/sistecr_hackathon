import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/view-boundary';

import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.warn('[Root Interception]', error, errorInfo?.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
