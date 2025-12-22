import React from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
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
      </AuthProvider>
    </GestureHandlerRootView>
  );
}