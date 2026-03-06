import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../contexts/NotificationContext';
import { getTabBarScreenOptions, TAB_BADGE_STYLE } from '../../constants/tabBarConfig';

export default function ProviderLayout() {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const bottomInset = insets.bottom;

  return (
    <Tabs screenOptions={getTabBarScreenOptions(bottomInset)}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
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
          tabBarBadgeStyle: TAB_BADGE_STYLE,
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
      {/* Hide request-detail from tabs - accessed via Home/Inbox */}
      <Tabs.Screen
        name="request-detail"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}