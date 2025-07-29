export interface Business {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  emails: string[];
  source: 'GOOGLE_MAPS' | 'WEBSITE_SCAN';
  extractedAt: string;
}

export interface SearchJob {
  id: string;
  businessType: string;
  location: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resultsCount: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface SearchResponse {
  search: SearchJob;
  businesses: Business[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  subscription: 'FREE' | 'PREMIUM';
  credits: number;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}