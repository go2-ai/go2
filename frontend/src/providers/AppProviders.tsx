import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../app/store';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ToastProvider } from '../contexts/ToastContext';
import { ConfirmProvider } from '../contexts/confirmContext';
import { AuthBootstrap } from '../features/auth/AuthBootstrap';

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Provider store={store}>
      <AuthBootstrap>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthBootstrap>
    </Provider>
  );
};