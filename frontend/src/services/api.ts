import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';

const cache: { [key: string]: { data: any; timestamp: number } } = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

export const fetchCCTVLocations = async (retries = 3, delay = 2000): Promise<{ success: boolean; data: CCTV[] }> => {
  const cacheKey = 'cctv_locations';
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('fetchCCTVLocations: Returning cached data', cached.data);
    return cached.data;
  }

  const attemptFetch = async (attempt: number): Promise<{ success: boolean; data: CCTV[] }> => {
    try {
      console.log('fetchCCTVLocations: Fetching data');
      const response = await fetch('/api/cctv/locations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${await response.text()}, url: /api/cctv/locations`);
      }
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('CCTV locations response is invalid');
      }
      cache[cacheKey] = { data: result, timestamp: Date.now() };
      console.log('fetchCCTVLocations: Data fetched successfully', result);
      return result;
    } catch (error: any) {
      console.error('fetchCCTVLocations: Error fetching data:', error);
      if (error.message.includes('429') && attempt > 0) {
        console.log(`fetchCCTVLocations: Retrying (${attempt} retries left)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return attemptFetch(attempt - 1);
      }
      throw error;
    }
  };

  return attemptFetch(retries);
};

export const getUserFavorites = async (retries = 3, delay = 2000): Promise<Favorite[]> => {
  const token = localStorage.getItem('token');
  console.log('getUserFavorites: token=', token);
  const cacheKey = 'user_favorites';
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('getUserFavorites: Returning cached data', cached.data);
    return cached.data;
  }

  const attemptFetch = async (attempt: number): Promise<Favorite[]> => {
    try {
      const response = await fetch('/api/favorites/user/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${await response.text()}, url: /api/favorites/user/me`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('User favorites response is not an array');
      }
      cache[cacheKey] = { data, timestamp: Date.now() };
      console.log('getUserFavorites: Data fetched successfully, count:', data.length, data);
      return data;
    } catch (error: any) {
      console.error('getUserFavorites: Error fetching data:', error);
      if (error.message.includes('429') && attempt > 0) {
        console.log(`getUserFavorites: Retrying (${attempt} retries left)...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return attemptFetch(attempt - 1);
      }
      throw error;
    }
  };

  return attemptFetch(retries);
};

export const addFavorite = async (cctv_id: number): Promise<void> => {
  const token = localStorage.getItem('token');
  console.log('addFavorite: Adding favorite for cctv_id:', cctv_id);
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ cctv_id }),
  });
  if (!response.ok) {
    throw new Error(`Failed to add favorite: ${await response.text()}`);
  }
  delete cache['user_favorites'];
  console.log('addFavorite: Cache invalidated for user_favorites');
};

export const removeFavorite = async (cctv_id: number): Promise<void> => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found');
  }
  console.log('removeFavorite: Removing favorite for cctv_id:', cctv_id, 'token:', token);
  const response = await fetch(`/api/favorites/me/${cctv_id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    let errorText;
    try {
      errorText = await response.json();
      errorText = errorText.error || JSON.stringify(errorText);
    } catch {
      errorText = await response.text();
    }
    throw new Error(`Failed to remove favorite: ${errorText}, status: ${response.status}`);
  }
  delete cache['user_favorites'];
  console.log('removeFavorite: Cache invalidated for user_favorites');
};