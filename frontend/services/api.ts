/**
 * Centralized API Client with Error Handling
 * 
 * This module provides:
 * - A configured axios instance with interceptors
 * - Standardized error handling that NEVER exposes technical details to users
 * - User-friendly error messages for all failure scenarios
 */

import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Friendly error messages - NEVER show technical details to users
export const ERROR_MESSAGES = {
  NETWORK: "Can't connect right now. Please check your internet and try again.",
  SESSION_EXPIRED: "Your session expired. Please sign in again.",
  NOT_FOUND: "We couldn't find that item. Please refresh.",
  SERVER_ERROR: "Something went wrong. Please try again.",
  VALIDATION: "Please check your input and try again.",
  UNAUTHORIZED: "You don't have permission to do that.",
  DEFAULT: "Something went wrong. Please try again.",
} as const;

// Normalized error object returned to UI
export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

// Type guard for AxiosError
function isAxiosError(error: unknown): error is AxiosError {
  return (error as AxiosError)?.isAxiosError === true;
}

/**
 * Maps HTTP status codes and error types to user-friendly messages
 */
export function getErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    // Non-Axios error - return generic message
    if (__DEV__) {
      console.error('[API] Non-Axios error:', error);
    }
    return ERROR_MESSAGES.DEFAULT;
  }

  const status = error.response?.status;
  const errorCode = error.code;

  // Network/Connection errors
  if (errorCode === 'ECONNABORTED' || errorCode === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
    return ERROR_MESSAGES.NETWORK;
  }

  // Timeout errors
  if (errorCode === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return ERROR_MESSAGES.NETWORK;
  }

  // HTTP Status based errors
  if (status) {
    switch (status) {
      case 400:
        // Try to get validation message from response, but sanitize it
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.length < 100 && !detail.includes('Error') && !detail.includes('error')) {
          return detail;
        }
        return ERROR_MESSAGES.VALIDATION;
      case 401:
        return ERROR_MESSAGES.SESSION_EXPIRED;
      case 403:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 404:
        return ERROR_MESSAGES.NOT_FOUND;
      case 422:
        return ERROR_MESSAGES.VALIDATION;
      case 500:
      case 502:
      case 503:
      case 504:
        return ERROR_MESSAGES.SERVER_ERROR;
      default:
        if (status >= 400 && status < 500) {
          return ERROR_MESSAGES.VALIDATION;
        }
        if (status >= 500) {
          return ERROR_MESSAGES.SERVER_ERROR;
        }
    }
  }

  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Normalizes any error into a safe ApiError object
 */
export function normalizeError(error: unknown): ApiError {
  const message = getErrorMessage(error);
  
  if (isAxiosError(error)) {
    return {
      code: error.code || 'UNKNOWN',
      message,
      status: error.response?.status,
    };
  }

  return {
    code: 'UNKNOWN',
    message,
  };
}

/**
 * Create the configured axios instance
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BACKEND_URL,
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - adds auth token
  client.interceptors.request.use(
    async (config) => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Silent fail - no token means unauthenticated request
      }
      return config;
    },
    (error) => {
      // Log in dev only
      if (__DEV__) {
        console.error('[API Request Error]', error);
      }
      return Promise.reject(error);
    }
  );

  // Response interceptor - handles errors
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError) => {
      // Log full error in development only
      if (__DEV__) {
        console.error('[API Response Error]', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
          code: error.code,
          message: error.message,
        });
      }

      // Return normalized error - NEVER expose raw Axios error to UI
      return Promise.reject(normalizeError(error));
    }
  );

  return client;
}

// Export the singleton API client
export const api = createApiClient();

/**
 * Helper for making authenticated requests with the centralized client
 * Use this instead of raw axios throughout the app
 */
export default api;
