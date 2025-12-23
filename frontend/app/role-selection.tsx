import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'customer' | 'provider' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      router.push({
        pathname: '/signup',
        params: { role: selectedRole },
      });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Choose Your Role</Text>
          <Text style={styles.subtitle}>You can switch between roles later</Text>
        </View>

        <View style={styles.cardsContainer}>
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'customer' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('customer')}
            activeOpacity={0.8}
          >
            <View style={styles.cardIcon}>
              <Ionicons
                name="person"
                size={48}
                color={selectedRole === 'customer' ? '#E53935' : '#666'}
              />
            </View>
            <Text style={styles.roleTitle}>Customer</Text>
            <Text style={styles.roleDescription}>
              Find and hire trusted service providers for your home needs
            </Text>
            {selectedRole === 'customer' && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={28} color="#E53935" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'provider' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('provider')}
            activeOpacity={0.8}
          >
            <View style={styles.cardIcon}>
              <Ionicons
                name="construct"
                size={48}
                color={selectedRole === 'provider' ? '#E53935' : '#666'}
              />
            </View>
            <Text style={styles.roleTitle}>Provider</Text>
            <Text style={styles.roleDescription}>
              Offer your services and connect with customers in your area
            </Text>
            {selectedRole === 'provider' && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={28} color="#E53935" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedRole && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedRole}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  cardsContainer: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 200,
  },
  roleCardSelected: {
    backgroundColor: '#F0F7FF',
    borderColor: '#4A90E2',
  },
  cardIcon: {
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  checkmark: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
  },
  continueButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#CCC',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});