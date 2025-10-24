import { CCTV } from '../types/cctv';
import { Favorite } from '../types/Favorite';

export const fetchCCTVLocations = async (): Promise<CCTV[]> => {
  try {
    const response = await fetch('/api/cctv/locations', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, response: ${text}, url: /api/cctv/locations`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch CCTV locations');
    }

    console.log('CCTV locations fetched:', data.data);
    return data.data as CCTV[];
  } catch (error) {
    console.error('Error fetching CCTV locations:', error);
    return [];
  }
};

export const addFavorite = async (cctv_id: number): Promise<Favorite | null> => {
  try {
    const token = localStorage.getItem('token'); // 'authToken' → 'token'
    console.log('addFavorite: token=', token);
    if (!token) {
      console.warn('No token found. Redirecting to login.');
      window.location.href = '/login';
      return null;
    }
    const response = await fetch('/api/favorites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ cctv_id }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        console.warn('Unauthorized request. Redirecting to login.');
        window.location.href = '/login';
      }
      throw new Error(`HTTP error! status: ${response.status}, response: ${text}, url: /api/favorites`);
    }

    const data = await response.json();
    console.log('Favorite added:', data);
    return data as Favorite;
  } catch (error) {
    console.error('Error adding favorite for cctv_id:', cctv_id, error);
    return null;
  }
};

export const getUserFavorites = async (): Promise<Favorite[]> => {
  try {
    const token = localStorage.getItem('token'); // 'authToken' → 'token'
    console.log('getUserFavorites: token=', token);
    if (!token) {
      console.warn('No token found. Returning empty favorites.');
      return [];
    }
    const response = await fetch('/api/favorites/user/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        console.warn('Unauthorized request. Redirecting to login.');
        window.location.href = '/login';
      }
      throw new Error(`HTTP error! status: ${response.status}, response: ${text}, url: /api/favorites/user/me`);
    }

    const data = await response.json();
    console.log('User favorites fetched:', data);
    return data as Favorite[];
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    return [];
  }
};

export const removeFavorite = async (cctv_id: number): Promise<void> => {
  try {
    const token = localStorage.getItem('token'); // 'authToken' → 'token'
    console.log('removeFavorite: token=', token);
    if (!token) {
      console.warn('No token found. Redirecting to login.');
      window.location.href = '/login';
      return;
    }
    const response = await fetch(`/api/favorites/me/${cctv_id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        console.warn('Unauthorized request. Redirecting to login.');
        window.location.href = '/login';
      }
      throw new Error(`HTTP error! status: ${response.status}, response: ${text}, url: /api/favorites/me/${cctv_id}`);
    }
    console.log('Favorite removed for cctv_id:', cctv_id);
  } catch (error) {
    console.error('Error removing favorite for cctv_id:', cctv_id, error);
  }
};