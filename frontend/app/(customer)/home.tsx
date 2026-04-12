import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  ImageBackground,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  StatusBar,
  TextInput,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import BetaNoticeModal from '../../components/BetaNoticeModal';
import NotificationBell from '../../components/NotificationBell';
import {
  getDisplayableCategories,
  ServiceCategory,
  requiresSubcategorySelection,
} from '../../constants/serviceCategories';
import {
  searchServices,
  SubCategory,
  SUGGESTED_CATEGORIES,
} from '../../constants/subCategories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Get all displayable categories (excludes 'coming_soon')
const categories = getDisplayableCategories();

// ── FEATURED SERVICES 
const FEATURED_SERVICES = [
  { serviceKey: 'plumbing',         label: 'Plumbing',          emoji: '🔧', bg: '#E3F2FD' },
  { serviceKey: 'electrical',       label: 'Electrical',         emoji: '⚡',       bg: '#FFF8E1' },
  { serviceKey: 'ac',               label: 'Air Conditioning',   emoji: '❄️', bg: '#E3F2FD' },
  { serviceKey: 'appliance',        label: 'Appliance Repair',   emoji: '⚙️', bg: '#F3E5F5' },
  { serviceKey: 'carpentry',        label: 'Carpentry',          emoji: '🪚', bg: '#F3E5F5' },
  { serviceKey: 'welding',          label: 'Welding',            emoji: '🔥', bg: '#FBE9E7' },
  { serviceKey: 'handyman',         label: 'Handyman',           emoji: '🛠️', bg: '#E8F5E9' },
  { serviceKey: 'landscaping',      label: 'Landscaping',        emoji: '🌿', bg: '#E0F2F1' },
  { serviceKey: 'cleaning',         label: 'Cleaning',           emoji: '✨',       bg: '#F3E5F5' },
  { serviceKey: 'roofing',          label: 'Roofing',            emoji: '🏠', bg: '#FFF3E0' },
  { serviceKey: 'painting',         label: 'Painting',           emoji: '🎨', bg: '#FFF3E0' },
  { serviceKey: 'flooring',         label: 'Flooring',           emoji: '🏗️', bg: '#F3E5F5' },
];

const FEATURED_CAROUSEL_ITEMS = [
  {
    serviceKey: 'electrical',
    label: 'Electrical',
    image: require('../../assets/images/featured/electrical.jpg'),
  },
  {
    serviceKey: 'plumbing',
    label: 'Plumbing',
    image: require('../../assets/images/featured/plumbing.jpg'),
  },
  {
    serviceKey: 'handyman',
    label: 'Handyman',
    image: require('../../assets/images/featured/handyman.jpg'),
  },
  {
    serviceKey: 'cleaning',
    label: 'Cleaning',
    image: require('../../assets/images/featured/cleaning.jpg'),
  },
  {
    serviceKey: 'ac',
    label: 'AC Repair & Maintenance',
    image: require('../../assets/images/featured/ac.jpg'),
  },
  {
    serviceKey: 'painting',
    label: 'Painting',
    image: require('../../assets/images/featured/painting.jpg'),
  },
];

