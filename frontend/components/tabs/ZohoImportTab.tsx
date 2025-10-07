import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckSquare, Square, Filter } from 'lucide-react';

interface ZohoContact {
  id: string;
  Full_Name: string;
  Email: string;
  Emplyee_ID?: string;
  Language?: string;
  Service_Location?: string;
  LL_Onboarding_Status?: string;
  Cloudbreak_ID?: string;
  Languagelink_ID?: string;
  Propio_ID?: string;
}

interface FilterOptions {
  onboardingStatuses: string[];
  languages: string[];
  serviceLocations: string[];
}

interface ZohoImportTabProps {
  zohoCandidates: ZohoContact[];
  selectedCandidates: Set<string>;
  loading: boolean;
  existingInterpreters: any[]; // List of interpreters from database
  onFetchCandidates: (filters: {
    module?: string;
    onboardingStatus?: string;
    language?: string;
    serviceLocation?: string;
  }) => void;
  onToggleCandidate: (id: string) => void;
  onToggleAll: () => void;
  onImportSelected: () => void;
}

export const ZohoImportTab: React.FC<ZohoImportTabProps> = ({
  zohoCandidates,
  selectedCandidates,
  loading,
  existingInterpreters,
  onFetchCandidates,
  onToggleCandidate,
  onToggleAll,
  onImportSelected
}) => {
  const [module, setModule] = useState('Contacts');
  const [onboardingStatus, setOnboardingStatus] = useState('Fully Onboarded');
  const [language, setLanguage] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    onboardingStatuses: [],
    languages: [],
    serviceLocations: []
  });
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Fetch filter options from Zoho on component mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch('http://localhost:8000/api/zoho/filter-options');
        const data = await response.json();
        if (data.success) {
          setFilterOptions(data.filterOptions);
        }
      } catch (error) {
        console.error('Failed to load filter options:', error);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchFilterOptions();
  }, []);

  const handleFetch = () => {
    setTableSearch(''); // Clear table search when fetching new data
    onFetchCandidates({
      module: module || undefined,
      onboardingStatus: onboardingStatus || undefined,
      language: language || undefined,
      serviceLocation: serviceLocation || undefined
    });
  };

  // Check if contact already exists in database by email
  const isAlreadyImported = (email: string | undefined): boolean => {
    if (!email) return false;
    return existingInterpreters.some(
      interpreter => interpreter.email?.toLowerCase() === email.toLowerCase()
    );
  };

  // Apply client-side search to results
  const filteredCandidates = zohoCandidates.filter(contact => {
    if (!tableSearch) return true;
    const searchLower = tableSearch.toLowerCase();
    return (
      contact.Full_Name?.toLowerCase().includes(searchLower) ||
      contact.Email?.toLowerCase().includes(searchLower) ||
      contact.Emplyee_ID?.toLowerCase().includes(searchLower) ||
      contact.Language?.toLowerCase().includes(searchLower) ||
      contact.Service_Location?.toLowerCase().includes(searchLower)
    );
  });

  const allSelected = filteredCandidates.length > 0 &&
    filteredCandidates.every(c => selectedCandidates.has(c.id));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Zoho Contact Import</h2>
        <p className="text-gray-600">
          Fetch contacts from Zoho CRM and select which ones to import as interpreters
        </p>
      </div>

      {/* Filters Section */}
      <div className="mb-4 border rounded-lg p-4 bg-gray-50">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Filter size={18} />
            Filters
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>
        </div>

        {showFilters && (
          <div className="space-y-4 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Module
                </label>
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="Contacts">Contacts</option>
                  <option value="Leads">Leads</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Onboarding Status
                </label>
                <select
                  value={onboardingStatus}
                  onChange={(e) => setOnboardingStatus(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">All Statuses</option>
                  {filterOptions.onboardingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">All Languages</option>
                  {filterOptions.languages.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Service Location
                </label>
                <select
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  disabled={loadingOptions}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">All Locations</option>
                  {filterOptions.serviceLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleFetch}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Fetching...' : 'Fetch Contacts'}
          </button>

          {zohoCandidates.length > 0 && (
            <button
              onClick={onImportSelected}
              disabled={selectedCandidates.size === 0}
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              <Download size={18} />
              Import Selected ({selectedCandidates.size})
            </button>
          )}
        </div>
      </div>

      {/* Results Section */}
      {zohoCandidates.length > 0 && (
        <div>
          <div className="mb-3 space-y-3">
            {/* Active filters summary */}
            {(module || onboardingStatus || language || serviceLocation) && (
              <div className="text-sm bg-blue-50 border border-blue-200 rounded p-3">
                <span className="font-semibold text-blue-900">Active Filters: </span>
                <span className="inline-block bg-purple-100 px-2 py-1 rounded mr-2 text-purple-800">Module: {module}</span>
                {onboardingStatus && <span className="inline-block bg-blue-100 px-2 py-1 rounded mr-2 text-blue-800">Status: {onboardingStatus}</span>}
                {language && <span className="inline-block bg-blue-100 px-2 py-1 rounded mr-2 text-blue-800">Language: {language}</span>}
                {serviceLocation && <span className="inline-block bg-blue-100 px-2 py-1 rounded text-blue-800">Location: {serviceLocation}</span>}
              </div>
            )}

            {/* Counters and search */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold text-blue-600">{filteredCandidates.length}</span> contacts displayed
                  {tableSearch && <span className="text-gray-500"> (filtered from {zohoCandidates.length})</span>}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedCandidates.size} selected for import
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Table search */}
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search results..."
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded w-64"
                />

                <button
                  onClick={onToggleAll}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap"
                >
                  {allSelected ? (
                    <>
                      <Square size={16} /> Deselect All
                    </>
                  ) : (
                    <>
                      <CheckSquare size={16} /> Select All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Already Imported
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCandidates.map((contact) => (
                  <tr
                    key={contact.id}
                    className={`hover:bg-gray-50 ${
                      selectedCandidates.has(contact.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(contact.id)}
                        onChange={() => onToggleCandidate(contact.id)}
                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {contact.Full_Name || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {contact.Email || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-sm">
                      {contact.Emplyee_ID || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {contact.Language || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {contact.Service_Location || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        contact.LL_Onboarding_Status === 'Fully Onboarded'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {contact.LL_Onboarding_Status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isAlreadyImported(contact.Email) ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                          ✓ Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && zohoCandidates.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-2">No contacts loaded yet</p>
          <p className="text-sm">Click "Fetch Contacts" to load contacts from Zoho CRM</p>
        </div>
      )}
    </div>
  );
};
