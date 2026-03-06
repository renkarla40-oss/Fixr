/**
 * Standardized Error Messages for Fixr MVP
 * Maps backend error codes to user-friendly messages
 */

// Error code to user-friendly message mapping
export const ERROR_MESSAGES: Record<string, string> = {
  // OTP errors
  INVALID_OTP: "That code doesn't match. Please try again.",
  EXPIRED_OTP: "This code has expired. Please request a new one.",
  
  // Status transition errors
  INVALID_STATUS_TRANSITION: "This action isn't available right now.",
  INVALID_STATUS: "This action can't be performed in the current state.",
  
  // Idempotency / duplicate action errors
  ALREADY_ACCEPTED: "This job has already been accepted.",
  ALREADY_QUOTED: "A quote has already been sent for this job.",
  ALREADY_PAID: "This job has already been paid.",
  ALREADY_IN_PROGRESS: "This job is already in progress.",
  ALREADY_COMPLETED: "This job has already been completed.",
  
  // Resource errors
  NO_QUOTE_FOUND: "No quote found for this job.",
  QUOTE_NOT_FOUND: "Quote not found.",
  REQUEST_NOT_FOUND: "Job request not found.",
  PROVIDER_NOT_FOUND: "Provider not found.",
  USER_NOT_FOUND: "User not found.",
  
  // Availability errors
  PROVIDER_NOT_AVAILABLE: "This provider isn't available right now.",
  PROVIDER_NOT_ACCEPTING: "This provider isn't accepting new jobs.",
  
  // Auth errors
  UNAUTHORIZED: "You're not authorized to perform this action.",
  NOT_AUTHORIZED: "You don't have permission for this action.",
  INVALID_CREDENTIALS: "Invalid email or password.",
  SESSION_EXPIRED: "Your session has expired. Please log in again.",
  
  // Payment errors
  PAYMENT_FAILED: "Payment could not be processed. Please try again.",
  PAYMENT_REQUIRED: "Payment is required before this action.",
  
  // Network / fallback
  NETWORK_ERROR: "Connection issue. Please check your internet and try again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
};

/**
 * Extract error code from API response (handles both formats)
 * Format 1: { detail: { message, errorCode } }
 * Format 2: { success: true, message, errorCode }
 * Format 3: { detail: "string message" }
 */
export function getErrorCode(error: any): string | null {
  if (!error) return null;
  
  // Format 1: HTTPException with detail object
  if (error.response?.data?.detail?.errorCode) {
    return error.response.data.detail.errorCode;
  }
  
  // Format 2: Direct errorCode in response
  if (error.response?.data?.errorCode) {
    return error.response.data.errorCode;
  }
  
  // Format 3: errorCode directly on error object
  if (error.errorCode) {
    return error.errorCode;
  }
  
  // Check for detail.errorCode directly
  if (error.detail?.errorCode) {
    return error.detail.errorCode;
  }
  
  return null;
}

/**
 * Extract error message from API response
 */
export function getErrorMessage(error: any): string | null {
  if (!error) return null;
  
  // Format 1: HTTPException with detail object
  if (error.response?.data?.detail?.message) {
    return error.response.data.detail.message;
  }
  
  // Format 2: Direct message in response
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  // Format 3: detail is a string
  if (typeof error.response?.data?.detail === 'string') {
    return error.response.data.detail;
  }
  
  // Format 4: message directly on error
  if (error.message) {
    return error.message;
  }
  
  // Check detail.message directly
  if (error.detail?.message) {
    return error.detail.message;
  }
  
  if (typeof error.detail === 'string') {
    return error.detail;
  }
  
  return null;
}

/**
 * Get user-friendly message for an error
 * Prioritizes errorCode mapping, falls back to raw message, then default
 */
export function getUserFriendlyError(error: any, defaultMessage?: string): string {
  const errorCode = getErrorCode(error);
  
  // If we have an error code, use the mapped message
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    return ERROR_MESSAGES[errorCode];
  }
  
  // Check for network errors
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  // Fall back to the raw message if it exists and is user-friendly
  const rawMessage = getErrorMessage(error);
  if (rawMessage && !rawMessage.includes('status') && !rawMessage.includes('transition')) {
    // Only use raw message if it doesn't contain technical terms
    return rawMessage;
  }
  
  // Use default or generic message
  return defaultMessage || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Check if error response indicates idempotent success
 * (action was already performed, but it's not an error)
 */
export function isIdempotentSuccess(response: any): boolean {
  if (!response) return false;
  
  const data = response.data || response;
  
  // Check for success: true with an errorCode (idempotent pattern)
  if (data.success === true && data.errorCode) {
    return true;
  }
  
  return false;
}

/**
 * Get message for idempotent success responses
 */
export function getIdempotentMessage(response: any): string {
  const data = response?.data || response;
  const errorCode = data?.errorCode;
  
  if (errorCode && ERROR_MESSAGES[errorCode]) {
    return ERROR_MESSAGES[errorCode];
  }
  
  return data?.message || "Action already completed.";
}
