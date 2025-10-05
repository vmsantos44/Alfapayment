import React from 'react';
import { Payment } from '@/lib/types';

interface AnalyticsTabProps {
  filteredPayments: Payment[];
  uniqueClients: string[];
  uniqueLanguages: string[];
  filterClient: string;
  filterLanguage: string;
  filterStartDate: string;
  filterEndDate: string;
  filterStatus: string;
  searchText: string;
  totalStats: any;
  onFilterChange: (filter: string, value: string) => void;
  onClearFilters: () => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({
  filteredPayments,
  uniqueClients,
  uniqueLanguages,
  filterClient,
  filterLanguage,
  filterStartDate,
  filterEndDate,
  filterStatus,
  searchText,
  totalStats,
  onFilterChange,
  onClearFilters
}) => {
  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-6 gap-3 mb-3">
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

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-blue-600">${totalStats.totalRevenue.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm mb-1">Total Payments</div>
          <div className="text-2xl font-bold text-orange-600">${totalStats.totalPayments.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm mb-1">Total Profit</div>
          <div className="text-2xl font-bold text-green-600">${totalStats.totalProfit.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-500 text-sm mb-1">Margin</div>
          <div className="text-2xl font-bold text-purple-600">
            {totalStats.totalRevenue > 0 ? ((totalStats.totalProfit / totalStats.totalRevenue) * 100).toFixed(1) : 0}%
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">
          Performance by Payment
          <span className="text-sm ml-2 text-gray-600">
            (Showing {filteredPayments.filter(p => p.matchStatus === 'matched').length} matched payments)
          </span>
        </h3>
        {filteredPayments.filter(p => p.matchStatus === 'matched').length === 0 ? (
          <p className="text-gray-500 text-center py-8">No data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-2 text-left">Interpreter</th>
                  <th className="border px-4 py-2 text-left">Client</th>
                  <th className="border px-4 py-2 text-left">Language</th>
                  <th className="border px-4 py-2 text-right">Revenue</th>
                  <th className="border px-4 py-2 text-right">Payment</th>
                  <th className="border px-4 py-2 text-right">Profit</th>
                  <th className="border px-4 py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.filter(p => p.matchStatus === 'matched').map((p, i) => (
                  <tr key={i}>
                    <td className="border px-4 py-2 font-medium">{p.internalInterpreterName}</td>
                    <td className="border px-4 py-2">{p.clientName}</td>
                    <td className="border px-4 py-2">{p.languagePair}</td>
                    <td className="border px-4 py-2 text-right">${p.clientCharge}</td>
                    <td className="border px-4 py-2 text-right">${p.interpreterPayment}</td>
                    <td className="border px-4 py-2 text-right text-green-600 font-bold">${p.profit}</td>
                    <td className="border px-4 py-2 text-right">{p.profitMargin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
