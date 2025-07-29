import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchFormProps {
  onSearch: (businessType: string, location: string) => void;
  loading?: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({ onSearch, loading }) => {
  const [businessType, setBusinessType] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (businessType.trim() && location.trim()) {
      onSearch(businessType.trim(), location.trim());
    }
  };

  const commonBusinessTypes = [
    'Restaurant', 'Café', 'Hotel', 'Gym', 'Salon', 'Dentist', 
    'Lawyer', 'Accountant', 'Real Estate', 'Auto Repair',
    'Pharmacy', 'Bakery', 'Florist', 'Pet Store'
  ];

  const commonLocations = [
    'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven',
    'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen'
  ];

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Business Type Input */}
          <div>
            <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-2">
              Business Type *
            </label>
            <input
              id="businessType"
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g., Restaurant, Dentist, Hotel"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {commonBusinessTypes.slice(0, 6).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBusinessType(type)}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Location Input */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Amsterdam, Utrecht, Rotterdam"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {commonLocations.slice(0, 5).map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setLocation(city)}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {city}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={loading || !businessType.trim() || !location.trim()}
            className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 min-w-[200px] justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                <span>Search Realtime</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search Tips */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Search Tips</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Be specific with business types (e.g., "Italian Restaurant" vs "Restaurant")</li>
          <li>• Include city or neighborhood for better results</li>
          <li>• Results typically appear within 30-60 seconds</li>
          <li>• Free users get up to 20 results per search</li>
        </ul>
      </div>
    </div>
  );
};