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
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
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
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{category.label}</Text>
        <View style={styles.backButton} />
      </View>

      {/* Search bar - only show if more than 10 subcategories */}
      {subcategories.length > 10 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

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
              {selectedSubcategory === subcategory.subcategoryKey && (
                <Ionicons name="checkmark-circle" size={24} color="#D74826" />
              )}
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
          <Text style={styles.continueButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
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
    flex: 1,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1A1A1A',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    minHeight: 56,
  },
  optionCardSelected: {
    borderColor: '#D74826',
    backgroundColor: '#FFF5F5',
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
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
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
