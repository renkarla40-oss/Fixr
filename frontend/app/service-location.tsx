import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Popular areas in Trinidad & Tobago for quick selection
const POPULAR_AREAS = [
  'Port of Spain',
  'San Fernando',
  'Chaguanas',
  'Arima',
  'Tunapuna',
  'Sangre Grande',
  'Point Fortin',
  'Couva',
  'Diego Martin',
  'Maraval',
];

export default function ServiceLocationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const category = params.category as string;
  const categoryName = params.categoryName as string;
  const subCategory = params.subCategory as string | undefined;
  
  const [location, setLocation] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredAreas = POPULAR_AREAS.filter(area =>
    area.toLowerCase().includes(location.toLowerCase())
  );

  const handleAreaSelect = (area: string) => {
    setLocation(area);
    setShowSuggestions(false);
  };

  const handleContinue = () => {
    if (!location.trim()) return;
    
    router.push({
      pathname: '/provider-list',
      params: {
        category,
        categoryName,
        subCategory: subCategory || '',
        location: location.trim(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
            Enter your area, town, or region so we can show you nearby providers.
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="e.g., Chaguanas, Port of Spain"
              value={location}
              onChangeText={(text) => {
                setLocation(text);
                setShowSuggestions(text.length > 0);
              }}
              onFocus={() => setShowSuggestions(location.length > 0)}
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
            {location.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setLocation('');
                  setShowSuggestions(false);
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {showSuggestions && filteredAreas.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Popular Areas</Text>
              {filteredAreas.map((area) => (
                <TouchableOpacity
                  key={area}
                  style={styles.suggestionItem}
                  onPress={() => handleAreaSelect(area)}
                >
                  <Ionicons name="location-outline" size={18} color="#666" />
                  <Text style={styles.suggestionText}>{area}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!showSuggestions && (
            <View style={styles.quickSelectContainer}>
              <Text style={styles.quickSelectTitle}>Quick Select</Text>
              <View style={styles.quickSelectGrid}>
                {POPULAR_AREAS.slice(0, 6).map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[
                      styles.quickSelectChip,
                      location === area && styles.quickSelectChipSelected,
                    ]}
                    onPress={() => handleAreaSelect(area)}
                  >
                    <Text style={[
                      styles.quickSelectText,
                      location === area && styles.quickSelectTextSelected,
                    ]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !location.trim() && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!location.trim()}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  clearButton: {
    padding: 4,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  suggestionText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  quickSelectContainer: {
    marginTop: 8,
  },
  quickSelectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickSelectChipSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#E53935',
  },
  quickSelectText: {
    fontSize: 14,
    color: '#666',
  },
  quickSelectTextSelected: {
    color: '#E53935',
    fontWeight: '600',
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
});
