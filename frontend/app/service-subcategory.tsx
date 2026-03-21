import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUBCATEGORIES: Record<string, { key: string; label: string; icon: string }[]> = {
  plumbing: [
    { key: 'leak_repair',      label: 'Leak Repair',              icon: 'warning-outline'       },
    { key: 'pipe_install',     label: 'Pipe Installation',        icon: 'construct-outline'     },
    { key: 'drain_cleaning',   label: 'Drain Cleaning',           icon: 'refresh-outline'       },
    { key: 'toilet_repair',    label: 'Toilet Repair',            icon: 'construct-outline'     },
    { key: 'sink_faucet',      label: 'Sink & Faucet Repair',     icon: 'water-outline'         },
    { key: 'water_pump',       label: 'Water Pump Installation',  icon: 'settings-outline'      },
    { key: 'water_tank',       label: 'Water Tank Installation',  icon: 'cube-outline'          },
    { key: 'shower_install',   label: 'Shower Installation',      icon: 'rainy-outline'         },
  ],
  electrical: [
    { key: 'wiring_repair',    label: 'Wiring Repair',            icon: 'flash-outline'         },
    { key: 'breaker_panel',    label: 'Breaker / Panel Issues',   icon: 'warning-outline'       },
    { key: 'lighting_install', label: 'Lighting Installation',    icon: 'bulb-outline'          },
    { key: 'outlet_switch',    label: 'Outlet & Switch Repair',   icon: 'power-outline'         },
    { key: 'ceiling_fan',      label: 'Ceiling Fan Installation', icon: 'partly-sunny-outline'  },
    { key: 'outdoor_lighting', label: 'Outdoor Lighting',         icon: 'sunny-outline'         },
    { key: 'security_cam',     label: 'Security Camera Install',  icon: 'camera-outline'        },
    { key: 'doorbell',         label: 'Doorbell Installation',    icon: 'notifications-outline' },
  ],
  ac_hvac: [
    { key: 'ac_repair',        label: 'A/C Repair',               icon: 'build-outline'         },
    { key: 'ac_service',       label: 'A/C Servicing',            icon: 'settings-outline'      },
    { key: 'ac_install',       label: 'A/C Installation',         icon: 'add-circle-outline'    },
    { key: 'gas_refill',       label: 'Gas Refill',               icon: 'flask-outline'         },
    { key: 'leak_detect',      label: 'Leak Detection',           icon: 'search-outline'        },
    { key: 'thermostat',       label: 'Thermostat Repair',        icon: 'thermometer-outline'   },
    { key: 'split_unit',       label: 'Split Unit Maintenance',   icon: 'construct-outline'     },
    { key: 'indoor_cleaning',  label: 'Indoor Unit Cleaning',     icon: 'brush-outline'         },
  ],
  appliance_repair: [
    { key: 'fridge',           label: 'Refrigerator Repair',      icon: 'snow-outline'          },
    { key: 'washing_machine',  label: 'Washing Machine Repair',   icon: 'water-outline'         },
    { key: 'dryer',            label: 'Dryer Repair',             icon: 'flame-outline'         },
    { key: 'stove_oven',       label: 'Stove / Oven Repair',      icon: 'flame-outline'         },
    { key: 'microwave',        label: 'Microwave Repair',         icon: 'radio-outline'         },
    { key: 'dishwasher',       label: 'Dishwasher Repair',        icon: 'water-outline'         },
    { key: 'small_appliance',  label: 'Small Appliance Repair',   icon: 'build-outline'         },
  ],
  carpentry: [
    { key: 'furniture_asm',    label: 'Furniture Assembly',       icon: 'cube-outline'          },
    { key: 'cabinet_repair',   label: 'Cabinet Repair',           icon: 'grid-outline'          },
    { key: 'shelving',         label: 'Shelving Installation',    icon: 'layers-outline'        },
    { key: 'door_frame',       label: 'Door Frame Repair',        icon: 'log-in-outline'        },
    { key: 'custom_woodwork',  label: 'Custom Woodwork',          icon: 'hammer-outline'        },
    { key: 'furniture_repair', label: 'Wood Furniture Repair',    icon: 'construct-outline'     },
  ],
  welding: [
    { key: 'gate_repair',      label: 'Gate Repair',              icon: 'git-branch-outline'    },
    { key: 'burglar_proof',    label: 'Burglar Proofing Repair',  icon: 'shield-outline'        },
    { key: 'metal_fab',        label: 'Metal Fabrication',        icon: 'construct-outline'     },
    { key: 'railing_repair',   label: 'Railing Repair',           icon: 'reorder-three-outline' },
    { key: 'fence_welding',    label: 'Fence Welding',            icon: 'stop-outline'          },
    { key: 'custom_metal',     label: 'Custom Metal Work',        icon: 'options-outline'       },
  ],
  handyman: [
    { key: 'general_repairs',  label: 'General Repairs',          icon: 'hammer-outline'        },
    { key: 'tv_mount',         label: 'TV Mounting',              icon: 'tv-outline'            },
    { key: 'curtain_rod',      label: 'Curtain Rod Installation', icon: 'reorder-two-outline'   },
    { key: 'wall_repair',      label: 'Minor Wall Repair',        icon: 'color-filter-outline'  },
    { key: 'lock_replace',     label: 'Lock Replacement',         icon: 'lock-closed-outline'   },
    { key: 'door_repair',      label: 'Door Repair',              icon: 'log-in-outline'        },
    { key: 'window_repair',    label: 'Window Repair',            icon: 'apps-outline'          },
    { key: 'pressure_wash',    label: 'Pressure Washing',         icon: 'water-outline'         },
  ],
  landscaping: [
    { key: 'lawn_cutting',     label: 'Lawn Cutting',             icon: 'cut-outline'           },
    { key: 'tree_trimming',    label: 'Tree Trimming',            icon: 'leaf-outline'          },
    { key: 'bush_cutting',     label: 'Bush Cutting',             icon: 'cut-outline'           },
    { key: 'yard_cleanup',     label: 'Yard Cleanup',             icon: 'trash-outline'         },
    { key: 'garden_maint',     label: 'Garden Maintenance',       icon: 'flower-outline'        },
    { key: 'hedge_trimming',   label: 'Hedge Trimming',           icon: 'cut-outline'           },
  ],
  cleaning: [
    { key: 'house_cleaning',   label: 'House Cleaning',           icon: 'home-outline'          },
    { key: 'deep_cleaning',    label: 'Deep Cleaning',            icon: 'sparkles-outline'      },
    { key: 'move_in_out',      label: 'Move-In / Move-Out Cleaning', icon: 'move-outline'       },
    { key: 'office_cleaning',  label: 'Office Cleaning',          icon: 'business-outline'      },
    { key: 'bathroom_clean',   label: 'Bathroom Cleaning',        icon: 'water-outline'         },
    { key: 'kitchen_clean',    label: 'Kitchen Cleaning',         icon: 'restaurant-outline'    },
  ],
  renovation: [
    { key: 'interior_paint',   label: 'Interior Painting',        icon: 'color-fill-outline'    },
    { key: 'exterior_paint',   label: 'Exterior Painting',        icon: 'brush-outline'         },
    { key: 'floor_tiling',     label: 'Floor Tiling',             icon: 'grid-outline'          },
    { key: 'floor_install',    label: 'Floor Installation',       icon: 'layers-outline'        },
    { key: 'roof_repair',      label: 'Roof Repair',              icon: 'home-outline'          },
    { key: 'concrete_repair',  label: 'Concrete Repair',          icon: 'cube-outline'          },
    { key: 'kitchen_reno',     label: 'Kitchen Renovation',       icon: 'restaurant-outline'    },
    { key: 'bathroom_reno',    label: 'Bathroom Renovation',      icon: 'water-outline'         },
  ],
};

