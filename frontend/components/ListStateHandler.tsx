/**
 * ListStateHandler - Shared component for consistent loading/empty/error states
 * Prevents "empty flash" during rapid tab switching by only showing empty state
 * when loading is complete AND data is truly empty.
 * 
 * USAGE:
 * - Pass hasData={items.length > 0} to determine if list has content
 * - Pass loading={true} during initial fetch
 * - Pass error={errorMessage} if fetch failed
 * - Children rendered when hasData is true OR when still loading with stale data
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ListStateHandlerProps {
  // Core state
  loading: boolean;
  hasData: boolean;
  error?: string | null;
  onRetry?: () => void;
  
  // Empty state customization
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyTitle?: string;
  emptyMessage?: string;
  
  // Loading state customization
  loadingText?: string;
  
  // Children to render when data exists
  children: React.ReactNode;
}

// Consistent copy across all screens
const DEFAULT_LOADING_TEXT = 'Loading...';
const DEFAULT_ERROR_TEXT = "Couldn't load. Tap to retry.";
const DEFAULT_EMPTY_TITLE = 'Nothing here yet';
const DEFAULT_EMPTY_MESSAGE = 'Pull down to refresh.';

export default function ListStateHandler({
  loading,
  hasData,
  error,
  onRetry,
  emptyIcon = 'folder-open-outline',
  emptyTitle = DEFAULT_EMPTY_TITLE,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  loadingText = DEFAULT_LOADING_TEXT,
  children,
}: ListStateHandlerProps) {
  
  // CRITICAL: Show loading state ONLY on initial load (no data yet)
  // If we have stale data, show it while loading in background
  if (loading && !hasData) {
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color="#D74826" />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }
  
  // Error state with retry button
  if (error && !hasData) {
    return (
      <View style={styles.centerContent}>
        <Ionicons name="cloud-offline-outline" size={48} color="#999" />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  // Empty state - ONLY show when loading is complete AND truly empty
  if (!loading && !hasData && !error) {
    return (
      <View style={styles.centerContent}>
        <Ionicons name={emptyIcon} size={64} color="#CCC" />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyMessage}>{emptyMessage}</Text>
      </View>
    );
  }
  
  // Data exists - render children (list content)
  return <>{children}</>;
}

const styles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#D74826',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  emptyMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});
