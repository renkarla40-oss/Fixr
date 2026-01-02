import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../contexts/NotificationContext';

export default function ProviderLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  
  // Calculate proper bottom padding:
  // - On iOS: use safe area inset (for home indicator)
  // - On Android: use safe area inset + extra padding for system nav bar
  const bottomInset = insets.bottom;
  const extraPadding = Platform.OS === 'android' ? 12 : 0;
  const totalBottomPadding = bottomInset + extraPadding + 8;
  
  // Minimum tab bar height for proper touch targets (48dp minimum per button)
  const minTabBarHeight = 60;
  const tabBarHeight = Math.max(minTabBarHeight + totalBottomPadding, Platform.OS === 'ios' ? 90 : 80);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#E53935',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          height: tabBarHeight,
          paddingBottom: totalBottomPadding,
          paddingTop: 8,
          // Ensure tab bar sits above system navigation
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        // Increase touch target for better accessibility
        tabBarItemStyle: {
          paddingVertical: 4,
          minHeight: 48,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'My Jobs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#E53935',
            fontSize: 10,
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}