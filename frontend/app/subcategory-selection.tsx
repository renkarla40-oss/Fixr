import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCategoryByKey, SubCategory } from '../constants/serviceCategories';

export default function SubcategorySelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const serviceKey = params.serviceKey as string;
  const serviceLabel = params.serviceLabel as string;
  
  const category = getCategoryByKey(serviceKey);
  const subcategories = category?.subcategories || [];

  const handleSubcategoryPress = (subcategory: SubCategory) => {
    console.log(`[NAV] Selected subcategory: ${subcategory.subcategoryKey} for service: ${serviceKey}`);
    
    // Navigate to service location screen with both keys
    router.push({
      pathname: '/service-location',
      params: {
        serviceKey,
        serviceLabel,
        subcategoryKey: subcategory.subcategoryKey,
        subcategoryLabel: subcategory.label,
      },
    });
  };

  const handleSkip = () => {
    console.log(`[NAV] Skipping subcategory for service: ${serviceKey}`);
    
    // Navigate without subcategory
    router.push({
      pathname: '/service-location',
      params: {
        serviceKey,
        serviceLabel,
      },
    });
  };

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
          <Text style={styles.title}>{serviceLabel}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <Ionicons 
              name={(category?.icon || 'build') as any} 
              size={40} 
              color="#E53935" 
            />
          </View>

          <Text style={styles.subtitle}>What type of service?</Text>
          <Text style={styles.description}>
            Select the specific service you need, or skip to describe it yourself.
          </Text>

          <View style={styles.subcategoriesContainer}>
            {subcategories.map((subcategory) => (
              <TouchableOpacity
                key={subcategory.subcategoryKey}
                style={styles.subcategoryItem}
                onPress={() => handleSubcategoryPress(subcategory)}
                activeOpacity={0.7}
              >
                <Text style={styles.subcategoryText}>{subcategory.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Skip / Not Listed Option */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <View style={styles.skipContent}>
              <Ionicons name="create-outline" size={20} color="#E53935" />
              <Text style={styles.skipText}>Not listed? Describe it yourself</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#E53935" />
          </TouchableOpacity>
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
    paddingBottom: 40,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
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
    marginBottom: 24,
    lineHeight: 22,
  },
  subcategoriesContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  subcategoryText: {
    fontSize: 16,
    color: '#1A1A1A',
    flex: 1,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  skipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipText: {
    fontSize: 16,
    color: '#E53935',
    fontWeight: '600',
  },
});
