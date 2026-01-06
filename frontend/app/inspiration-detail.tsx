import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Content for each inspiration topic
const inspirationData: Record<string, {
  title: string;
  subtitle: string;
  headerImage: string;
  items: { title: string; description: string; image?: string; useContain?: boolean }[];
}> = {
  'home-improvement': {
    title: '10 Ways to Improve Your Home',
    subtitle: 'Simple upgrades that make a big difference',
    headerImage: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
    items: [
      {
        title: '1. Freshen Up With Paint',
        description: 'A new coat of paint is one of the fastest ways to refresh any room. Neutral and light tones help spaces feel cooler and more spacious.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/vaaae1jy_Fresh%20paint.jpg',
      },
      {
        title: '2. Upgrade Light Fixtures',
        description: 'Modern light fixtures instantly update the look of a home. Energy-efficient lighting also helps reduce electricity costs.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/f3wbozyk_Lighting%20%26%20fixtures.jpg',
        useContain: true, // Show full fixtures without cropping
      },
      {
        title: '3. Install Ceiling Fans',
        description: 'Ceiling fans improve airflow and reduce the need for constant air-conditioning, making them ideal for Trinidad\'s climate.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/64wt73u3_Ceiling%20fan.jpg',
        useContain: true, // Show full ceiling fan without cropping
      },
      {
        title: '4. Refresh Cabinet Hardware',
        description: 'Replacing old handles and knobs can make kitchens and bathrooms look new without major renovations.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/n4wapf6c_cabinet%20hardware.jpg',
      },
      {
        title: '5. Add Indoor Plants',
        description: 'Indoor plants improve air quality and bring life into your home. Low-maintenance plants thrive well in tropical environments.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/lhzvcn76_indoor%20plants.jpg',
      },
      {
        title: '6. Upgrade Faucets and Fixtures',
        description: 'New faucets improve water efficiency and add a modern touch to kitchens and bathrooms.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/vtva4qev_Faucet.png',
      },
      {
        title: '7. Install Smart Switches',
        description: 'Smart switches allow you to control lighting remotely, improve energy efficiency, and add everyday convenience.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/i40yal2s_Smart%20switch.jpg',
      },
      {
        title: '8. Deep Clean Tile and Grout',
        description: 'Professional tile and grout cleaning restores floors and bathrooms, making them look brand new without replacement.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/ytb377ls_Tile%20%26%20grout%20cleaning.jpg',
      },
      {
        title: '9. Improve Storage Solutions',
        description: 'Built-in shelving and closet organizers help maximize space and keep your home clutter-free.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/kr6f74dk_Storage%20solution.jpg',
      },
      {
        title: '10. Service Your AC System',
        description: 'Regular AC servicing improves cooling performance, lowers electricity bills, and extends the life of your unit.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/96gvs97k_AC%20unit.jpg',
      },
    ],
  },
  'energy-saving': {
    title: 'Energy Saving Tips',
    subtitle: 'Cut costs while staying cool in Trinidad & Tobago',
    headerImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    items: [
      {
        title: 'Optimize Your AC',
        description: 'Set your AC to 24-25°C. Each degree lower increases energy use by 3-5%. Use timers to run only when needed.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/3tf8cdnb_Optimize%20AC.jpg',
      },
      {
        title: 'Switch to LED Bulbs',
        description: 'LEDs use 75% less energy than incandescent bulbs and last 25 times longer. The savings add up.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/x7e09pe8_LED%20Bulbs.jpg',
      },
      {
        title: 'Unplug When Not in Use',
        description: 'Appliances on standby still draw power. Unplug chargers, TVs, and kitchen appliances when not in use.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/eh4e7ikq_Unplug%20appliances.jpg',
      },
      {
        title: 'Use Natural Ventilation',
        description: 'Open windows in the morning and evening when it\'s cooler. Cross-ventilation reduces AC dependency.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/qu0skvpx_Natural%20Ventilation.jpg',
      },
      {
        title: 'Install Window Films',
        description: 'Reflective films block heat from entering while keeping your view. Reduces AC load significantly.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/zfmkws7u_Window%20Film.jpg',
      },
      {
        title: 'Wash in Cold Water',
        description: '90% of washing machine energy goes to heating water. Cold water cleans just as well.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/lec98ke3_Cold%20water%20washing.jpg',
      },
      {
        title: 'Service Appliances Regularly',
        description: 'Clean refrigerator coils, AC filters, and dryer vents. Maintained appliances work more efficiently.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/lgtqk3r7_service%20appliances.jpg',
      },
      {
        title: 'Use Ceiling Fans with AC',
        description: 'Fans circulate cool air, letting you raise the AC temperature while staying comfortable.',
        image: 'https://customer-assets.emergentagent.com/job_browse-services/artifacts/7cu5g2hc_Use%20of%20ceiling%20fans%20%26%20AC.jpg',
      },
    ],
  },
  'outdoor-living': {
    title: 'Outdoor Living Ideas',
    subtitle: 'Make the most of Trinidad\'s beautiful weather',
    headerImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    items: [
      {
        title: 'Create a Shaded Patio',
        description: 'Add a pergola or retractable awning to enjoy your outdoor space even during the hottest hours.',
        image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400',
      },
      {
        title: 'Install Outdoor Lighting',
        description: 'String lights, solar path lights, and wall sconces extend your outdoor time into the evening.',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
      },
      {
        title: 'Build a Small Deck',
        description: 'Even a compact wooden deck creates a defined outdoor living space. Use pressure-treated lumber.',
      },
      {
        title: 'Add Container Gardens',
        description: 'Herbs, flowers, and small fruit trees in pots add color and freshness without major landscaping.',
        image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
      },
      {
        title: 'Create Privacy with Plants',
        description: 'Bamboo, hibiscus hedges, or tall grasses create natural privacy screens that look beautiful.',
      },
      {
        title: 'Install a Hammock',
        description: 'The ultimate tropical relaxation spot. Choose a shaded corner between two sturdy trees or posts.',
      },
      {
        title: 'Set Up an Outdoor Kitchen',
        description: 'A simple grill station with prep space makes entertaining easy and keeps cooking heat outside.',
        image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400',
      },
      {
        title: 'Add Water Features',
        description: 'A small fountain or water feature creates ambiance and masks neighborhood noise.',
      },
    ],
  },
};

export default function InspirationDetailScreen() {
  const router = useRouter();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  
  const content = inspirationData[topic || 'home-improvement'];
  
  if (!content) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Content not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Inspiration</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <Image
          source={{ uri: content.headerImage }}
          style={styles.heroImage}
          resizeMode="cover"
        />

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>

        {/* Content Items */}
        <View style={styles.contentSection}>
          {content.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              {item.image && (
                <View style={item.useContain ? styles.itemImageContainWrapper : undefined}>
                  <Image
                    source={{ uri: item.image }}
                    style={item.useContain ? styles.itemImageContain : styles.itemImage}
                    resizeMode={item.useContain ? 'contain' : 'cover'}
                  />
                </View>
              )}
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
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
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: 220,
    backgroundColor: '#E0E0E0',
  },
  titleSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  contentSection: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  itemImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#E0E0E0',
  },
  itemImageContainWrapper: {
    width: '100%',
    height: 180,
    backgroundColor: '#F0F2F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImageContain: {
    width: '100%',
    height: 180,
  },
  itemContent: {
    padding: 16,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  itemDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    color: '#E53935',
    fontWeight: '600',
  },
});
