import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import {
  DistanceUnit,
  TRAVEL_DISTANCE_OPTIONS_KM,
  DEFAULT_DISTANCE_UNIT,
  DEFAULT_TRAVEL_DISTANCE_KM,
  getDistanceLabel,
} from '../constants/distanceUtils';
import { getDisplayableCategories, ServiceCategory } from '../constants/serviceCategories';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Town {
  key: string;
  label: string;
  region: string;
}

export default function ProviderSetupScreen() {
  const router = useRouter();
  const { token, refreshUser } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Location fields
  const [baseTown, setBaseTown] = useState('');
  const [travelDistanceKm, setTravelDistanceKm] = useState(DEFAULT_TRAVEL_DISTANCE_KM);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(DEFAULT_DISTANCE_UNIT);
  const [travelAnywhere, setTravelAnywhere] = useState(false);
  
  // Town picker modal
  const [showTownPicker, setShowTownPicker] = useState(false);
  const [showDistancePicker, setShowDistancePicker] = useState(false);
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

  const toggleService = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((s) => s !== serviceId));
    } else {
      setSelectedServices([...selectedServices, serviceId]);
    }
  };

  const handleSubmit = async () => {
    console.log('=== SUBMIT BUTTON PRESSED ===');
    console.log('Selected services:', selectedServices);
    console.log('Bio length:', bio.length);
    console.log('Base town:', baseTown);
    console.log('Travel distance (km):', travelDistanceKm);
    console.log('Travel anywhere:', travelAnywhere);
    
    if (selectedServices.length === 0) {
      console.log('No services selected');
      Alert.alert('Required', 'Please select at least one service you offer');
      return;
    }

    if (!bio.trim()) {
      console.log('No bio provided');
      Alert.alert('Required', 'Please provide a brief description about your services');
      return;
    }

    if (!baseTown) {
      console.log('No base town selected');
      Alert.alert('Required', 'Please select your base town/area');
      return;
    }

    console.log('Starting provider setup API call...');
    setLoading(true);
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/users/provider-setup`,
        {
          services: selectedServices,
          bio: bio.trim(),
          baseTown: baseTown,
          travelDistanceKm: travelDistanceKm,
          travelAnywhere: travelAnywhere,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log('Provider setup successful:', response.data);

      // Phase 4: Navigate to phone verification first, then uploads
      router.push('/phone-verification');
    } catch (error: any) {
      if (__DEV__) {
        console.warn('Error setting up provider:', error);
      }
      Alert.alert(
        'Setup Failed',
        'We couldn\'t complete your setup. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedTown = towns.find(t => t.label === baseTown);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Ionicons name="construct" size={48} color="#E53935" />
            <Text style={styles.title}>Provider Setup</Text>
            <Text style={styles.subtitle}>
              Complete your profile to start receiving service requests
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Services You Offer <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.hint}>Select all that apply</Text>
            <View style={styles.servicesGrid}>
              {serviceOptions.map((service) => {
                const isSelected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceCard,
                      isSelected && styles.serviceCardSelected,
                    ]}
                    onPress={() => toggleService(service.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={service.icon as any}
                      size={28}
                      color={isSelected ? '#E53935' : '#666'}
                      style={styles.serviceIcon}
                    />
                    <Text
                      style={[
                        styles.serviceName,
                        isSelected && styles.serviceNameSelected,
                      ]}
                    >
                      {service.name}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkmark} pointerEvents="none">
                        <Ionicons name="checkmark-circle" size={24} color="#E53935" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Your Base Location <Text style={styles.required}>*</Text>
            </Text>
            <Text style={styles.hint}>Where are you primarily based?</Text>
            
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTownPicker(true)}
            >
              <Ionicons name="location-outline" size={20} color="#666" />
              <Text style={[styles.pickerButtonText, !baseTown && styles.pickerPlaceholder]}>
                {baseTown || 'Select your town/area'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Travel Distance Section with Unit Toggle */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Travel Distance</Text>
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
            <Text style={styles.hint}>How far are you willing to travel for jobs?</Text>
            
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDistancePicker(true)}
            >
              <Ionicons name="car-outline" size={20} color="#666" />
              <Text style={styles.pickerButtonText}>
                {getDistanceLabel(travelDistanceKm, distanceUnit, TRAVEL_DISTANCE_OPTIONS_KM)}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Travel Anywhere Toggle */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Ionicons name="globe-outline" size={24} color="#E53935" />
                <View style={styles.toggleTextContainer}>
                  <Text style={styles.toggleLabel}>Willing to travel anywhere</Text>
                  <Text style={styles.toggleHint}>
                    Show your profile to customers outside your travel distance
                  </Text>
                </View>
              </View>
              <Switch
                value={travelAnywhere}
                onValueChange={setTravelAnywhere}
                trackColor={{ false: '#E0E0E0', true: '#FFCDD2' }}
                thumbColor={travelAnywhere ? '#E53935' : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              About Your Services <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Describe your experience, qualifications, and the services you provide..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Complete Setup</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
              <Text style={styles.modalTitle}>Select Your Town</Text>
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
                      styles.townItem,
                      baseTown === item.label && styles.townItemSelected,
                    ]}
                    onPress={() => {
                      setBaseTown(item.label);
                      setShowTownPicker(false);
                      setTownSearchQuery('');
                    }}
                  >
                    <Text style={[
                      styles.townItemText,
                      baseTown === item.label && styles.townItemTextSelected,
                    ]}>
                      {item.label}
                    </Text>
                    {baseTown === item.label && (
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
              <Text style={styles.modalTitle}>Travel Distance</Text>
              <TouchableOpacity onPress={() => setShowDistancePicker(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {TRAVEL_DISTANCE_OPTIONS_KM.map((option) => (
              <TouchableOpacity
                key={option.valueKm}
                style={[
                  styles.radiusItem,
                  travelDistanceKm === option.valueKm && styles.radiusItemSelected,
                ]}
                onPress={() => {
                  setTravelDistanceKm(option.valueKm);
                  setShowDistancePicker(false);
                }}
              >
                <Text style={[
                  styles.radiusItemText,
                  travelDistanceKm === option.valueKm && styles.radiusItemTextSelected,
                ]}>
                  {distanceUnit === 'mi' ? option.labelMi : option.labelKm}
                </Text>
                {travelDistanceKm === option.valueKm && (
                  <Ionicons name="checkmark" size={20} color="#E53935" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  required: {
    color: '#E53935',
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceCardSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#E53935',
  },
  serviceIcon: {
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  serviceNameSelected: {
    color: '#E53935',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  toggleHint: {
    fontSize: 13,
    color: '#666',
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#E53935',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonText: {
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
  townItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  townItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  townItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  townItemTextSelected: {
    color: '#E53935',
    fontWeight: '600',
  },
  radiusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  radiusItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  radiusItemText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  radiusItemTextSelected: {
    color: '#E53935',
    fontWeight: '600',
  },
});