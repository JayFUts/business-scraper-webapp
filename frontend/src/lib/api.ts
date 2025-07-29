import axios from 'axios';
import type { ApiResponse, SearchResponse, AuthResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API functions
export const searchApi = {
  startSearch: async (businessType: string, location: string, maxResults?: number) => {
    const response = await api.post<ApiResponse<{ searchId: string; status: string; message: string }>>('/search', {
      businessType,
      location,
      maxResults
    });
    return response.data;
  },

  getSearchResults: async (searchId: string) => {
    const response = await api.get<ApiResponse<SearchResponse>>(`/search/${searchId}`);
    return response.data;
  },

  getAllSearches: async (page = 1, limit = 10) => {
    const response = await api.get<ApiResponse>('/search', {
      params: { page, limit }
    });
    return response.data;
  },

  exportResults: async (searchId: string, format: 'json' | 'csv' = 'json') => {
    const response = await api.get(`/search/${searchId}/export`, {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response;
  },

  deleteSearch: async (searchId: string) => {
    const response = await api.delete<ApiResponse>(`/search/${searchId}`);
    return response.data;
  }
};

export const businessApi = {
  getBusiness: async (businessId: string) => {
    const response = await api.get<ApiResponse>(`/business/${businessId}`);
    return response.data;
  },

  scanEmails: async (businessId: string, website: string) => {
    const response = await api.post<ApiResponse>(`/business/${businessId}/scan-emails`, {
      website
    });
    return response.data;
  },

  searchBusinesses: async (params: {
    search?: string;
    hasEmail?: boolean;
    hasWebsite?: boolean;
    source?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await api.get<ApiResponse>('/business', { params });
    return response.data;
  }
};

export const authApi = {
  register: async (name: string, email: string, password: string) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', {
      name,
      email,
      password
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse>('/auth/profile');
    return response.data;
  },

  updateProfile: async (name: string) => {
    const response = await api.put<ApiResponse>('/auth/profile', { name });
    return response.data;
  }
};