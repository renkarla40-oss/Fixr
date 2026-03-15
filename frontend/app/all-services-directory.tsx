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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const H_PAD = 16;
const CARD_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - CARD_GAP) / 2;

const SERVICES = [
  { key: 'plumbing',         label: 'Plumbing',          subtitle: 'Leaks \u2022 Pipes \u2022 Toilets',          icon: 'water-outline'          },
  { key: 'electrical',       label: 'Electrical',         subtitle: 'Wiring \u2022 Lighting \u2022 Breakers',     icon: 'flash-outline'          },
  { key: 'ac_hvac',          label: 'Air Conditioning',   subtitle: 'Repair \u2022 Service \u2022 Install',       icon: 'snow-outline'           },
  { key: 'appliance_repair', label: 'Appliance Repair',   subtitle: 'Fridge \u2022 Washer \u2022 Oven',          icon: 'hardware-chip-outline'  },
  { key: 'carpentry',        label: 'Carpentry',          subtitle: 'Furniture \u2022 Cabinets \u2022 Woodwork',  icon: 'hammer-outline'         },
  { key: 'welding',          label: 'Welding',            subtitle: 'Gates \u2022 Metal \u2022 Fabrication',      icon: 'flame-outline'          },
  { key: 'handyman',         label: 'Handyman',           subtitle: 'General Repairs \u2022 Installations',       icon: 'construct-outline'      },
  { key: 'landscaping',      label: 'Landscaping',        subtitle: 'Lawn \u2022 Trees \u2022 Garden',           icon: 'leaf-outline'           },
  { key: 'cleaning',         label: 'Cleaning',           subtitle: 'Home \u2022 Deep \u2022 Office',            icon: 'sparkles-outline'       },
  { key: 'renovation',       label: 'Renovation',         subtitle: 'Painting \u2022 Tiling \u2022 Remodeling',  icon: 'color-palette-outline'  },
] as const;

export type ServiceEntry = typeof SERVICES[number];
export { SERVICES };

export default function AllServicesDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const providerId   = params.providerId   as string | undefined;
  const providerName = params.providerName as string | undefined;

  const handleDescribeJob = () => {
    router.push({
      pathname: '/request-service',
      params: {
        providerId:   providerId   || '',
        providerName: providerName || '',
        category:     'other',
        categoryName: 'Other',
        subCategory:  '',
        location:     '',
      },
    });
  };

  const handleServicePress = (service: ServiceEntry) => {
    router.push({
      pathname: '/service-subcategory',
      params: {
        serviceKey:   service.key,
        serviceLabel: service.label,
        providerId:   providerId   || '',
        providerName: providerName || '',
      },
    });
  };

  const rows: ServiceEntry[][] = [];
  for (let i = 0; i < SERVICES.length; i += 2) {
    rows.push([SERVICES[i], SERVICES[i + 1]] as ServiceEntry[]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.describeCard} onPress={handleDescribeJob} activeOpacity={0.85}>
          <View style={styles.describeIconWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#E53935" />
          </View>
          <View style={styles.describeTextWrap}>
            <Text style={styles.describeTitle}>Describe Your Job</Text>
            <Text style={styles.describeSub}>Tell us what needs fixing</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#E53935" />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Browse by Service</Text>

        {rows.map((pair, rowIdx) => (
          <View key={rowIdx} style={styles.row}>
            {pair.map((service) => (
              <TouchableOpacity
                key={service.key}
                style={styles.serviceCard}
                onPress={() => handleServicePress(service)}
                activeOpacity={0.82}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={service.icon as any} size={22} color="#E53935" />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardLabel} numberOfLines={1}>{service.label}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={2}>{service.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#CCC" />
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F7F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: H_PAD, paddingTop: 20, gap: CARD_GAP },
  describeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E53935',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  describeIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF5F5',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  describeTextWrap: { flex: 1 },
  describeTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  describeSub: { fontSize: 12, color: '#666' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', gap: CARD_GAP },
  serviceCard: {
    width: CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFF5F5',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  textWrap: { flex: 1, marginRight: 4 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  cardSubtitle: { fontSize: 10, color: '#888', lineHeight: 13 },
});
