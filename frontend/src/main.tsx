import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import AuthProvider from './providers/AuthProvider';
import AppProvider from './providers/AppProvider';
import { DataProvider } from './providers/DataProvider';
import { ThemeProvider } from './providers/ThemeProvider';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <DataProvider>  
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DataProvider>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  </StrictMode>
);