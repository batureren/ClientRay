// src/services/api.js

import axios from 'axios';

// Create a new Axios instance with a base URL
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store the interceptor IDs so we can properly eject them
let responseInterceptorId = null;
let requestInterceptorId = null;

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Function to set up the interceptors
export const setupInterceptors = (refreshToken, logout) => {
  // Clear any existing interceptors to avoid duplicates
  if (responseInterceptorId !== null) {
    api.interceptors.response.eject(responseInterceptorId);
  }
  if (requestInterceptorId !== null) {
    api.interceptors.request.eject(requestInterceptorId);
  }

  // Request interceptor to add the auth token to every request
  requestInterceptorId = api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle token refresh
  responseInterceptorId = api.interceptors.response.use(
    (response) => response,

    async (error) => {
      const originalRequest = error.config;

      // Check if the error is a 401 and we haven't retried yet
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch(err => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        console.log('Token expired. Attempting to refresh...');

        try {
          const refreshSuccess = await refreshToken();

          if (refreshSuccess) {
            console.log('Token refreshed successfully. Retrying original request.');
            
            const newAuthToken = localStorage.getItem('auth_token');
            originalRequest.headers['Authorization'] = `Bearer ${newAuthToken}`;
            
            // Process any queued requests
            processQueue(null, newAuthToken);
            
            // Retry the original request
            return api(originalRequest);
          } else {
            console.error('Token refresh failed. Logging out.');
            processQueue(new Error('Token refresh failed'), null);
            logout();
            return Promise.reject(new Error('Session expired. Please log in again.'));
          }
        } catch (refreshError) {
          console.error('An error occurred during token refresh. Logging out.', refreshError);
          processQueue(refreshError, null);
          logout();
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // For any other errors, just reject the promise
      return Promise.reject(error);
    }
  );

  return api;
};

// Clean up interceptors (useful for testing or unmounting)
export const clearInterceptors = () => {
  if (responseInterceptorId !== null) {
    api.interceptors.response.eject(responseInterceptorId);
    responseInterceptorId = null;
  }
  if (requestInterceptorId !== null) {
    api.interceptors.request.eject(requestInterceptorId);
    requestInterceptorId = null;
  }
};

export default api;