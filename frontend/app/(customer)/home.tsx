import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import BetaNoticeModal from '../../components/BetaNoticeModal';
import {
  getDisplayableCategories,
  ServiceCategory,
  requiresSubcategorySelection,
} from '../../constants/serviceCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get all displayable categories (excludes 'coming_soon')
const categories = getDisplayableCategories();

// Popular Projects Data - each links to a specific category
const popularProjects = [
  {
    id: '1',
    title: 'Bathroom Renovation',
    price: 'From $2,500',
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400',
    category: 'plumbing',
  },
  {
    id: '2',
    title: 'Kitchen Remodel',
    price: 'From $3,000',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    category: 'other',
  },
  {
    id: '3',
    title: 'Electrical Upgrade',
    price: 'From $800',
    image: 'https://images.unsplash.com/photo-1615774925655-a0e97fc85c14?w=400',
    category: 'electrical',
  },
  {
    id: '4',
    title: 'AC Installation',
    price: 'From $1,200',
    image: 'https://images.pexels.com/photos/5463587/pexels-photo-5463587.jpeg?w=400',
    category: 'hvac',
  },
];

// Pricing Insights - each links to relevant service category
const pricingInsights = [
  {
    id: '1',
    title: 'Plumbing Services',
    subtitle: 'Average cost in Trinidad',
    price: '$150 - $500',
    icon: 'water-outline',
    category: 'plumbing',
  },
  {
    id: '2',
    title: 'Electrical Work',
    subtitle: 'Most common repairs',
    price: '$100 - $400',
    icon: 'flash-outline',
    category: 'electrical',
  },
];

