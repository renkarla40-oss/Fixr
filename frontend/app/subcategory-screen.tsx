import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getCategoryByKey,
  getSubcategoriesByKey,
  SubCategory,
} from '../constants/serviceCategories';

export default function SubcategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const serviceKey = params.serviceKey as string;
  
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get category and subcategories from the catalog
  const category = getCategoryByKey(serviceKey);
  const subcategories = getSubcategoriesByKey(serviceKey);

  // Filter subcategories based on search
  const filteredSubcategories = useMemo(() => {
    if (!searchQuery.trim()) return subcategories;
    const query = searchQuery.toLowerCase();
    return subcategories.filter(sub => 
      sub.label.toLowerCase().includes(query)
    );
  }, [subcategories, searchQuery]);

  const handleSubcategorySelect = (subcategoryKey: string) => {
    setSelectedSubcategory(subcategoryKey);
  };

  const handleContinue = () => {
    if (!selectedSubcategory) return;
    
    const selected = subcategories.find(s => s.subcategoryKey === selectedSubcategory);
    
    router.push({
      pathname: '/service-location',
      params: {
        category: serviceKey,
        categoryName: category?.label || serviceKey,
        subCategory: selected?.label || '',
        subcategoryKey: selectedSubcategory,
      },
    });
  };

  // If category not found, show error
  if (!category) {
    return (
      <View style={styles.safeArea}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Service</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#D74826" />
          <Text style={styles.errorText}>Service not found</Text>
          <TouchableOpacity style={styles.backToServicesButton} onPress={() => router.back()}>
            <Text style={styles.backToServicesText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{category.label}</Text>
        <View style={styles.backButton} />
      </View>


      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          What type of {category.label.toLowerCase()} service do you need?
        </Text>

        <View style={styles.optionsContainer}>
          {filteredSubcategories.map((subcategory) => (
            <TouchableOpacity
              key={subcategory.subcategoryKey}
              style={[
                styles.optionCard,
                selectedSubcategory === subcategory.subcategoryKey && styles.optionCardSelected,
              ]}
              onPress={() => handleSubcategorySelect(subcategory.subcategoryKey)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.optionText,
                selectedSubcategory === subcategory.subcategoryKey && styles.optionTextSelected,
              ]}>
                {subcategory.label}
              </Text>

              <View
                style={[
                  styles.optionIndicator,
                  selectedSubcategory === subcategory.subcategoryKey && styles.optionIndicatorSelected,
                ]}
              >
                {selectedSubcategory === subcategory.subcategoryKey ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}

          {filteredSubcategories.length === 0 && searchQuery.length > 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No services match "{searchQuery}"</Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchText}>Clear search</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !selectedSubcategory && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedSubcategory}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.continueButtonText,
              !selectedSubcategory && styles.continueButtonTextDisabled,
            ]}
          >
            Continue
          </Text>
          <Ionicons name="arrow-forward" size={20} color={selectedSubcategory ? "#FFFFFF" : "#0B1F33"} />
        </TouchableOpacity>
      </View>
    </View>
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
    paddingBottom: 12,
    backgroundColor: '#005A92',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchAction: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FB4F14',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    paddingVertical: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#3F3F3F',
    marginBottom: 20,
    textAlign: 'left',
    paddingHorizontal: 4,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#B8B8B8',
    minHeight: 56,
  },
  optionCardSelected: {
    borderColor: '#005A92',
    backgroundColor: '#EAF3FF',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#0B1F33',
    fontWeight: '700',
  },
  optionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#AFAFAF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  optionIndicatorSelected: {
    borderColor: '#005A92',
    backgroundColor: '#005A92',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 16,
    color: '#4F4F4F',
    marginBottom: 12,
  },
  clearSearchText: {
    fontSize: 16,
    color: '#D74826',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
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
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    minHeight: 56,
  },
  continueButtonDisabled: {
    backgroundColor: '#EAF3FF',
    opacity: 1,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  continueButtonTextDisabled: {
    color: '#0B1F33',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#4F4F4F',
    marginTop: 16,
    marginBottom: 24,
  },
  backToServicesButton: {
    backgroundColor: '#D74826',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToServicesText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
