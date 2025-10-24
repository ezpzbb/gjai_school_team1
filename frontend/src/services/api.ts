/// <reference types="vite/client" />

import { CCTV } from '../types/cctv';

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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch CCTV locations');
    }

    return data.data as CCTV[];
  } catch (error) {
    console.error('Error fetching CCTV locations:', error);
    throw error;
  }
};