// Inspiration Content - each links to inspiration detail page
const inspirationContent = [
  {
    id: '1',
    title: '10 Ways to Improve Your Home',
    image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
    topic: 'home-improvement',
  },
  {
    id: '2',
    title: 'Energy Saving Tips',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    topic: 'energy-saving',
  },
  {
    id: '3',
    title: 'Outdoor Living Ideas',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
    topic: 'outdoor-living',
  },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user, shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
  };

  // Navigate to a specific category
  const handleCategoryPress = (category: ServiceCategory) => {
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

    if (requiresSubcategorySelection(category.serviceKey)) {
      router.push({
        pathname: '/subcategory-screen',
        params: { serviceKey: category.serviceKey },
      });
    } else {
      router.push({
        pathname: '/service-location',
        params: {
          category: category.serviceKey,
          categoryName: category.label,
        },
      });
    }
  };

  // Navigate to category by serviceKey string
  const navigateToCategory = (serviceKey: string) => {
    const category = categories.find(c => c.serviceKey === serviceKey);
    if (category) {
      handleCategoryPress(category);
    }
  };

  // Search bar - acts as "Service Finder", scrolls to All Services section
  const handleSearchPress = () => {
    // Route to a general category selection - electrical is most common
    router.push({
      pathname: '/subcategory-screen',
      params: { serviceKey: 'electrical' },
    });
  };

  // Popular Projects - navigate to related service category
  const handleProjectPress = (project: typeof popularProjects[0]) => {
    navigateToCategory(project.category);
  };

  // Get Free Quotes CTA - navigate to category selection (first category)
  const handleGetQuotesPress = () => {
    // Navigate to electrical as it's the first and most common
    router.push({
      pathname: '/subcategory-screen',
      params: { serviceKey: 'electrical' },
    });
  };

  // Pricing Guide cards - navigate to relevant service category
  const handlePricingPress = (insight: typeof pricingInsights[0]) => {
    navigateToCategory(insight.category);
  };

  // Inspiration cards - navigate to inspiration detail page
  const handleInspirationPress = (item: typeof inspirationContent[0]) => {
    router.push({
      pathname: '/inspiration-detail',
      params: { topic: item.topic },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BetaNoticeModal 
        visible={shouldShowBetaNotice} 
        onClose={handleBetaNoticeContinue}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO SEARCH SECTION ===== */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['#FFF5F5', '#FFFFFF']}
            style={styles.heroGradient}
          >
            <Text style={styles.heroTitle}>What do you need{'\n'}help with today?</Text>
            
            {/* Search Bar - Acts as Service Finder */}
            <TouchableOpacity 
              style={styles.searchBar}
              onPress={handleSearchPress}
              activeOpacity={0.9}
            >
              <Ionicons name="search-outline" size={20} color="#999" />
              <Text style={styles.searchPlaceholder}>Browse services by category</Text>
              <Ionicons name="chevron-forward" size={18} color="#CCC" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* ===== BROWSE BY CATEGORY (Horizontal) ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesRow}
          >
            {categories.slice(0, 6).map((category) => (
              <TouchableOpacity
                key={category.serviceKey}
                style={styles.categoryChip}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIconCircle}>
                  <Ionicons
                    name={category.icon as any}
                    size={24}
                    color="#E53935"
                  />
                </View>
                <Text style={styles.categoryChipText} numberOfLines={1}>
                  {category.label}
                </Text>
                {category.status === 'beta' && (
                  <View style={styles.betaBadgeSmall}>
                    <Text style={styles.betaBadgeTextSmall}>BETA</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ===== ALL SERVICES GRID ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Services</Text>
          <View style={styles.servicesGrid}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.serviceKey}
                style={[
                  styles.serviceCard,
                  category.status === 'beta' && styles.serviceCardBeta,
                ]}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.7}
              >
                <View style={styles.serviceIconContainer}>
                  <Ionicons
                    name={category.icon as any}
                    size={26}
                    color="#E53935"
                  />
                </View>
                <Text style={styles.serviceName} numberOfLines={2}>
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
        </View>

        {/* ===== POPULAR PROJECTS CAROUSEL (All Tappable) ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Popular Projects</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH * 0.7 + 16}
          >
            {popularProjects.map((project) => (
              <TouchableOpacity
                key={project.id}
                style={styles.projectCard}
                onPress={() => handleProjectPress(project)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: project.image }}
                  style={styles.projectImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.projectGradient}
                >
                  <Text style={styles.projectTitle}>{project.title}</Text>
                  <Text style={styles.projectPrice}>{project.price}</Text>
                </LinearGradient>
                {/* Tap indicator */}
                <View style={styles.projectTapHint}>
                  <Ionicons name="arrow-forward-circle" size={24} color="rgba(255,255,255,0.9)" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ===== LOCATION-BASED CTA ===== */}
        <View style={styles.section}>
          <View style={styles.ctaCard}>
            <View style={styles.ctaContent}>
              <View style={styles.ctaIconContainer}>
                <Ionicons name="location" size={28} color="#E53935" />
              </View>
              <View style={styles.ctaTextContainer}>
                <Text style={styles.ctaTitle}>Get prices in your area</Text>
                <Text style={styles.ctaSubtitle}>Connect with top-rated pros in Trinidad & Tobago</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.ctaButton}
              onPress={handleGetQuotesPress}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#E53935', '#C62828']}
                style={styles.ctaButtonGradient}
              >
                <Text style={styles.ctaButtonText}>Browse Services</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== PRICING GUIDE (All Tappable) ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Guide</Text>
          <View style={styles.pricingGrid}>
            {pricingInsights.map((insight) => (
              <TouchableOpacity 
                key={insight.id} 
                style={styles.pricingCard}
                onPress={() => handlePricingPress(insight)}
                activeOpacity={0.7}
              >
                <View style={styles.pricingIconContainer}>
                  <Ionicons name={insight.icon as any} size={24} color="#E53935" />
                </View>
                <Text style={styles.pricingTitle}>{insight.title}</Text>
                <Text style={styles.pricingSubtitle}>{insight.subtitle}</Text>
                <Text style={styles.pricingValue}>{insight.price}</Text>
                <View style={styles.pricingTapHint}>
                  <Text style={styles.pricingTapText}>View services →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ===== INSPIRATION SECTION (All Tappable) ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Home Inspiration</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
          >
            {inspirationContent.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.inspirationCard}
                onPress={() => handleInspirationPress(item)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: item.image }}
                  style={styles.inspirationImage}
                  resizeMode="cover"
                />
                <View style={styles.inspirationOverlay}>
                  <Text style={styles.inspirationTitle}>{item.title}</Text>
                </View>
                {/* Tap indicator */}
                <View style={styles.inspirationTapHint}>
                  <Ionicons name="book-outline" size={18} color="rgba(255,255,255,0.9)" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F6F8',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // ===== HERO SECTION =====
  heroSection: {
    marginBottom: 8,
  },
  heroGradient: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    lineHeight: 36,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },

  // ===== SECTIONS =====
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleInline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // ===== CATEGORY CHIPS (Horizontal) =====
  categoriesRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryChip: {
    alignItems: 'center',
    width: 80,
  },
  categoryIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  betaBadgeSmall: {
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 4,
  },
  betaBadgeTextSmall: {
    fontSize: 8,
    fontWeight: '700',
    color: '#4A7DC4',
  },

  // ===== SERVICES GRID =====
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  serviceCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceCardBeta: {
    backgroundColor: '#FFFBF5',
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
    lineHeight: 17,
  },
  betaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EAF3FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  betaBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4A7DC4',
  },

  // ===== PROJECT CARDS (Carousel - All Tappable) =====
  carouselContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  projectCard: {
    width: SCREEN_WIDTH * 0.7,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  projectImage: {
    width: '100%',
    height: '100%',
  },
  projectGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 40,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  projectPrice: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  projectTapHint: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // ===== CTA CARD =====
  ctaCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  ctaButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  ctaButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ===== PRICING CARDS (All Tappable) =====
  pricingGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  pricingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pricingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pricingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  pricingSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
    marginBottom: 8,
  },
  pricingTapHint: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 8,
  },
  pricingTapText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },

  // ===== INSPIRATION CARDS (All Tappable) =====
  inspirationCard: {
    width: SCREEN_WIDTH * 0.6,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  inspirationImage: {
    width: '100%',
    height: '100%',
  },
  inspirationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  inspirationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inspirationTapHint: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
