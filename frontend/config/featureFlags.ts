/**
 * MVP Feature Flags for Fixr
 * 
 * These flags control feature availability during MVP phase.
 * Values should match backend /api/config/feature-flags
 */

export const FEATURE_FLAGS = {
  /**
   * MVP Mode - When true, app runs in simplified MVP configuration
   */
  MVP_MODE: true,

  /**
   * Location Matching - When false, providers shown nationwide (MVP behavior)
   * When true, providers filtered by distance/travel radius
   */
  ENABLE_LOCATION_MATCHING: false,

  /**
   * Reviews System - When false, review UI is hidden
   * When true, customers can leave reviews after job completion
   */
  ENABLE_REVIEWS: false,

  /**
   * Push Notifications - When false, notification features disabled
   * When true, push notifications enabled for job updates
   */
  ENABLE_NOTIFICATIONS: false,
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[feature] === true;
}

/**
 * Check if we're in MVP mode
 */
export function isMVPMode(): boolean {
  return FEATURE_FLAGS.MVP_MODE;
}

/**
 * Check if location matching is enabled
 */
export function isLocationMatchingEnabled(): boolean {
  return FEATURE_FLAGS.ENABLE_LOCATION_MATCHING;
}

/**
 * Check if reviews are enabled
 */
export function isReviewsEnabled(): boolean {
  return FEATURE_FLAGS.ENABLE_REVIEWS;
}

/**
 * Check if notifications are enabled
 */
export function isNotificationsEnabled(): boolean {
  return FEATURE_FLAGS.ENABLE_NOTIFICATIONS;
}
