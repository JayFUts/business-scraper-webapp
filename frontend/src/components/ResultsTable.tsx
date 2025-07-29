import { useState } from 'react';
import { 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  Download, 
  Scan,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search
} from 'lucide-react';
import type { SearchResponse, Business } from '@/types';

interface ResultsTableProps {
  searchData: SearchResponse;
  onExport: (format: 'json' | 'csv') => void;
  onScanEmails: (businessId: string, website: string) => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  searchData, 
  onExport, 
  onScanEmails 
}) => {
  const [scanningBusinesses, setScanningBusinesses] = useState<Set<string>>(new Set());
  
  const { search, businesses } = searchData;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'IN_PROGRESS':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'FAILED':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleScanEmails = async (business: Business) => {
    if (!business.website) return;
    
    setScanningBusinesses(prev => new Set(prev.add(business.id)));
    
    try {
      await onScanEmails(business.id, business.website);
    } finally {
      setScanningBusinesses(prev => {
        const newSet = new Set(prev);
        newSet.delete(business.id);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Search Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon(search.status)}
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {search.businessType} in {search.location}
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(search.status)}`}>
                {search.status}
              </span>
              <span>{search.resultsCount} results found</span>
              <span>Started {formatDate(search.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Export Buttons */}
        {search.status === 'COMPLETED' && businesses.length > 0 && (
          <div className="flex space-x-2">
            <button
              onClick={() => onExport('csv')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => onExport('json')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {search.status === 'FAILED' && search.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-800 font-medium">Search Failed</span>
          </div>
          <p className="text-red-700 mt-1">{search.error}</p>
        </div>
      )}

      {/* Progress Bar */}
      {search.status === 'IN_PROGRESS' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-blue-800 font-medium">Search in Progress</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((search.resultsCount / 20) * 100, 100)}%` }}
            />
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Found {search.resultsCount} businesses so far...
          </p>
        </div>
      )}

      {/* Results Table */}
      {businesses.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Emails
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {businesses.map((business) => (
                  <tr key={business.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {business.name}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {business.address}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {business.phone && (
                        <div className="text-sm text-gray-900 flex items-center">
                          <Phone className="h-3 w-3 mr-1" />
                          <a 
                            href={`tel:${business.phone}`}
                            className="hover:text-blue-600"
                          >
                            {business.phone}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {business.website && (
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Visit
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {business.emails.length > 0 ? (
                        <div className="space-y-1">
                          {business.emails.slice(0, 2).map((email, index) => (
                            <div key={index} className="text-sm text-gray-900 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              <a 
                                href={`mailto:${email}`}
                                className="hover:text-blue-600"
                              >
                                {email}
                              </a>
                            </div>
                          ))}
                          {business.emails.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{business.emails.length - 2} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No emails</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {business.website && business.emails.length === 0 && (
                        <button
                          onClick={() => handleScanEmails(business)}
                          disabled={scanningBusinesses.has(business.id)}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          {scanningBusinesses.has(business.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Scan className="h-3 w-3" />
                          )}
                          <span>Scan Emails</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {businesses.length === 0 && search.status === 'COMPLETED' && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4" />
            <p className="text-lg font-medium">No businesses found</p>
            <p className="text-sm mt-1">Try a different business type or location</p>
          </div>
        </div>
      )}
    </div>
  );
};