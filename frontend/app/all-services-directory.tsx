import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getDisplayableCategories,
  ServiceCategory,
  SubCategory,
} from '../constants/serviceCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 2; // 2 columns for better mobile readability

// Get all displayable categories
const allCategories = getDisplayableCategories();

// Split categories into 2 columns for balanced display
const splitIntoColumns = (categories: ServiceCategory[], columns: number): ServiceCategory[][] => {
  const result: ServiceCategory[][] = Array.from({ length: columns }, () => []);
  
  // Calculate total subcategories per category to balance column heights
  const categoriesWithWeight = categories.map(cat => ({
    category: cat,
    weight: cat.subcategories.length + 2, // +2 for title spacing
  }));
  
  // Distribute categories to columns based on weight
  const columnWeights = Array(columns).fill(0);
  
  categoriesWithWeight.forEach(({ category, weight }) => {
    // Find column with minimum weight
    const minIndex = columnWeights.indexOf(Math.min(...columnWeights));
    result[minIndex].push(category);
    columnWeights[minIndex] += weight;
  });
  
  return result;
};

const columns = splitIntoColumns(allCategories, COLUMN_COUNT);

export default function AllServicesDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Handle subcategory tap - starts the request flow
  const handleSubcategoryPress = (category: ServiceCategory, subcategory: SubCategory) => {
    router.push({
      pathname: '/service-location',
      params: {
        category: category.serviceKey,
        categoryName: category.label,
        subCategory: subcategory.subcategoryKey,
        subCategoryName: subcategory.label,
      },
    });
  };

  // Render a single category block
  const renderCategoryBlock = (category: ServiceCategory) => (
    <View key={category.serviceKey} style={styles.categoryBlock}>
      {/* Category Title */}
      <View style={styles.categoryHeader}>
        <Ionicons
          name={category.icon as any}
          size={16}
          color="#E53935"
          style={styles.categoryIcon}
        />
        <Text style={styles.categoryTitle} numberOfLines={1}>
          {category.label}
        </Text>
        {category.status === 'beta' && (
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>β</Text>
          </View>
        )}
      </View>

      {/* Subcategories List */}
      <View style={styles.subcategoriesList}>
        {category.subcategories.slice(0, 8).map((sub) => (
          <TouchableOpacity
            key={sub.subcategoryKey}
            style={styles.subcategoryItem}
            onPress={() => handleSubcategoryPress(category, sub)}
            activeOpacity={0.6}
          >
            <Text style={styles.subcategoryText} numberOfLines={1}>
              {sub.label}
            </Text>
          </TouchableOpacity>
        ))}
        {category.subcategories.length > 8 && (
          <TouchableOpacity
            style={styles.moreLink}
            onPress={() => {
              router.push({
                pathname: '/subcategory-screen',
                params: { serviceKey: category.serviceKey },
              });
            }}
            activeOpacity={0.6}
          >
            <Text style={styles.moreLinkText}>
              +{category.subcategories.length - 8} more
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Services</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>
          Browse all services or tap a subcategory to get started
        </Text>
      </View>

      {/* 2-Column Directory */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.columnsContainer}>
          {columns.map((columnCategories, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {columnCategories.map(renderCategoryBlock)}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 44,
  },
  subtitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: 14, // Horizontal gutter between columns: 12-16px
  },
  column: {
    flex: 1,
    gap: 18, // Vertical spacing between category cards: 16-20px
  },
  categoryBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16, // Category card internal padding: 16px all sides
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12, // Space between category title and first subcategory: 12px
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryIcon: {
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  betaBadge: {
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  betaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4A7DC4',
  },
  subcategoriesList: {
    gap: 0, // Using paddingVertical on items for 12px total spacing between rows
  },
  subcategoryItem: {
    paddingVertical: 6, // 6px top + 6px bottom = 12px between rows
  },
  subcategoryText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  moreLink: {
    paddingVertical: 6, // Consistent with subcategory items
    marginTop: 0,
  },
  moreLinkText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '600',
    lineHeight: 18,
  },
});
