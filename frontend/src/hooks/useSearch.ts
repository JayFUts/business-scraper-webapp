import { useState, useEffect, useCallback } from 'react';
import { searchApi } from '@/lib/api';
import type { SearchResponse, SearchJob } from '@/types';
import toast from 'react-hot-toast';

export const useSearch = (searchId?: string) => {
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSearchResults = useCallback(async (id: string) => {
    try {
      const response = await searchApi.getSearchResults(id);
      if (response.success && response.data) {
        setSearchData(response.data);
        setError(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch search results');
    }
  }, []);

  const startSearch = async (businessType: string, location: string, maxResults?: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await searchApi.startSearch(businessType, location, maxResults);
      
      if (response.success && response.data) {
        toast.success('Search started successfully!');
        return response.data.searchId;
      }
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to start search';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async (id: string, format: 'json' | 'csv' = 'json') => {
    try {
      const response = await searchApi.exportResults(id, format);
      
      // Create download link
      const blob = new Blob([format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `search-results-${id}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Results exported as ${format.toUpperCase()}`);
    } catch (err: any) {
      toast.error('Failed to export results');
    }
  };

  const deleteSearch = async (id: string) => {
    try {
      await searchApi.deleteSearch(id);
      toast.success('Search deleted successfully');
      return true;
    } catch (err: any) {
      toast.error('Failed to delete search');
      return false;
    }
  };

  // Auto-refresh for active searches
  useEffect(() => {
    if (!searchId) return;

    const interval = setInterval(() => {
      fetchSearchResults(searchId);
    }, 5000); // Refresh every 5 seconds

    // Initial fetch
    fetchSearchResults(searchId);

    return () => clearInterval(interval);
  }, [searchId, fetchSearchResults]);

  return {
    searchData,
    loading,
    error,
    startSearch,
    exportResults,
    deleteSearch,
    refetch: searchId ? () => fetchSearchResults(searchId) : undefined
  };
};

export const useSearchHistory = () => {
  const [searches, setSearches] = useState<SearchJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const fetchSearches = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const response = await searchApi.getAllSearches(page, limit);
      
      if (response.success && response.data) {
        setSearches(response.data.searches);
        setPagination(response.data.pagination);
      }
    } catch (err: any) {
      toast.error('Failed to fetch search history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearches();
  }, []);

  return {
    searches,
    loading,
    pagination,
    fetchSearches,
    refetch: () => fetchSearches(pagination.page, pagination.limit)
  };
};