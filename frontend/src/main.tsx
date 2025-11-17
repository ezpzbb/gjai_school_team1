import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import AuthProvider from './providers/AuthProvider';
import AppProvider from './providers/AppProvider';
import { DataProvider } from './providers/DataProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import NotificationProvider from './providers/NotificationProvider';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <NotificationProvider>
            <DataProvider>  
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </DataProvider>
          </NotificationProvider>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  </StrictMode>
);