import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HANDYMAN_SUBCATEGORIES = [
  { id: 'yard_work', name: 'Yard Work', icon: 'leaf-outline' },
  { id: 'furniture', name: 'Furniture Assembly/Removal', icon: 'bed-outline' },
  { id: 'appliance', name: 'Appliance Installation', icon: 'tv-outline' },
  { id: 'repairs', name: 'Minor Home Repairs', icon: 'hammer-outline' },
  { id: 'painting', name: 'Painting (Small Jobs)', icon: 'color-palette-outline' },
  { id: 'other', name: 'Other Handyman Tasks', icon: 'construct-outline' },
];

export default function HandymanSubcategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);

  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
  };

  const handleContinue = () => {
    if (!selectedSubcategory) return;
    
    const subcategory = HANDYMAN_SUBCATEGORIES.find(s => s.id === selectedSubcategory);
    
    router.push({
      pathname: '/service-location',
      params: {
        category: 'handyman',
        categoryName: 'Handyman',
        subCategory: subcategory?.name || '',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Handyman Services</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          What type of handyman service do you need?
        </Text>

        <View style={styles.optionsContainer}>
          {HANDYMAN_SUBCATEGORIES.map((subcategory) => (
            <TouchableOpacity
              key={subcategory.id}
              style={[
                styles.optionCard,
                selectedSubcategory === subcategory.id && styles.optionCardSelected,
              ]}
              onPress={() => handleSubcategorySelect(subcategory.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.optionIconContainer,
                selectedSubcategory === subcategory.id && styles.optionIconContainerSelected,
              ]}>
                <Ionicons
                  name={subcategory.icon as any}
                  size={24}
                  color={selectedSubcategory === subcategory.id ? '#FFFFFF' : '#D74826'}
                />
              </View>
              <Text style={[
                styles.optionText,
                selectedSubcategory === subcategory.id && styles.optionTextSelected,
              ]}>
                {subcategory.name}
              </Text>
              {selectedSubcategory === subcategory.id && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color="#D74826" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedSubcategory && styles.continueButtonDisabled,
          ]}
          onPress={() => {
            if (selectedSubcategory) {
              handleContinue();
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  optionCardSelected: {
    borderColor: '#D74826',
    backgroundColor: '#FFF5F5',
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionIconContainerSelected: {
    backgroundColor: '#D74826',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#D74826',
    fontWeight: '600',
  },
  checkmark: {
    marginLeft: 8,
  },
  footer: {
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D74826',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 8,
    minHeight: 56,
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
