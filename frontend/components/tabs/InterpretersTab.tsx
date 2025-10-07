import React from 'react';
import { Upload, Users, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { Interpreter } from '@/lib/types';

interface InterpretersTabProps {
  interpreters: Interpreter[];
  filteredInterpreters: Interpreter[];
  uniqueLanguages: string[];
  uniqueServiceLocations: string[];
  uniquePaymentFrequencies: string[];
  uniqueOnboardingStatuses: string[];
  filterLanguage: string;
  filterServiceLocation: string;
  filterPaymentFrequency: string;
  filterOnboardingStatus: string;
  searchText: string;
  onFilterChange: (filter: string, value: string) => void;
  onClearFilters: () => void;
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddInterpreter: () => void;
  onEditInterpreter: (interpreter: Interpreter) => void;
  onDeleteInterpreter: (id: string) => void;
  onSyncFromZoho: () => void;
  isSyncing?: boolean;
}

export const InterpretersTab: React.FC<InterpretersTabProps> = ({
  interpreters,
  filteredInterpreters,
  uniqueLanguages,
  uniqueServiceLocations,
  uniquePaymentFrequencies,
  uniqueOnboardingStatuses,
  filterLanguage,
  filterServiceLocation,
  filterPaymentFrequency,
  filterOnboardingStatus,
  searchText,
  onFilterChange,
  onClearFilters,
  onImportCSV,
  onAddInterpreter,
  onEditInterpreter,
  onDeleteInterpreter,
  onSyncFromZoho,
  isSyncing = false
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">Interpreters</h2>
          <p className="text-sm text-gray-600 mt-1">
            Showing: <span className="font-semibold text-blue-600">{filteredInterpreters.length}</span> of <span className="font-semibold text-blue-600">{interpreters.length}</span> interpreters
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSyncFromZoho}
            disabled={isSyncing}
            className={`flex items-center gap-2 px-4 py-2 rounded ${
              isSyncing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-500 hover:bg-purple-600'
            } text-white`}
          >
            <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Fetch from Zoho'}
          </button>
          <label className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 cursor-pointer">
            <Upload size={20} />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={onImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={onAddInterpreter}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <Plus size={20} />
            Add Manually
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
        <p className="text-sm text-blue-800">
          💡 Import your interpreter list from CRM CSV. Include columns: &quot;Rate Per Minute&quot; and &quot;Rate Per Hour&quot; to set what you PAY each interpreter.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="grid grid-cols-5 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
            <select
              value={filterLanguage}
              onChange={(e) => onFilterChange('language', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="all">All Languages</option>
              {uniqueLanguages.map(lang => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service Location</label>
            <select
              value={filterServiceLocation}
              onChange={(e) => onFilterChange('serviceLocation', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="all">All Locations</option>
              {uniqueServiceLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Payment Frequency</label>
            <select
              value={filterPaymentFrequency}
              onChange={(e) => onFilterChange('paymentFrequency', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="all">All Frequencies</option>
              {uniquePaymentFrequencies.map(freq => (
                <option key={freq} value={freq}>{freq}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Onboarding Status</label>
            <select
              value={filterOnboardingStatus}
              onChange={(e) => onFilterChange('onboardingStatus', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            >
              <option value="all">All Statuses</option>
              {uniqueOnboardingStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => onFilterChange('search', e.target.value)}
              placeholder="Name, email, or ID..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
        </div>

        <button
          onClick={onClearFilters}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Clear All Filters
        </button>
      </div>

      {filteredInterpreters.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          {interpreters.length === 0 ? (
            <>
              <p className="text-lg mb-2">No interpreters yet</p>
              <p className="text-sm">Import from CSV or add manually</p>
            </>
          ) : (
            <>
              <p className="text-lg mb-2">No interpreters match your filters</p>
              <p className="text-sm">Try adjusting your filters or search criteria</p>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border px-2 py-1.5 text-left text-xs">Name</th>
                <th className="border px-2 py-1.5 text-left text-xs">Email</th>
                <th className="border px-2 py-1.5 text-left text-xs">Languages</th>
                <th className="border px-2 py-1.5 text-left text-xs">Country</th>
                <th className="border px-2 py-1.5 text-center text-xs">CB ID</th>
                <th className="border px-2 py-1.5 text-center text-xs">LL ID</th>
                <th className="border px-2 py-1.5 text-center text-xs">Propio ID</th>
                <th className="border px-2 py-1.5 text-center text-xs">Rate/Min</th>
                <th className="border px-2 py-1.5 text-center text-xs">Rate/Hour</th>
                <th className="border px-2 py-1.5 text-center text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInterpreters.map(i => (
                <tr key={i.id}>
                  <td className="border px-2 py-1.5 font-medium text-xs whitespace-nowrap">{i.contactName}</td>
                  <td className="border px-2 py-1.5 text-xs">{i.email || '-'}</td>
                  <td className="border px-2 py-1.5">
                    {i.languages && i.languages.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {i.languages.map((lang) => (
                          <span
                            key={lang}
                            className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    ) : i.language ? (
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                        {i.language}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="border px-2 py-1.5 text-xs">{i.country || '-'}</td>
                  <td className="border px-2 py-1.5 text-center font-mono text-xs">{i.cloudbreakId || '-'}</td>
                  <td className="border px-2 py-1.5 text-center font-mono text-xs">{i.languagelinkId || '-'}</td>
                  <td className="border px-2 py-1.5 text-center font-mono text-xs">{i.propioId || '-'}</td>
                  <td className="border px-2 py-1.5 text-center text-green-600 font-medium text-xs whitespace-nowrap">
                    {i.ratePerMinute && !isNaN(parseFloat(i.ratePerMinute)) ? `$${parseFloat(i.ratePerMinute).toFixed(2)}` : '-'}
                  </td>
                  <td className="border px-2 py-1.5 text-center text-green-600 font-medium text-xs whitespace-nowrap">
                    {i.ratePerHour && !isNaN(parseFloat(i.ratePerHour)) ? `$${parseFloat(i.ratePerHour).toFixed(2)}` : '-'}
                  </td>
                  <td className="border px-2 py-1.5">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => onEditInterpreter(i)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteInterpreter(i.id)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
