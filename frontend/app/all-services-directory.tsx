import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDisplayableCategories, ServiceCategory } from '../constants/serviceCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - CARD_GAP) / 2;

// Emoji + pastel bg per service — matches Home featured card style exactly
const SERVICE_META: Record<string, { emoji: string; bg: string }> = {
  plumbing:    { emoji: '🔧', bg: '#E3F2FD' },
  electrical:  { emoji: '⚡', bg: '#FFF8E1' },
  ac:          { emoji: '❄️', bg: '#E3F2FD' },
  appliance:   { emoji: '🧹', bg: '#F3E5F5' },
  carpentry:   { emoji: '🪚', bg: '#F3E5F5' },
  welding:     { emoji: '🔥', bg: '#FBE9E7' },
  handyman:    { emoji: '🛠️', bg: '#E8F5E9' },
  cleaning:    { emoji: '✨', bg: '#F3E5F5' },
  landscaping: { emoji: '🌿', bg: '#E0F2F1' },
  painting:    { emoji: '🎨', bg: '#FFF3E0' },
  flooring:    { emoji: '🏗️', bg: '#F3E5F5' },
  roofing:     { emoji: '🏠', bg: '#FFF3E0' },
};

const SERVICES = getDisplayableCategories();
export type ServiceEntry = ServiceCategory;
export { SERVICES };

export default function AllServicesDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const providerId = params.providerId as string | undefined;
  const providerName = params.providerName as string | undefined;

  const handleDescribeJob = () => {
    router.push({
      pathname: '/request-service',
      params: {
        providerId: providerId || '',
        providerName: providerName || '',
        category: 'other',
        categoryName: 'Other',
        subCategory: '',
        location: '',
      },
    });
  };

  // Navigate using the same subcategory-screen as the main Home cards
  const handleServicePress = (service: ServiceEntry) => {
    router.push({
      pathname: '/subcategory-screen',
      params: {
        serviceKey: service.serviceKey,
      },
    });
  };

  // Pair services into rows of 2
  const rows: ServiceEntry[][] = [];
  for (let i = 0; i < SERVICES.length; i += 2) {
    rows.push([SERVICES[i], SERVICES[i + 1]] as ServiceEntry[]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header — padded below notch/camera */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>All Services</Text>
          <Text style={styles.headerSub}>Find the right professional for the job</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Describe Your Job — top quick-action */}
        <TouchableOpacity style={styles.describeCard} onPress={handleDescribeJob} activeOpacity={0.85}>
          <View style={styles.describeIconWrap}>
            <Text style={styles.describeEmoji}>{'💬'}</Text>
          </View>
          <View style={styles.describeTextWrap}>
            <Text style={styles.describeTitle}>Describe Your Job</Text>
            <Text style={styles.describeSub}>Tell us what needs fixing</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#E53935" />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Browse by Service</Text>

        {/* 2-column grid — each card matches Home featured card style */}
        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {pair.map((service) => {
              const meta = SERVICE_META[service.serviceKey] || { emoji: '🔧', bg: '#F5F5F5' };
              return (
                <TouchableOpacity
                  key={service.serviceKey}
                  style={[styles.serviceCard, { backgroundColor: meta.bg }]}
                  onPress={() => handleServicePress(service)}
                  activeOpacity={0.82}
                >
                  <Text style={styles.serviceEmoji}>{meta.emoji}</Text>
                  <Text style={styles.serviceLabel} numberOfLines={1}>{service.label}</Text>
                  <Text style={styles.serviceSubtitle} numberOfLines={2}>{service.description}</Text>
                </TouchableOpacity>
              );
            })}
            {pair.length === 1 && <View style={[styles.serviceCard, styles.ghostCard]} />}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    gap: CARD_GAP,
  },
  // Describe card — red border accent, matches home CTA style
  describeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F9',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E5E7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  describeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  describeEmoji: { fontSize: 22 },
  describeTextWrap: { flex: 1 },
  describeTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  describeSub: { fontSize: 12, color: '#666' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  // Grid
  row: { flexDirection: 'row', gap: CARD_GAP },
  // Service card — square, emoji centered on top, label + subtitle below
  // Matches Home featuredCard: same border radius, shadow, emoji-first layout
  serviceCard: {
    width: CARD_WIDTH,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 130,
  },
  ghostCard: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  serviceEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  serviceSubtitle: {
    fontSize: 10,
    color: '#555',
    textAlign: 'center',
    lineHeight: 14,
  },
});
