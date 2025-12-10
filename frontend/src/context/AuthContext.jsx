// src/context/AuthContext.js

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { setupInterceptors, clearInterceptors } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const auth = useAuth();
  const interceptorsSetup = useRef(false);

  useEffect(() => {
    // Only setup interceptors once when we have both functions
    if (auth.refreshToken && auth.logout && !interceptorsSetup.current) {
      setupInterceptors(auth.refreshToken, auth.logout);
      interceptorsSetup.current = true;
    }

    // Cleanup interceptors on unmount
    return () => {
      if (interceptorsSetup.current) {
        clearInterceptors();
        interceptorsSetup.current = false;
      }
    };
  }, []); // Empty deps - only run once

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};