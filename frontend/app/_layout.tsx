import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { FavoritesProvider } from '../contexts/FavoritesContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * ROOT LAYOUT - STABILITY FIX
 * 
 * Wrapped in ErrorBoundary to catch ALL uncaught errors.
 * NO errors will ever reach the user.
 */
export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <FavoritesProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="welcome" />
                  <Stack.Screen name="role-selection" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="signup" />
                  <Stack.Screen name="customer-onboarding" />
                  <Stack.Screen name="provider-setup" />
                  <Stack.Screen name="(customer)" />
                  <Stack.Screen name="(provider)" />
                </Stack>
              </FavoritesProvider>
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
