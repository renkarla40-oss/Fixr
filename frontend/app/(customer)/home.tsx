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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
    marginLeft: 4,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryCardBeta: {
    borderColor: '#FFE0B2',
    backgroundColor: '#FFFBF5',
  },
  categoryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 18,
  },
  betaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  betaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F57C00',
  },
});