// Emoji + pastel bg per service — unified with Home and All Services
const SERVICE_EMOJI: Record<string, {emoji: string; bg: string}> = {
  plumbing:         {emoji: '🔧', bg: '#E3F2FD'},
  electrical:       {emoji: '⚡', bg: '#FFF8E1'},
  ac_hvac:          {emoji: '❄️', bg: '#E3F2FD'},
  appliance_repair: {emoji: '🧹', bg: '#F3E5F5'},
  carpentry:        {emoji: '🪚', bg: '#F3E5F5'},
  welding:          {emoji: '🔥', bg: '#FBE9E7'},
  handyman:         {emoji: '🛠️', bg: '#E8F5E9'},
  landscaping:      {emoji: '🌿', bg: '#E0F2F1'},
  cleaning:         {emoji: '✨', bg: '#F3E5F5'},
  renovation:       {emoji: '🏠', bg: '#FFF3E0'},
  other:            {emoji: '💬', bg: '#F5F5F5'},
};

export default function ServiceSubcategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const serviceKey   = params.serviceKey   as string;
  const serviceLabel = params.serviceLabel as string;
  const serviceStyle = SERVICE_EMOJI[serviceKey as string] || SERVICE_EMOJI.other;
  const providerId   = params.providerId   as string | undefined;
  const providerName = params.providerName as string | undefined;

  const subcats = SUBCATEGORIES[serviceKey] ?? [];

  const goToRequestForm = (subKey: string, subLabel: string) => {
    router.push({
      pathname: '/request-service',
      params: {
        providerId:     providerId     || '',
        providerName:   providerName   || '',
        category:       serviceKey,
        categoryName:   serviceLabel,
        subCategory:    subLabel,
        subcategoryKey: subKey,
        location:       '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{serviceLabel}</Text>
          <Text style={styles.headerSub}>Choose the type of service</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.describeCard}
          onPress={() => goToRequestForm('other', 'Other')}
          activeOpacity={0.85}
        >
          <View style={styles.describeIconWrap}>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#E53935" />
          </View>
          <View style={styles.describeTextWrap}>
            <Text style={styles.describeTitle}>Describe Your Job</Text>
            <Text style={styles.describeSub}>Not sure which option fits? Tell us what you need.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#E53935" />
        </TouchableOpacity>

        <Text style={styles.listLabel}>Or choose a specific service</Text>

        <View style={styles.listCard}>
          {subcats.map((sub, idx) => (
            <TouchableOpacity
              key={sub.key}
              style={[styles.subRow, idx === subcats.length - 1 && styles.subRowLast]}
              onPress={() => goToRequestForm(sub.key, sub.label)}
              activeOpacity={0.75}
            >
              <View style={[styles.subIcon, {backgroundColor: serviceStyle.bg}]}>
                <Text style={styles.subEmoji}>{serviceStyle.emoji}</Text>
              </View>
              <Text style={styles.subLabel}>{sub.label}</Text>
              <Ionicons name="chevron-forward" size={17} color="#CCC" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F7F7' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },
  describeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F8F9', borderRadius: 14, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#E5E5E7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  describeIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#EFEFEF',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  describeTextWrap: { flex: 1 },
  describeTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  describeSub: { fontSize: 12, color: '#666', lineHeight: 17 },
  listLabel: {
    fontSize: 12, fontWeight: '600', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12,
  },
  listCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  subRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  subRowLast: { borderBottomWidth: 0 },
  subIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  subEmoji: {
    fontSize: 18,
  },
  subLabel: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
});