// Popular Projects Data - each links to a specific category
const popularProjects = [
  {
    id: '1',
    title: 'Bathroom Renovation',
    price: 'From $2,500',
    image:
      
'https://customer-assets.emergentagent.com/job_02b87b3e-0772-4b24-8d3f-89ddeca1c0b1/artifacts/t82u2op5_pexels-curtis-adams-1694007-5502257.jpg',
    category: 'plumbing',
  },
  {
    id: '2',
    title: 'Cleaning',
    price: 'From $150',
    image:
      
'https://customer-assets.emergentagent.com/job_02b87b3e-0772-4b24-8d3f-89ddeca1c0b1/artifacts/yp24dhlb_pexels-karola-g-4239031-cleaning.jpg',
    category: 'cleaning',
  },
  {
    id: '3',
    title: 'Electrical Upgrade',
    price: 'From $800',
    image:
      
'https://customer-assets.emergentagent.com/job_02b87b3e-0772-4b24-8d3f-89ddeca1c0b1/artifacts/15z8tn4b_pexels-heiko-ruth-electrical.jpg',
    category: 'electrical',
  },
  {
    id: '4',
    title: 'AC Installation',
    price: 'From $1,200',
    image:
      
'https://customer-assets.emergentagent.com/job_02b87b3e-0772-4b24-8d3f-89ddeca1c0b1/artifacts/qi80xi8p_pexels-jose-andres-pacheco-cortes-3641213-5463576.jpg',
    category: 'ac',
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
    image: 
'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
    topic: 'home-improvement',
  },
  {
    id: '2',
    title: 'Energy Saving Tips',
    image: 
'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    topic: 'energy-saving',
  },
  {
    id: '3',
    title: 'Outdoor Living Ideas',
    image: 
'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400',
    topic: 'outdoor-living',
  },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { shouldShowBetaNotice, markBetaNoticeSeen } = useAuth();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const handleBetaNoticeContinue = async () => {
    await markBetaNoticeSeen();
  };

  const searchResults = useMemo(() => {
    return searchServices(searchQuery);
  }, [searchQuery]);

  const hasSearchQuery = searchQuery.trim().length > 0;
  const hasResults = searchResults.matchingSubCategories.length > 0;

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
    setIsSearchFocused(false);
  };

  const handleSubCategoryPress = (subCat: SubCategory) => {
    router.push({
      pathname: '/service-location',
      params: {
        category: subCat.parentCategory,
        categoryName: subCat.label,
        subCategory: subCat.id,
      },
    });
  };

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

  const navigateToCategory = (serviceKey: string) => {
    const category = categories.find((c) => c.serviceKey === serviceKey);
    if (category) {
      handleCategoryPress(category);
    }
  };

  const handleGetQuotesPress = () => {
    router.push('/all-services-directory');
  };

  const handleProjectPress = (project: (typeof popularProjects)[0]) => {
    navigateToCategory(project.category);
  };

  const handlePricingPress = (insight: (typeof pricingInsights)[0]) => {
    navigateToCategory(insight.category);
  };

  const handleInspirationPress = (item: (typeof inspirationContent)[0]) => 
{
    router.push({
      pathname: '/inspiration-detail',
      params: { topic: item.topic },
    });
  };

  return (
    <View style={styles.safeArea}>
      <BetaNoticeModal
        visible={shouldShowBetaNotice}
        onClose={handleBetaNoticeContinue}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gradientHeaderZone}>
          <LinearGradient
            colors={['transparent', 'transparent']}
            locations={[0, 0.3, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumGradient}
          />

          
          <View
            style={[
              styles.heroSection,
              { paddingTop: Math.max(insets.top, 10) + 20 },
            ]}
          >
            <View style={styles.heroHeader}>
              <View style={styles.heroHeaderSpacer} />
              <NotificationBell color="#FFFFFF" size={24} />
            </View>

            <Text style={styles.heroTitle}>
              What do you need{'\n'}help with today?
            </Text>

            <View style={styles.searchBar}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search services..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity
                  style={styles.searchAction}
                  onPress={handleClearSearch}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <View style={styles.searchAction}>
                  <Ionicons name="search-outline" size={16} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

        <View style={styles.carouselSection}>
          <Text style={styles.carouselTitle}>Featured Services</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselRow}
            decelerationRate="fast"
            snapToInterval={260 + 12}
          >
            {FEATURED_CAROUSEL_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.serviceKey}
                style={styles.carouselCard}
                onPress={() => navigateToCategory(item.serviceKey)}
                activeOpacity={0.85}
              >
                <Image
                  source={item.image}
                  style={styles.carouselImage}
                  resizeMode="cover"
                  fadeDuration={0}
                />
                <View style={styles.carouselOverlay}>
                  <Text style={styles.carouselLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

          <View style={styles.sectionOnGradient}>
            {hasSearchQuery ? (
              <>
                <Text style={styles.sectionTitleOnGradient}>Results</Text>
                {hasResults ? (
                  <View style={styles.servicesStackedList}>
                    {searchResults.matchingSubCategories.map((subCat) => (
                      <TouchableOpacity
                        key={subCat.id}
                        style={styles.serviceStackedCard}
                        onPress={() => handleSubCategoryPress(subCat)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.serviceStackedIconContainer}>
                          <Ionicons name={subCat.icon as any} size={22} color="#E53935" />
                        </View>
                        <Text style={styles.serviceStackedName} numberOfLines={1}>{subCat.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color="#CCC" />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noResultsSection}>
                    <View style={styles.noResultsContainer}>
                      <Ionicons
                        name="search-outline"
                        size={48}
                        color="rgba(255, 255, 255, 0.6)"
                      />
                      <Text style={styles.noResultsText}>
                        No matches for "{searchQuery}"
                      </Text>
                    </View>
                    <Text style={styles.suggestedTitle}>
                      Try these categories:
                    </Text>
                    <View style={styles.servicesGrid}>
                      {categories
                        .filter((cat) =>
                          SUGGESTED_CATEGORIES.includes(cat.serviceKey)
                        )
                        .map((category) => {
                          const feat = FEATURED_SERVICES.find((f) => f.serviceKey === category.serviceKey);
                          return (
                            <TouchableOpacity
                              key={category.serviceKey}
                              style={[
                                styles.serviceCard,
                                feat ? { backgroundColor: feat.bg } : undefined,
                              ]}
                              onPress={() => handleCategoryPress(category)}
                              activeOpacity={0.7}
                            >
                              {feat ? (
                                <Text style={styles.featuredEmoji}>{feat.emoji}</Text>
                              ) : (
                                <View style={styles.serviceIconContainer}>
                                  <Ionicons
                                    name={category.icon as any}
                                    size={26}
                                    color="#E53935"
                                  />
                                </View>
                              )}
                              <Text
                                style={styles.serviceName}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {category.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitleOnGradient}>All 
Services</Text>
                <View style={styles.servicesGrid}>
                  {categories.map((category) => {
                    const feat = FEATURED_SERVICES.find((f) => f.serviceKey === category.serviceKey);
                    return (
                      <TouchableOpacity
                        key={category.serviceKey}
                        style={[
                          styles.serviceCard,
                          feat ? { backgroundColor: feat.bg } : undefined,
                          category.status === 'beta' && styles.serviceCardBeta,
                        ]}
                        onPress={() => handleCategoryPress(category)}
                        activeOpacity={0.7}
                      >
                        {feat ? (
                          <Text style={styles.featuredEmoji}>{feat.emoji}</Text>
                        ) : (
                          <View style={styles.serviceIconContainer}>
                            <Ionicons
                              name={category.icon as any}
                              size={26}
                              color="#E53935"
                            />
                          </View>
                        )}
                        <Text
                          style={styles.serviceName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {category.label}
                        </Text>
                        {category.status === 'beta' && (
                          <View style={styles.betaBadge}>
                            <Text style={styles.betaBadgeText}>BETA</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          <View style={[styles.section, { marginBottom: 16 }]}>
            <View style={styles.ctaCard}>
              <View style={styles.ctaContent}>
                <View style={styles.ctaIconContainer}>
                  <Ionicons name="location" size={28} color="#E53935" />
                </View>
                <View style={styles.ctaTextContainer}>
                  <Text style={styles.ctaTitle}>Get prices in your 
area</Text>
                  <Text style={styles.ctaSubtitle}>
                    Connect with top-rated pros in Trinidad & Tobago
                  </Text>
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
                  <Text style={styles.ctaButtonText}>Browse 
Services</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.popularProjectsSection]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Popular 
Projects</Text>
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
                
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionOnGradient}>
          <TouchableOpacity
            style={styles.browseProvidersCard}
            onPress={() => router.push('/(customer)/provider-directory')}
            activeOpacity={0.9}
          >
            <View style={styles.browseProvidersIcon}>
              <Ionicons name="people" size={28} color="#E53935" />
            </View>
            <View style={styles.browseProvidersContent}>
              <Text style={styles.browseProvidersTitle}>Browse 
Providers</Text>
              <Text style={styles.browseProvidersSubtitle}>
                View all available service providers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#E53935" />
          </TouchableOpacity>
        </View>

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
                  <Ionicons
                    name={insight.icon as any}
                    size={24}
                    color="#E53935"
                  />
                </View>
                <Text style={styles.pricingTitle}>{insight.title}</Text>
                <Text 
style={styles.pricingSubtitle}>{insight.subtitle}</Text>
                <Text style={styles.pricingValue}>{insight.price}</Text>
                <View style={styles.pricingTapHint}>
                  <Text style={styles.pricingTapText}>View services 
→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Home 
Inspiration</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            decelerationRate="fast"
            snapToInterval={260 + 16}
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
                  <Text 
style={styles.inspirationTitle}>{item.title}</Text>
                </View>
                
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  gradientHeaderZone: {
    backgroundColor: '#FFFFFF',
  },
  premiumGradient: {
    display: 'none',
  },

  heroSection: {
    backgroundColor: '#005A92',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroHeaderSpacer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
    minHeight: 36,
  },
  searchAction: {
    width: 36,
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


  carouselTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginBottom: 10,
  },

  carouselSection: {
    marginTop: 28,
    marginBottom: 12,
  },
  carouselRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  carouselOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  carouselLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  carouselCard: {
    width: 260,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  featuredSection: {
    marginTop: 16,
    marginBottom: 4,
  },
  featuredRow: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  featuredCard: {
    width: 88,
    height: 88,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  featuredEmoji: {
    fontSize: 30,
    marginBottom: 6,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
  },

  section: {
    marginTop: 24,
  },
  popularProjectsSection: {
    marginTop: 40,
  },
  sectionOnGradient: {
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
  sectionTitleLight: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitleOnGradient: {
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

  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  serviceCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  servicesStackedList: { gap: 10, paddingHorizontal: 20 },
  serviceStackedCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  serviceStackedIconContainer: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FFF5F5',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  serviceStackedName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
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
    marginBottom: 8,
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

  noResultsSection: {
    paddingBottom: 16,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  suggestedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },

  browseProvidersCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  browseProvidersIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  browseProvidersContent: {
    flex: 1,
  },
  browseProvidersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  browseProvidersSubtitle: {
    fontSize: 13,
    color: '#666',
  },

  carouselContent: {
    paddingHorizontal: 20,
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

  ctaCard: {
    marginHorizontal: 20,
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

  pricingGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
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
    color: '#666',
    marginBottom: 8,
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
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
