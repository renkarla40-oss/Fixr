/**
 * Screen Cache Module
 * 
 * Provides instant navigation by caching data between screen visits.
 * Features:
 * - Data caching with TTL (time-to-live)
 * - Refetch cooldown to prevent loops
 * - Single-flight protection (prevents duplicate in-flight requests)
 * - 429 backoff handling
 * - Timing logs for performance measurement
 * - Request cancellation on navigation away
 */

// Cache storage
const cache: Map<string, { data: any; timestamp: number }> = new Map();

// Cooldown tracking (prevents refetch loops)
const lastFetchTime: Map<string, number> = new Map();

// Active request abort controllers
const activeRequests: Map<string, AbortController> = new Map();

// SINGLE-FLIGHT: Track in-flight requests to prevent duplicates
const inFlightRequests: Map<string, boolean> = new Map();

// 429 BACKOFF: Track screens that received 429 to prevent hammering
const backoffUntil: Map<string, number> = new Map();

// Configuration
const CACHE_TTL_MS = 60000; // 1 minute - data considered "fresh"
const REFETCH_COOLDOWN_MS = 5000; // 5 seconds between refetches
const BACKOFF_BASE_MS = 2000; // Base backoff time for 429

/**
 * Get cached data for a screen
 */
export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.data as T;
}

/**
 * Check if cached data is still fresh (within TTL)
 */
export function isCacheFresh(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/**
 * Store data in cache
 */
export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Check if we should refetch (cooldown elapsed)
 */
export function shouldRefetch(key: string): boolean {
  const lastFetch = lastFetchTime.get(key) || 0;
  return Date.now() - lastFetch > REFETCH_COOLDOWN_MS;
}

/**
 * SINGLE-FLIGHT: Check if a fetch is already in progress
 */
export function isRequestInFlight(key: string): boolean {
  return inFlightRequests.get(key) === true;
}

/**
 * SINGLE-FLIGHT: Mark request as in-flight
 */
export function setRequestInFlight(key: string, inFlight: boolean): void {
  if (inFlight) {
    inFlightRequests.set(key, true);
  } else {
    inFlightRequests.delete(key);
  }
}

/**
 * 429 BACKOFF: Check if we're in backoff period
 */
export function isInBackoff(key: string): boolean {
  const until = backoffUntil.get(key) || 0;
  return Date.now() < until;
}

/**
 * 429 BACKOFF: Set backoff period after 429
 */
export function setBackoff(key: string, attempt: number = 1): void {
  const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s...
  backoffUntil.set(key, Date.now() + backoffMs);
  console.log(`[FETCH] ${key} 429 backoff ${backoffMs}ms (attempt ${attempt})`);
}

/**
 * 429 BACKOFF: Clear backoff on success
 */
export function clearBackoff(key: string): void {
  backoffUntil.delete(key);
}

/**
 * Mark that a fetch started (for cooldown)
 */
export function markFetchStarted(key: string): void {
  lastFetchTime.set(key, Date.now());
}

/**
 * Get or create abort controller for a screen
 */
export function getAbortController(key: string): AbortController {
  // Cancel any existing request
  const existing = activeRequests.get(key);
  if (existing) {
    existing.abort();
  }
  
  const controller = new AbortController();
  activeRequests.set(key, controller);
  return controller;
}

/**
 * Cancel active request for a screen
 */
export function cancelRequest(key: string): void {
  const controller = activeRequests.get(key);
  if (controller) {
    controller.abort();
    activeRequests.delete(key);
  }
}

/**
 * Clear request tracking (call when request completes)
 */
export function clearRequest(key: string): void {
  activeRequests.delete(key);
}

/**
 * Performance timing logger
 */
export function logTiming(screenName: string, event: 'render' | 'data_loaded', startTime: number): void {
  const duration = Date.now() - startTime;
  console.log(`[PERF] ${screenName} → ${event}: ${duration}ms`);
}

/**
 * Create a timing tracker for a screen
 */
export function createTimingTracker(screenName: string) {
  const mountTime = Date.now();
  let firstRenderLogged = false;
  
  return {
    logFirstRender: () => {
      if (!firstRenderLogged) {
        firstRenderLogged = true;
        logTiming(screenName, 'render', mountTime);
      }
    },
    logDataLoaded: () => {
      logTiming(screenName, 'data_loaded', mountTime);
    },
    getMountTime: () => mountTime,
  };
}

// Cache keys
export const CACHE_KEYS = {
  CUSTOMER_REQUESTS: 'customer_requests',
  CUSTOMER_REQUEST_DETAIL: (id: string) => `customer_request_${id}`,
  PROVIDER_JOBS: 'provider_jobs',
  PROVIDER_JOB_DETAIL: (id: string) => `provider_job_${id}`,
  CUSTOMER_INBOX: 'customer_inbox',
  PROVIDER_INBOX: 'provider_inbox',
};
