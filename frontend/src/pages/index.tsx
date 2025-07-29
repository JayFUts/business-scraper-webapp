import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Search, Database, Zap, Shield, Users, Download } from 'lucide-react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable } from '@/components/ResultsTable';
import { useSearch } from '@/hooks/useSearch';

export default function Home() {
  const [currentSearchId, setCurrentSearchId] = useState<string | null>(null);
  const { searchData, loading, startSearch } = useSearch(currentSearchId || undefined);

  const handleSearch = async (businessType: string, location: string) => {
    const searchId = await startSearch(businessType, location);
    if (searchId) {
      setCurrentSearchId(searchId);
    }
  };

  return (
    <>
      <Head>
        <title>Business Scraper - Find Business Data Instantly</title>
        <meta name="description" content="Professional business data scraping platform for finding contact information and business details" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Business Scraper</span>
              </div>
              <div className="flex items-center space-x-4">
                <Link href="/login" className="text-gray-600 hover:text-gray-900">
                  Login
                </Link>
                <Link href="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Find Business Data
              <span className="text-blue-600"> Instantly</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Professional business data scraping platform. Get contact information, 
              websites, and email addresses for any business type in any location.
            </p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
            <SearchForm onSearch={handleSearch} loading={loading} />
          </div>

          {/* Results */}
          {searchData && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <ResultsTable 
                searchData={searchData}
                onExport={() => {}}
                onScanEmails={() => {}}
              />
            </div>
          )}

          {/* Features Section */}
          {!searchData && (
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <Search className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Smart Search</h3>
                <p className="text-gray-600">
                  Find businesses by type and location using advanced Google Maps scraping technology.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <Zap className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Real-time Results</h3>
                <p className="text-gray-600">
                  Get live updates as we find businesses and extract their contact information.
                </p>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <Download className="h-12 w-12 text-blue-600 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Export Data</h3>
                <p className="text-gray-600">
                  Download your results in CSV or JSON format for easy integration with your systems.
                </p>
              </div>
            </div>
          )}

          {/* Trust Indicators */}
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Legal & Ethical</p>
            </div>
            <div>
              <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Structured Data</p>
            </div>
            <div>
              <Users className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Professional Grade</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center mb-4">
                  <Database className="h-6 w-6 text-blue-400" />
                  <span className="ml-2 text-lg font-semibold">Business Scraper</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Professional business data extraction platform for modern businesses.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link href="/features">Features</Link></li>
                  <li><Link href="/pricing">Pricing</Link></li>
                  <li><Link href="/api">API</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link href="/docs">Documentation</Link></li>
                  <li><Link href="/help">Help Center</Link></li>
                  <li><Link href="/contact">Contact</Link></li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><Link href="/privacy">Privacy Policy</Link></li>
                  <li><Link href="/terms">Terms of Service</Link></li>
                  <li><Link href="/compliance">Compliance</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
              <p>&copy; 2024 Business Scraper. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}