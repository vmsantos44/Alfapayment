import React from 'react';
import { Download, CheckCircle, XCircle } from 'lucide-react';
import { Payment } from '@/lib/types';

interface ReviewTabProps {
  reviewPayments: Payment[];
  filteredPayments: Payment[];
  uniqueClients: string[];
  uniqueLanguages: string[];
  uniquePeriods: string[];
  filterClient: string;
  filterStatus: string;
  filterMatchStatus: string;
  filterLanguage: string;
  filterPeriod: string;
  filterStartDate: string;
  filterEndDate: string;
  searchText: string;
  totalStats: any;
  onFilterChange: (filter: string, value: string) => void;
  onClearFilters: () => void;
  onApproveAll: () => void;
  onApprove: (index: number) => void;
  onReject: (index: number) => void;
  onAdjustment: (index: number) => void;
  onExportCSV: () => void;
  onExportZohoBooks: () => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({
  reviewPayments,
  filteredPayments,
  uniqueClients,
  uniqueLanguages,
  uniquePeriods,
  filterClient,
  filterStatus,
  filterMatchStatus,
  filterLanguage,
  filterPeriod,
  filterStartDate,
  filterEndDate,
  searchText,
  totalStats,
  onFilterChange,
  onClearFilters,
  onApproveAll,
  onApprove,
  onReject,
  onAdjustment,
  onExportCSV,
  onExportZohoBooks
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">
          Review & Approve
          <span className="text-lg ml-2 text-gray-600">
            (Showing {filteredPayments.length} of {reviewPayments.length} payments)
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onApproveAll}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Approve All Matched
          </button>
          <button
            onClick={onExportCSV}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <Download size={20} />
            Export CSV
          </button>
          <button
            onClick={onExportZohoBooks}
            className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            <Download size={20} />
            Zoho Books Excel
          </button>
        </div>
      </div>

      {reviewPayments.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No payments to review. Upload a client report in the Import tab to get started.</p>
      ) : (
        <>
          {/* Filters */}
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-7 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                <select
                  value={filterClient}
                  onChange={(e) => onFilterChange('client', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="all">All Clients</option>
                  {uniqueClients.map(client => (
                    <option key={client} value={client}>{client}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => onFilterChange('status', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Match Status</label>
                <select
                  value={filterMatchStatus}
                  onChange={(e) => onFilterChange('matchStatus', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                >
                  <option value="all">All</option>
                  <option value="matched">Matched</option>
                  <option value="unmatched">Unmatched</option>
                  <option value="no_interpreter_rate">No Rate</option>
                </select>
              </div>

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
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => onFilterChange('startDate', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => onFilterChange('endDate', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search Interpreter</label>
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => onFilterChange('search', e.target.value)}
                  placeholder="Search name..."
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

          {(totalStats.unmatched > 0 || totalStats.noInterpreterRate > 0) && (
            <div className="space-y-2 mb-4">
              {totalStats.unmatched > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <p className="text-red-800">
                    ⚠️ <strong>{totalStats.unmatched}</strong> interpreter(s) not found in your database
                  </p>
                </div>
              )}
              {totalStats.noInterpreterRate > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <p className="text-yellow-800">
                    ⚠️ <strong>{totalStats.noInterpreterRate}</strong> interpreter(s) found but no payment rate set
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-2 text-left">Client</th>
                  <th className="border px-4 py-2 text-left">Interpreter</th>
                  <th className="border px-4 py-2 text-left">Language</th>
                  <th className="border px-4 py-2 text-right">Time</th>
                  <th className="border px-4 py-2 text-right">Client Rate</th>
                  <th className="border px-4 py-2 text-right">Client $</th>
                  <th className="border px-4 py-2 text-right">Interpreter $</th>
                  <th className="border px-4 py-2 text-right">Profit</th>
                  <th className="border px-4 py-2 text-center">Status</th>
                  <th className="border px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, i) => (
                  <tr key={i} className={
                    p.matchStatus === 'unmatched' ? 'bg-red-50' :
                    p.matchStatus === 'no_interpreter_rate' ? 'bg-yellow-50' :
                    p.status === 'approved' ? 'bg-green-50' : ''
                  }>
                    <td className="border px-4 py-2">{p.clientName}</td>
                    <td className="border px-4 py-2">
                      <div className="font-medium">{p.internalInterpreterName}</div>
                      <div className="text-xs text-gray-500">{p.interpreterName}</div>
                    </td>
                    <td className="border px-4 py-2">{p.languagePair}</td>
                    <td className="border px-4 py-2 text-right">
                      {p.minutes ? `${p.minutes}m` : `${p.hours}h`}
                    </td>
                    <td className="border px-4 py-2 text-right text-blue-600">${p.clientRate}</td>
                    <td className="border px-4 py-2 text-right">${p.clientCharge}</td>
                    <td className="border px-4 py-2 text-right">${p.interpreterPayment}</td>
                    <td className="border px-4 py-2 text-right font-bold text-green-600">${p.profit}</td>
                    <td className="border px-4 py-2 text-center">
                      {p.matchStatus === 'unmatched' ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-red-200 text-red-800">
                          NOT FOUND
                        </span>
                      ) : p.matchStatus === 'no_interpreter_rate' ? (
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-200 text-yellow-800">
                          NO RATE
                        </span>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          p.status === 'approved' ? 'bg-green-200 text-green-800' :
                          'bg-yellow-200 text-yellow-800'
                        }`}>
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td className="border px-4 py-2">
                      {p.matchStatus === 'matched' && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => onApprove(i)}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => onReject(i)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <XCircle size={18} />
                          </button>
                          <button
                            onClick={() => onAdjustment(i)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded text-xs px-2"
                          >
                            Adj
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
