import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
  
  // Use ref for token to avoid stale closures
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Check if a provider is favorited
  const isFavorite = useCallback((providerId: string): boolean => {
    const result = favoriteProviderIds.includes(providerId);
    return result;
  }, [favoriteProviderIds]);

  // Fetch favorites from backend
  const refreshFavorites = useCallback(async () => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      console.log('[Favorites] No token, skipping refresh');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[Favorites] Fetching from:', `${BACKEND_URL}/api/favorites`);
      const response = await axios.get(`${BACKEND_URL}/api/favorites`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      
      console.log('[Favorites] GET response:', JSON.stringify(response.data));
      const ids = response.data.providerIds || [];
      const providers = response.data.favorites || [];
      
      console.log('[Favorites] Setting providerIds:', ids.length, 'providers:', providers.length);
      setFavoriteProviderIds(ids);
      setFavoriteProviders(providers);
    } catch (err: any) {
      console.error('[Favorites] GET failed:', err?.response?.status, err?.response?.data || err?.message);
      // Keep empty state on error
      setFavoriteProviderIds([]);
      setFavoriteProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle favorite status for a provider
  const toggleFavorite = useCallback(async (providerId: string) => {
    const currentToken = tokenRef.current;
    if (!currentToken) {
      console.log('[Favorites] No token, cannot toggle');
      return;
    }
    
    console.log('[Favorites] toggleFavorite called with providerId:', providerId);
    
    const currentlyFavorited = favoriteProviderIds.includes(providerId);
    console.log('[Favorites] Currently favorited:', currentlyFavorited);
    
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
        const url = `${BACKEND_URL}/api/favorites/${providerId}`;
        console.log('[Favorites] DELETE:', url);
        const response = await axios.delete(url, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        console.log('[Favorites] DELETE response:', response.status, response.data);
      } else {
        // Add to favorites
        const url = `${BACKEND_URL}/api/favorites/${providerId}`;
        console.log('[Favorites] POST:', url);
        const response = await axios.post(url, {}, {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        console.log('[Favorites] POST response:', response.status, response.data);
      }
      
      // ALWAYS refresh after successful toggle to get full provider data
      console.log('[Favorites] Refreshing after toggle...');
      await refreshFavorites();
      
    } catch (err: any) {
      console.error('[Favorites] Toggle API failed:', err?.response?.status, err?.response?.data || err?.message);
      // Revert on error
      if (currentlyFavorited) {
        setFavoriteProviderIds(prev => [...prev, providerId]);
      } else {
        setFavoriteProviderIds(prev => prev.filter(id => id !== providerId));
      }
    }
  }, [favoriteProviderIds, refreshFavorites]);

  // Fetch favorites when user logs in
  useEffect(() => {
    if (token && user) {
      console.log('[Favorites] User logged in, fetching favorites...');
      refreshFavorites();
    } else {
      // Clear on logout
      console.log('[Favorites] No user, clearing favorites');
      setFavoriteProviderIds([]);
      setFavoriteProviders([]);
    }
  }, [token, user?._id]);

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
