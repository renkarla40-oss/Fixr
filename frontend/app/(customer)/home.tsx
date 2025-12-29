import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import BetaNoticeModal from '../../components/BetaNoticeModal';
import {
  getDisplayableCategories,
  ServiceCategory,
  requiresSubcategorySelection,
} from '../../constants/serviceCategories';

// Get all displayable categories (excludes 'coming_soon')
const categories = getDisplayableCategories();

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
  };

  const handleCategoryPress = (category: ServiceCategory) => {
    // 'Other Services' goes directly to custom request form (no provider search)
    if (category.serviceKey === 'other') {
      router.push({
        pathname: '/request-service',
        params: {
          providerId: 'general',
          category: 'other',
          subCategory: '',
          location: '',
        },
      });
      return;
    }

    // Categories with subcategories go to subcategory selection
    if (requiresSubcategorySelection(category.serviceKey)) {
      router.push({
        pathname: '/subcategory-screen',
        params: { serviceKey: category.serviceKey },
      });
    } else {
      // Categories without subcategories go directly to location
      router.push({
        pathname: '/service-location',
        params: {
          category: category.serviceKey,
          categoryName: category.label,
        },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BetaNoticeModal 
        visible={shouldShowBetaNotice} 
        onClose={handleBetaNoticeContinue}
      />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name}!</Text>
            <Text style={styles.subtitle}>What service do you need today?</Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Services</Text>

          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.serviceKey}
                style={[
                  styles.categoryCard,
                  category.status === 'beta' && styles.categoryCardBeta,
                ]}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconContainer}>
                  <Ionicons
                    name={category.icon as any}
                    size={28}
                    color="#E53935"
                  />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
                  {category.label}
                </Text>
                {category.status === 'beta' && (
                  <View style={styles.betaBadge}>
                    <Text style={styles.betaBadgeText}>BETA</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryIcon: {
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
});