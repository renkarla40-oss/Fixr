/**
 * Universal API Client with Retry Logic and Error Handling
 * 
 * Features:
 * - Automatic retry on network/timeout errors ONLY (not on 4xx auth errors)
 * - Request timeout handling (30 seconds default)
 * - Detailed console logging: method + endpoint + status + duration ms
 * - User-friendly error messages: action name + endpoint + HTTP status code + backend message
 */

import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const RETRY_DELAY = 1500; // 1.5 seconds before retry
const RETRY_DELAY_429 = 2000; // 2 seconds for 429
const MAX_RETRIES = 2; // Retry twice on transient errors (was 1)

// Error types that should trigger a retry (network/timeout ONLY, not auth/4xx)
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504, 522, 524];
const RETRYABLE_ERROR_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH', 'ERR_NETWORK'];

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  message: string;        // User-friendly message
  statusCode?: number;    // HTTP status code
  action?: string;        // Action name (e.g., "Load My Requests")
  endpoint?: string;      // API endpoint path
  details?: string;       // Backend error message
  isTimeout?: boolean;
  isNetworkError?: boolean;
}

/**
 * Format error for user display popup
 * Format: {action} failed — {endpoint} → {status}: {backend message}
 * Or: {action} failed — timeout / server sleeping
 */
export function formatApiError(error: ApiError): string {
  const action = error.action || 'Request';
  const endpoint = error.endpoint ? ` — ${error.endpoint}` : '';
  
  if (error.isTimeout) {
    return `${action} failed${endpoint} → timeout (server may be sleeping)`;
  }
  
  if (error.isNetworkError) {
    return `${action} failed${endpoint} → network error (check your connection)`;
  }
  
  if (error.statusCode) {
    const details = error.details ? `: ${error.details}` : '';
    return `${action} failed${endpoint} → ${error.statusCode}${details}`;
  }
  
  return `${action} failed${endpoint}: ${error.message || 'Unknown error'}`;
}

/**
 * Log API request details to console
 */
function logApiCall(
  method: string,
  path: string,
  statusCode: number | string,
  durationMs: number,
  error?: string
) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const status = typeof statusCode === 'number' ? statusCode : statusCode;
  const errorPart = error ? ` | ERROR: ${error}` : '';
  
  console.log(`[API ${timestamp}] ${method.toUpperCase()} ${path} → ${status} (${durationMs}ms)${errorPart}`);
}

/**
 * Determine if an error should trigger a retry
 */
function shouldRetry(error: AxiosError): boolean {
  // Don't retry on 4xx client errors (except 408 timeout)
  if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408) {
    return false;
  }
  
  // Retry on specific status codes
  if (error.response?.status && RETRYABLE_STATUS_CODES.includes(error.response.status)) {
    return true;
  }
  
  // Retry on network errors
  if (error.code && RETRYABLE_ERROR_CODES.includes(error.code)) {
    return true;
  }
  
  // Retry on timeout
  if (error.message?.includes('timeout')) {
    return true;
  }
  
  return false;
}

/**
 * Parse error response from backend
 */
function parseErrorResponse(error: AxiosError): { message: string; details?: string } {
  const responseData = error.response?.data as any;
  
  if (responseData?.detail) {
    return { message: responseData.detail, details: responseData.detail };
  }
  if (responseData?.message) {
    return { message: responseData.message, details: responseData.message };
  }
  if (responseData?.error) {
    return { message: responseData.error, details: responseData.error };
  }
  
  return { message: error.message || 'Unknown error' };
}

/**
 * Sleep utility for retry delay
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Universal API request function with retry logic
 */
export async function apiRequest<T = any>(
  config: AxiosRequestConfig & { actionName?: string }
): Promise<ApiResponse<T>> {
  const { actionName, ...axiosConfig } = config;
  const startTime = Date.now();
  const method = axiosConfig.method || 'GET';
  const url = axiosConfig.url || '';
  const path = url.replace(BACKEND_URL || '', '');
  
  let lastError: ApiError | null = null;
  let attempts = 0;
  
  while (attempts <= MAX_RETRIES) {
    attempts++;
    const attemptStart = Date.now();
    
    try {
      const response: AxiosResponse<T> = await axios({
        timeout: DEFAULT_TIMEOUT,
        ...axiosConfig,
      });
      
      const duration = Date.now() - attemptStart;
      logApiCall(method, path, response.status, duration);
      
      return {
        success: true,
        data: response.data,
      };
    } catch (err) {
      const axiosError = err as AxiosError;
      const duration = Date.now() - attemptStart;
      const statusCode = axiosError.response?.status;
      const isTimeout = axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout');
      const isNetworkError = RETRYABLE_ERROR_CODES.includes(axiosError.code || '');
      const { message, details } = parseErrorResponse(axiosError);
      
      logApiCall(method, path, statusCode || axiosError.code || 'ERROR', duration, message);
      
      lastError = {
        message,
        statusCode,
        action: actionName,
        endpoint: path,
        details,
        isTimeout,
        isNetworkError,
      };
      
      // Check if we should retry
      if (attempts <= MAX_RETRIES && shouldRetry(axiosError)) {
        const is429 = axiosError.response?.status === 429;
        const delayMs = is429 ? RETRY_DELAY_429 * attempts : RETRY_DELAY; // Exponential for 429
        console.log(`[FETCH] ${path} ${is429 ? '429 backoff' : 'retry'} attempt ${attempts} (${delayMs}ms)`);
        await sleep(delayMs);
        continue;
      }
      
      // No more retries, return error
      break;
    }
  }
  
  return {
    success: false,
    error: lastError || { message: 'Unknown error', action: actionName, endpoint: path },
  };
}

/**
 * Convenience methods
 */
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig & { actionName?: string }) =>
    apiRequest<T>({ ...config, method: 'GET', url }),
  
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig & { actionName?: string }) =>
    apiRequest<T>({ ...config, method: 'POST', url, data }),
  
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig & { actionName?: string }) =>
    apiRequest<T>({ ...config, method: 'PUT', url, data }),
  
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig & { actionName?: string }) =>
    apiRequest<T>({ ...config, method: 'PATCH', url, data }),
  
  delete: <T = any>(url: string, config?: AxiosRequestConfig & { actionName?: string }) =>
    apiRequest<T>({ ...config, method: 'DELETE', url }),
};

export default api;
