import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * FAVORITES CONTEXT
 * 
 * Manages customer's favourite providers list with optimistic UI updates.
 * Persists to backend so favorites survive logout/reinstall.
 */

interface FavoriteProvider {
  _id: string;
  name: string;
  profilePhotoUrl?: string;
  services: string[];
  bio: string;
  verificationStatus: string;
  averageRating?: number;
  totalReviews?: number;
  availabilityStatus?: string;
}

interface FavoritesContextType {
  favoriteProviderIds: string[];
  favoriteProviders: FavoriteProvider[];
  loading: boolean;
  isFavorite: (providerId: string) => boolean;
  toggleFavorite: (providerId: string) => Promise<void>;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favoriteProviderIds: [],
  favoriteProviders: [],
  loading: false,
  isFavorite: () => false,
  toggleFavorite: async () => {},
  refreshFavorites: async () => {},
});

export const useFavorites = () => useContext(FavoritesContext);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [favoriteProviderIds, setFavoriteProviderIds] = useState<string[]>([]);
  const [favoriteProviders, setFavoriteProviders] = useState<FavoriteProvider[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if a provider is favorited
  const isFavorite = useCallback((providerId: string): boolean => {
    return favoriteProviderIds.includes(providerId);
  }, [favoriteProviderIds]);

  // Fetch favorites from backend
  const refreshFavorites = useCallback(async () => {
    if (!token || !user) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setFavoriteProviderIds(response.data.providerIds || []);
      setFavoriteProviders(response.data.favorites || []);
    } catch (err) {
      console.log('[Favorites] Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  // Toggle favorite status for a provider
  const toggleFavorite = useCallback(async (providerId: string) => {
    if (!token) return;
    
    const currentlyFavorited = favoriteProviderIds.includes(providerId);
    
    // Optimistic update
    if (currentlyFavorited) {
      setFavoriteProviderIds(prev => prev.filter(id => id !== providerId));
      setFavoriteProviders(prev => prev.filter(p => p._id !== providerId));
    } else {
      setFavoriteProviderIds(prev => [...prev, providerId]);
    }
    
    try {
      if (currentlyFavorited) {
        // Remove from favorites
        await axios.delete(`${BACKEND_URL}/api/favorites/${providerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        // Add to favorites
        await axios.post(`${BACKEND_URL}/api/favorites/${providerId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      // Refresh to get updated provider details
      if (!currentlyFavorited) {
        refreshFavorites();
      }
    } catch (err) {
      console.log('[Favorites] Toggle failed, reverting:', err);
      // Revert on error
      if (currentlyFavorited) {
        setFavoriteProviderIds(prev => [...prev, providerId]);
      } else {
        setFavoriteProviderIds(prev => prev.filter(id => id !== providerId));
      }
    }
  }, [token, favoriteProviderIds, refreshFavorites]);

  // Fetch favorites when user logs in
  useEffect(() => {
    if (token && user) {
      refreshFavorites();
    } else {
      // Clear on logout
      setFavoriteProviderIds([]);
      setFavoriteProviders([]);
    }
  }, [token, user]);

  return (
    <FavoritesContext.Provider
      value={{
        favoriteProviderIds,
        favoriteProviders,
        loading,
        isFavorite,
        toggleFavorite,
        refreshFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export default FavoritesContext;
