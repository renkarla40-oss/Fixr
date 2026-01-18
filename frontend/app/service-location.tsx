import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  DistanceUnit,
  SEARCH_DISTANCE_OPTIONS_KM,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_SEARCH_DISTANCE_KM,
  getDistanceLabel,
} from '../constants/distanceUtils';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const JOB_DURATION_OPTIONS = [
  { value: 'less_than_1_hour', label: 'Less than 1 hour' },
  { value: '1_to_2_hours', label: '1-2 hours' },
  { value: '2_to_4_hours', label: '2-4 hours' },
  { value: 'half_day', label: 'Half day' },
  { value: 'full_day', label: 'Full day' },
  { value: 'multiple_days', label: 'Multiple days' },
  { value: 'not_sure', label: 'Not sure' },
];

interface Town {
  key: string;
  label: string;
  region: string;
}

export default function ServiceLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  
  const category = params.category as string;
  const categoryName = params.categoryName as string;
  const subCategory = params.subCategory as string | undefined;
  const subcategoryKey = params.subcategoryKey as string | undefined;
  
  const [location, setLocation] = useState('');
  const [searchDistanceKm, setSearchDistanceKm] = useState(DEFAULT_SEARCH_DISTANCE_KM);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(DEFAULT_DISTANCE_UNIT);
  const [jobDuration, setJobDuration] = useState('');
  
  // Modal states
  const [showTownPicker, setShowTownPicker] = useState(false);
  const [showDistancePicker, setShowDistancePicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  
  // Towns data
  const [towns, setTowns] = useState<Town[]>([]);
  const [townSearchQuery, setTownSearchQuery] = useState('');
  const [loadingTowns, setLoadingTowns] = useState(false);

  useEffect(() => {
    fetchTowns();
  }, []);

  const fetchTowns = async () => {
    try {
      setLoadingTowns(true);
      const response = await axios.get(`${BACKEND_URL}/api/towns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTowns(response.data);
    } catch (error) {
      if (__DEV__) {
        console.warn('Error fetching towns:', error);
      }
      // Fallback to hardcoded list if API fails - no error shown to user
      setTowns([
        { key: 'port_of_spain', label: 'Port of Spain', region: 'north' },
        { key: 'san_fernando', label: 'San Fernando', region: 'south' },
        { key: 'chaguanas', label: 'Chaguanas', region: 'central' },
        { key: 'arima', label: 'Arima', region: 'corridor' },
        { key: 'diego_martin', label: 'Diego Martin', region: 'north' },
        { key: 'tunapuna', label: 'Tunapuna', region: 'corridor' },
        { key: 'couva', label: 'Couva', region: 'central' },
        { key: 'sangre_grande', label: 'Sangre Grande', region: 'east' },
      ]);
    } finally {
      setLoadingTowns(false);
    }
  };

  const filteredTowns = towns.filter(town =>
    town.label.toLowerCase().includes(townSearchQuery.toLowerCase())
  );

  const handleContinue = () => {
    if (!location.trim()) return;
    
    // Phase 1 Enforcement: Navigate to request-service to create request FIRST
    // Provider list will only be shown AFTER request is created with valid requestId
    router.push({
      pathname: '/request-service',
      params: {
        providerId: 'general',  // General request - no specific provider yet
        category,
        categoryName,
        subCategory: subCategory || '',
        subcategoryKey: subcategoryKey || '',
        location: location.trim(),
        searchDistanceKm: searchDistanceKm.toString(),
        jobDuration: jobDuration || '',
      },
    });
  };

  const getSelectedDurationLabel = () => {
    const selected = JOB_DURATION_OPTIONS.find(opt => opt.value === jobDuration);
    return selected?.label || '';
  };

  const getCurrentDistanceLabel = () => {
    return getDistanceLabel(searchDistanceKm, distanceUnit, SEARCH_DISTANCE_OPTIONS_KM);
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Service Location</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={48} color="#E53935" />
          </View>

          <Text style={styles.subtitle}>
            Where do you need the service?
          </Text>
          
          <Text style={styles.description}>
            Select your town and search distance so we can show you nearby providers.
          </Text>

          {/* Town Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Job Location <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTownPicker(true)}
            >
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={[styles.pickerButtonText, !location && styles.pickerPlaceholder]}>
                {location || 'Select town/area'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Search Distance Selection with Unit Toggle */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Search Distance</Text>
              <View style={styles.unitToggle}>
                <TouchableOpacity
                  style={[styles.unitButton, distanceUnit === 'km' && styles.unitButtonActive]}
                  onPress={() => setDistanceUnit('km')}
                >
                  <Text style={[styles.unitButtonText, distanceUnit === 'km' && styles.unitButtonTextActive]}>km</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.unitButton, distanceUnit === 'mi' && styles.unitButtonActive]}
                  onPress={() => setDistanceUnit('mi')}
                >
                  <Text style={[styles.unitButtonText, distanceUnit === 'mi' && styles.unitButtonTextActive]}>mi</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.hint}>How far should we search for providers?</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDistancePicker(true)}
            >
              <Ionicons name="navigate-outline" size={20} color="#666" />
              <Text style={styles.pickerButtonText}>
                {getCurrentDistanceLabel()}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Job Duration (Optional) */}
          <View style={styles.section}>
            <Text style={styles.label}>Estimated Job Duration</Text>
            <Text style={styles.hint}>Optional - helps providers plan their schedule</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDurationPicker(true)}
            >
              <Ionicons name="time-outline" size={20} color="#666" />
              <Text style={[styles.pickerButtonText, !jobDuration && styles.pickerPlaceholder]}>
                {getSelectedDurationLabel() || 'Select duration (optional)'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !location.trim() && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!location.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Find Providers</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Town Picker Modal */}
      <Modal
        visible={showTownPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTownPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Town</Text>
              <TouchableOpacity onPress={() => setShowTownPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search towns..."
                value={townSearchQuery}
                onChangeText={setTownSearchQuery}
                placeholderTextColor="#999"
              />
            </View>

            {loadingTowns ? (
              <ActivityIndicator size="large" color="#E53935" style={styles.loadingIndicator} />
            ) : (
              <FlatList
                data={filteredTowns}
                keyExtractor={(item) => item.key}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.listItem,
                      location === item.label && styles.listItemSelected,
                    ]}
                    onPress={() => {
                      setLocation(item.label);
                      setShowTownPicker(false);
                      setTownSearchQuery('');
                    }}
                  >
                    <Text style={[
                      styles.listItemText,
                      location === item.label && styles.listItemTextSelected,
                    ]}>
                      {item.label}
                    </Text>
                    {location === item.label && (
                      <Ionicons name="checkmark" size={20} color="#E53935" />
                    )}
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Distance Picker Modal */}
      <Modal
        visible={showDistancePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDistancePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Distance</Text>
              <TouchableOpacity onPress={() => setShowDistancePicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {SEARCH_DISTANCE_OPTIONS_KM.map((option) => (
              <TouchableOpacity
                key={option.valueKm}
                style={[
                  styles.listItem,
                  searchDistanceKm === option.valueKm && styles.listItemSelected,
                ]}
                onPress={() => {
                  setSearchDistanceKm(option.valueKm);
                  setShowDistancePicker(false);
                }}
              >
                <Text style={[
                  styles.listItemText,
                  searchDistanceKm === option.valueKm && styles.listItemTextSelected,
                ]}>
                  {distanceUnit === 'mi' ? option.labelMi : option.labelKm}
                </Text>
                {searchDistanceKm === option.valueKm && (
                  <Ionicons name="checkmark" size={20} color="#E53935" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Duration Picker Modal */}
      <Modal
        visible={showDurationPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDurationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentSmall}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Job Duration</Text>
              <TouchableOpacity onPress={() => setShowDurationPicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.listItem, !jobDuration && styles.listItemSelected]}
              onPress={() => {
                setJobDuration('');
                setShowDurationPicker(false);
              }}
            >
              <Text style={[styles.listItemText, !jobDuration && styles.listItemTextSelected]}>
                Skip (I'm not sure)
              </Text>
              {!jobDuration && <Ionicons name="checkmark" size={20} color="#E53935" />}
            </TouchableOpacity>
            
            {JOB_DURATION_OPTIONS.filter(opt => opt.value !== 'not_sure').map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.listItem,
                  jobDuration === option.value && styles.listItemSelected,
                ]}
                onPress={() => {
                  setJobDuration(option.value);
                  setShowDurationPicker(false);
                }}
              >
                <Text style={[
                  styles.listItemText,
                  jobDuration === option.value && styles.listItemTextSelected,
                ]}>
                  {option.label}
                </Text>
                {jobDuration === option.value && (
                  <Ionicons name="checkmark" size={20} color="#E53935" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 2,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  unitButtonActive: {
    backgroundColor: '#E53935',
  },
  unitButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  required: {
    color: '#E53935',
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    gap: 12,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  pickerPlaceholder: {
    color: '#999',
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalContentSmall: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    margin: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  loadingIndicator: {
    marginVertical: 32,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  listItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  listItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  listItemTextSelected: {
    color: '#E53935',
    fontWeight: '600',
  },
});
