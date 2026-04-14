/**
 * Shared Tab Bar Configuration
 * Single source of truth for tab bar styling across Customer and Provider layouts
 * DO NOT modify Customer tab bar - it is the design source of truth
 */

import { StyleSheet } from 'react-native';

// Tab bar colors - shared across all roles
export const TAB_COLORS = {
  active: '#D74826',
  inactive: 'rgba(26,26,26,0.5)',
  background: '#E4E8EC',
  border: '#F5F7FA',
  badge: '#D74826',
};

// Calculate tab bar height based on safe area inset
export const getTabBarHeight = (bottomInset: number) => 50 + bottomInset;

// Shared screen options for tab bar styling
export const getTabBarScreenOptions = (bottomInset: number) => ({
  tabBarActiveTintColor: TAB_COLORS.active,
  tabBarInactiveTintColor: TAB_COLORS.inactive,
  tabBarStyle: {
    backgroundColor: TAB_COLORS.background,
    borderTopWidth: 0,
    borderTopColor: TAB_COLORS.border,
    height: getTabBarHeight(bottomInset),
    paddingBottom: bottomInset,
    paddingTop: 4,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
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
  color: '#FFFFFF',
  fontSize: 10,
  minWidth: 18,
  height: 18,
};

// Standard icon size (expo-router default)
export const TAB_ICON_SIZE = 24;
