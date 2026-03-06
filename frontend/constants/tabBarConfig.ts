/**
 * Shared Tab Bar Configuration
 * Single source of truth for tab bar styling across Customer and Provider layouts
 * DO NOT modify Customer tab bar - it is the design source of truth
 */

import { StyleSheet } from 'react-native';

// Tab bar colors - shared across all roles
export const TAB_COLORS = {
  active: '#E53935',
  inactive: '#999',
  background: '#FFFFFF',
  border: '#E0E0E0',
  badge: '#E53935',
};

// Calculate tab bar height based on safe area inset
export const getTabBarHeight = (bottomInset: number) => 50 + bottomInset;

// Shared screen options for tab bar styling
export const getTabBarScreenOptions = (bottomInset: number) => ({
  tabBarActiveTintColor: TAB_COLORS.active,
  tabBarInactiveTintColor: TAB_COLORS.inactive,
  tabBarStyle: {
    backgroundColor: TAB_COLORS.background,
    borderTopWidth: 1,
    borderTopColor: TAB_COLORS.border,
    height: getTabBarHeight(bottomInset),
    paddingBottom: bottomInset,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    // Ensure flat edge-to-edge appearance
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginHorizontal: 0,
  },
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '600' as const,
    marginTop: 0,
    marginBottom: 2,
  },
  tabBarIconStyle: {
    marginTop: 2,
    marginBottom: 0,
  },
  // Maintain minimum touch target for accessibility
  tabBarItemStyle: {
    paddingVertical: 2,
    minHeight: 44,
  },
  headerShown: false,
});

// Shared badge style for unread counts
export const TAB_BADGE_STYLE = {
  backgroundColor: TAB_COLORS.badge,
  fontSize: 10,
  minWidth: 18,
  height: 18,
};

// Standard icon size (expo-router default)
export const TAB_ICON_SIZE = 24;
