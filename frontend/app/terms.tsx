import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Terms of Service</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.lastUpdated}>Last updated: December 2025</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.sectionText}>
              By accessing and using Fixr, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. Service Description</Text>
            <Text style={styles.sectionText}>
              Fixr is a platform that connects customers seeking home services with service providers. We facilitate the connection but are not responsible for the actual services provided.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. User Accounts</Text>
            <Text style={styles.sectionText}>
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must provide accurate and complete information when creating an account.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Provider Responsibilities</Text>
            <Text style={styles.sectionText}>
              Service providers must maintain appropriate licenses and insurance as required by law. Providers are responsible for the quality and safety of their services.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>5. Customer Responsibilities</Text>
            <Text style={styles.sectionText}>
              Customers agree to provide accurate service requests and treat providers with respect. Payment for services is handled directly between customers and providers.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Prohibited Conduct</Text>
            <Text style={styles.sectionText}>
              Users may not use Fixr for any illegal purposes, to harass others, or to transmit harmful content. We reserve the right to terminate accounts that violate these terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
            <Text style={styles.sectionText}>
              Fixr is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use of our service or the services provided by third-party providers.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
            <Text style={styles.sectionText}>
              We may update these terms from time to time. Continued use of Fixr after changes constitutes acceptance of the new terms.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>9. Contact</Text>
            <Text style={styles.sectionText}>
              For questions about these Terms of Service, please contact us at support@fixr.app.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#999',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});
