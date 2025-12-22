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

const categories = [
  {
    id: 'electrical',
    name: 'Electrical',
    icon: 'flash' as const,
    color: '#FFB020',
    bgColor: '#FFF8E1',
  },
  {
    id: 'plumbing',
    name: 'Plumbing',
    icon: 'water' as const,
    color: '#2196F3',
    bgColor: '#E3F2FD',
  },
  {
    id: 'ac',
    name: 'AC Repair',
    icon: 'snow' as const,
    color: '#00BCD4',
    bgColor: '#E0F7FA',
  },
  {
    id: 'cleaning',
    name: 'Cleaning',
    icon: 'sparkles' as const,
    color: '#9C27B0',
    bgColor: '#F3E5F5',
  },
  {
    id: 'handyman',
    name: 'Handyman',
    icon: 'hammer' as const,
    color: '#FF5722',
    bgColor: '#FBE9E7',
  },
];

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const handleCategoryPress = (categoryId: string, categoryName: string) => {
    router.push({
      pathname: '/provider-list',
      params: { category: categoryId, categoryName },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
                key={category.id}
                style={styles.categoryCard}
                onPress={() => handleCategoryPress(category.id, category.name)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.categoryIconContainer,
                    { backgroundColor: category.bgColor },
                  ]}
                >
                  <Ionicons
                    name={category.icon}
                    size={32}
                    color={category.color}
                  />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
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
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  categoryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'center',
  },
});