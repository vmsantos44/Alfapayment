import { useState, useEffect } from 'react';
import { zohoBooksAPI } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, DollarSign, FileText, RefreshCw } from 'lucide-react';

interface ZohoBooksTabProps {
  payments: any[];
}

export function ZohoBooksTab({ payments }: ZohoBooksTabProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchAccount, setSearchAccount] = useState<string>('');
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Load expense accounts on mount
  useEffect(() => {
    loadExpenseAccounts();
  }, []);

  const loadExpenseAccounts = async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const response = await zohoBooksAPI.getExpenseAccounts();
      setAccounts(response.accounts || []);

      // Auto-select first account if available
      if (response.accounts && response.accounts.length > 0) {
        setSelectedAccount(response.accounts[0].account_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load expense accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const togglePaymentSelection = (paymentId: string) => {
    const newSelection = new Set(selectedPayments);
    if (newSelection.has(paymentId)) {
      newSelection.delete(paymentId);
    } else {
      newSelection.add(paymentId);
    }
    setSelectedPayments(newSelection);
  };

  const selectAllPayments = () => {
    if (selectedPayments.size === payments.length) {
      setSelectedPayments(new Set());
    } else {
      setSelectedPayments(new Set(payments.map(p => p.id)));
    }
  };

  const createBills = async () => {
    if (!selectedAccount) {
      setError('Please select an expense account');
      return;
    }

    if (selectedPayments.size === 0) {
      setError('Please select at least one payment');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const paymentIds = Array.from(selectedPayments);
      const response = await zohoBooksAPI.createBillsFromPayments(
        paymentIds,
        selectedAccount,
        true // auto-generate bill numbers
      );

      setResult(response);

      // Clear selections on success
      if (response.successful > 0) {
        setSelectedPayments(new Set());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create bills');
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => p.status === 'approved');

  // Filter accounts based on search
  const filteredAccounts = accounts.filter(account => {
    if (!searchAccount) return true;
    const searchLower = searchAccount.toLowerCase();
    return (
      account.account_name?.toLowerCase().includes(searchLower) ||
      account.account_code?.toLowerCase().includes(searchLower) ||
      account.description?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Export to Zoho Books
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Create vendor bills in Zoho Books from approved payments
          </p>
        </div>

        <div className="space-y-4">
          {/* Expense Account Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Expense Account
            </label>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Search accounts by name, code, or description..."
              value={searchAccount}
              onChange={(e) => setSearchAccount(e.target.value)}
              disabled={loadingAccounts || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />

            {/* Account Dropdown */}
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              disabled={loadingAccounts || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingAccounts ? "Loading accounts..." : "Select expense account"}
              </option>
              {filteredAccounts.map((account) => (
                <option key={account.account_id} value={account.account_id}>
                  {account.account_name}
                  {account.account_code ? ` [${account.account_code}]` : ''}
                  {account.description ? ` - ${account.description}` : ''}
                </option>
              ))}
            </select>

            <p className="text-xs text-gray-500">
              Showing {filteredAccounts.length} of {accounts.length} expense accounts
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={selectAllPayments}
              disabled={loading || filteredPayments.length === 0}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {selectedPayments.size === filteredPayments.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={createBills}
              disabled={loading || selectedPayments.size === 0 || !selectedAccount}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Bills ({selectedPayments.size})
            </button>
            <button
              onClick={loadExpenseAccounts}
              disabled={loadingAccounts || loading}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingAccounts ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="font-medium text-green-900">
                    Successfully created {result.successful} of {result.total} bills
                  </p>
                  {result.failed > 0 && (
                    <div className="text-sm">
                      <p className="font-medium text-red-700">Failed: {result.failed}</p>
                      <ul className="list-disc list-inside mt-1 text-gray-600">
                        {result.errors?.map((err: any, idx: number) => (
                          <li key={idx}>
                            Payment {err.payment_id}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Approved Payments ({filteredPayments.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Select payments to create bills in Zoho Books
          </p>
        </div>
        <div className="p-6">
          {filteredPayments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No approved payments available
            </p>
          ) : (
            <div className="space-y-2">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedPayments.has(payment.id)
                      ? 'bg-blue-50 border-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => togglePaymentSelection(payment.id)}
                >
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedPayments.has(payment.id)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{payment.interpreter_name}</p>
                      <p className="text-sm text-gray-600">
                        {payment.employee_id} | {payment.client_name} | {payment.period}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${payment.total_amount?.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">
                      {payment.total_hours?.toFixed(2)}h @ ${payment.rate_per_hour}/h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
