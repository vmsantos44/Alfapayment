import React, { useState, useEffect } from 'react';
import { zohoBooksAPI, clientsAPI } from '@/lib/api';
import { RefreshCw, Download, CheckCircle2, XCircle, Info, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { COMMON_LANGUAGES } from '@/lib/constants';

interface ZohoItem {
  item_id: string;
  item_name: string;
  description: string;
  rate: number;
  purchase_rate: number;
  unit: string;
  status: string;
  account_id: string;
  account_name: string;
  sku: string;
  item_type: string;
  already_imported: boolean;
  suggested_client_id?: string;
  suggested_language?: string;
  suggested_service_type?: string;
  suggested_service_location?: string;
  suggested_expense_account_id?: string;
  suggested_expense_account_name?: string;
}

interface Client {
  id: string;
  name: string;
}

interface ItemMapping {
  [itemId: string]: {
    client_id: string;
    language: string;
    service_type: string;
    service_location: string;
    unit_type: string;
    notes: string;
    expense_account_id: string;
    expense_account_name: string;
  };
}

interface SessionDefaults {
  client_id: string;
  service_type: string;
  service_location: string;
  unit_type: string;
}

export function ItemsSyncTab() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<string>('');
  const [items, setItems] = useState<ZohoItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemMappings, setItemMappings] = useState<ItemMapping>({});
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  // Session Defaults and Bulk Edit state
  const [showDefaults, setShowDefaults] = useState(true);
  const [sessionDefaults, setSessionDefaults] = useState<SessionDefaults>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('itemSyncDefaults');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { client_id: '', service_type: 'OPI', service_location: 'Remote', unit_type: 'per_minute' };
      }
    }
    return { client_id: '', service_type: 'OPI', service_location: 'Remote', unit_type: 'per_minute' };
  });
  const [bulkEdit, setBulkEdit] = useState({
    client_id: '',
    language: '',
    service_type: '',
    service_location: '',
    unit_type: '',
    expense_account_id: '',
    expense_account_name: ''
  });

  // Save session defaults to localStorage when they change
  useEffect(() => {
    localStorage.setItem('itemSyncDefaults', JSON.stringify(sessionDefaults));
  }, [sessionDefaults]);

  // Load organizations, expense accounts, and clients on mount
  useEffect(() => {
    loadOrganizations();
    loadExpenseAccounts();
    loadClients();
  }, []);

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    setError('');
    try {
      const response = await zohoBooksAPI.getOrganizations();
      const orgs = response.organizations || [];
      setOrganizations(orgs);

      // Auto-select first organization if available
      if (orgs.length > 0) {
        setSelectedOrganization(orgs[0].organization_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadExpenseAccounts = async () => {
    setLoadingAccounts(true);
    try {
      // Load ALL expense accounts (no limit, no search) for dropdown
      const response = await zohoBooksAPI.getExpenseAccounts({ limit: 500 });
      const accounts = response.accounts || [];
      // Sort alphabetically by account name
      accounts.sort((a: any, b: any) =>
        (a.account_name || '').localeCompare(b.account_name || '')
      );
      setExpenseAccounts(accounts);
    } catch (err: any) {
      console.error('Error loading expense accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response || []);
    } catch (err: any) {
      console.error('Error loading clients:', err);
    }
  };

  const fetchItems = async () => {
    if (!selectedOrganization) {
      setError('Please select an organization first');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await zohoBooksAPI.fetchItemsForSync({
        organization_id: selectedOrganization,
        status: 'active',
        search
      });
      setItems(response.items || []);
      setClients(response.clients || []);

      // Initialize mappings with session defaults and suggested values
      const initialMappings: ItemMapping = {};
      response.items.forEach((item: ZohoItem) => {
        initialMappings[item.item_id] = {
          // Apply session defaults first, then suggested values if available
          client_id: item.suggested_client_id || sessionDefaults.client_id || (response.clients?.[0]?.id || ''),
          language: item.suggested_language || '',
          service_type: item.suggested_service_type || sessionDefaults.service_type || 'OPI',
          service_location: item.suggested_service_location || sessionDefaults.service_location || 'Remote',
          unit_type: sessionDefaults.unit_type || 'per_minute',
          notes: '',
          expense_account_id: item.suggested_expense_account_id || item.account_id || '',
          expense_account_name: item.suggested_expense_account_name || item.account_name || ''
        };
      });
      setItemMappings(initialMappings);

      // Clear selections when fetching new items to avoid stale references
      setSelectedItems(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  const syncItems = async () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to sync');
      return;
    }

    // Validate that all selected items have required fields
    let itemsToSync;
    try {
      itemsToSync = Array.from(selectedItems).map(itemId => {
        const item = items.find(i => i.item_id === itemId);
        const mapping = itemMappings[itemId];

        if (!item) {
          throw new Error(`Item with ID ${itemId} not found`);
        }

        if (!mapping) {
          throw new Error(`Mapping not found for item: ${item.item_name}`);
        }

        if (!mapping.client_id || !mapping.language || !mapping.service_type) {
          throw new Error(`Missing required fields for item: ${item.item_name}`);
        }

        return {
          item_id: itemId,
          client_id: mapping.client_id,
          language: mapping.language,
          service_type: mapping.service_type,
          service_location: mapping.service_location,
          rate_amount: item.rate || 0,
          purchase_amount: item.purchase_rate || 0,
          unit_type: mapping.unit_type,
          notes: mapping.notes,
          expense_account_id: mapping.expense_account_id,
          expense_account_name: mapping.expense_account_name
        };
      });
    } catch (err: any) {
      setError(err.message || 'Validation failed');
      return;
    }

    setSyncing(true);
    setError('');
    setResult(null);

    try {
      const response = await zohoBooksAPI.syncItemsToRates(itemsToSync);
      setResult(response);

      // Clear selections on success
      if (response.successful > 0) {
        setSelectedItems(new Set());
      }

      // Refresh items to update already_imported status
      await fetchItems();
    } catch (err: any) {
      setError(err.message || 'Failed to sync items');
    } finally {
      setSyncing(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.item_id)));
    }
  };

  const updateMapping = (itemId: string, field: string, value: string) => {
    setItemMappings(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const applyBulkEdit = () => {
    const newMappings = { ...itemMappings };
    selectedItems.forEach(itemId => {
      // Only update non-empty values from bulk edit
      if (bulkEdit.client_id) {
        newMappings[itemId].client_id = bulkEdit.client_id;
      }
      if (bulkEdit.language) {
        newMappings[itemId].language = bulkEdit.language;
      }
      if (bulkEdit.service_type) {
        newMappings[itemId].service_type = bulkEdit.service_type;
      }
      if (bulkEdit.service_location) {
        newMappings[itemId].service_location = bulkEdit.service_location;
      }
      if (bulkEdit.unit_type) {
        newMappings[itemId].unit_type = bulkEdit.unit_type;
      }
      if (bulkEdit.expense_account_id) {
        newMappings[itemId].expense_account_id = bulkEdit.expense_account_id;
        newMappings[itemId].expense_account_name = bulkEdit.expense_account_name;
      }
    });
    setItemMappings(newMappings);

    // Clear bulk edit form after applying
    setBulkEdit({
      client_id: '',
      language: '',
      service_type: '',
      service_location: '',
      unit_type: '',
      expense_account_id: '',
      expense_account_name: ''
    });
  };

  const filteredItems = items;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sync Zoho Books Items to Client Rates
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Import service items from Zoho Books and map them to client rates in your system
          </p>
        </div>

        <div className="space-y-4">
          {/* Organization Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Zoho Books Organization
            </label>
            <select
              value={selectedOrganization}
              onChange={(e) => setSelectedOrganization(e.target.value)}
              disabled={loadingOrgs || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {loadingOrgs ? 'Loading organizations...' : 'Select an organization'}
              </option>
              {organizations.map((org) => (
                <option key={org.organization_id} value={org.organization_id}>
                  {org.name} ({org.organization_id})
                </option>
              ))}
            </select>
            {organizations.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {organizations.length} organization{organizations.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>

          {/* Session Defaults Panel */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowDefaults(!showDefaults)}
              className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">Session Defaults</span>
                <span className="text-xs text-gray-500">(Auto-applied to all fetched items)</span>
              </div>
              {showDefaults ? <ChevronUp className="h-4 w-4 text-gray-600" /> : <ChevronDown className="h-4 w-4 text-gray-600" />}
            </button>

            {showDefaults && (
              <div className="p-4 bg-white grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Default Client</label>
                  <select
                    value={sessionDefaults.client_id}
                    onChange={(e) => setSessionDefaults({ ...sessionDefaults, client_id: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Default Service Type</label>
                  <select
                    value={sessionDefaults.service_type}
                    onChange={(e) => setSessionDefaults({ ...sessionDefaults, service_type: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="OPI">OPI</option>
                    <option value="VRI">VRI</option>
                    <option value="On-site">On-site</option>
                    <option value="Translation">Translation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Default Service Location</label>
                  <select
                    value={sessionDefaults.service_location}
                    onChange={(e) => setSessionDefaults({ ...sessionDefaults, service_location: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Default Unit Type</label>
                  <select
                    value={sessionDefaults.unit_type}
                    onChange={(e) => setSessionDefaults({ ...sessionDefaults, unit_type: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="per_minute">Per Minute</option>
                    <option value="per_hour">Per Hour</option>
                    <option value="per_word">Per Word</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Search and Fetch */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!selectedOrganization}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={fetchItems}
              disabled={loading || !selectedOrganization}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Fetch Items
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          {items.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={syncItems}
                disabled={syncing || selectedItems.size === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Sync Selected ({selectedItems.size})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Bulk Edit Panel */}
          {selectedItems.size > 1 && (
            <div className="border-2 border-purple-200 rounded-lg bg-purple-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">
                  Bulk Edit ({selectedItems.size} items selected)
                </h3>
              </div>
              <p className="text-sm text-purple-700 mb-4">
                Set values below and click "Apply" to update all selected items at once. Leave fields empty to keep existing values.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                  <select
                    value={bulkEdit.client_id}
                    onChange={(e) => setBulkEdit({ ...bulkEdit, client_id: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Keep existing</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
                  <select
                    value={bulkEdit.language}
                    onChange={(e) => setBulkEdit({ ...bulkEdit, language: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Keep existing</option>
                    {COMMON_LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Type</label>
                  <select
                    value={bulkEdit.service_type}
                    onChange={(e) => setBulkEdit({ ...bulkEdit, service_type: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Keep existing</option>
                    <option value="OPI">OPI</option>
                    <option value="VRI">VRI</option>
                    <option value="On-site">On-site</option>
                    <option value="Translation">Translation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Location</label>
                  <select
                    value={bulkEdit.service_location}
                    onChange={(e) => setBulkEdit({ ...bulkEdit, service_location: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Keep existing</option>
                    <option value="Remote">Remote</option>
                    <option value="On-site">On-site</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit Type</label>
                  <select
                    value={bulkEdit.unit_type}
                    onChange={(e) => setBulkEdit({ ...bulkEdit, unit_type: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Keep existing</option>
                    <option value="per_minute">Per Minute</option>
                    <option value="per_hour">Per Hour</option>
                    <option value="per_word">Per Word</option>
                    <option value="flat_rate">Flat Rate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Expense Account</label>
                  <select
                    value={bulkEdit.expense_account_id}
                    onChange={(e) => {
                      const selectedAccount = expenseAccounts.find(
                        acc => acc.account_id === e.target.value
                      );
                      setBulkEdit({
                        ...bulkEdit,
                        expense_account_id: e.target.value,
                        expense_account_name: selectedAccount?.account_name || ''
                      });
                    }}
                    disabled={loadingAccounts}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  >
                    <option value="">Keep existing</option>
                    {expenseAccounts.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={applyBulkEdit}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 font-medium transition-colors"
              >
                Apply to Selected ({selectedItems.size} items)
              </button>
            </div>
          )}

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
                    Successfully synced {result.successful} of {result.successful + result.failed} items
                  </p>
                  <p className="text-sm text-gray-700">
                    Created: {result.created} | Updated: {result.updated}
                  </p>
                  {result.failed > 0 && (
                    <div className="text-sm">
                      <p className="font-medium text-red-700">Failed: {result.failed}</p>
                      <ul className="list-disc list-inside mt-1 text-gray-600">
                        {result.errors?.map((err: any, idx: number) => (
                          <li key={idx}>
                            Item {err.item_id}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          {items.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium">Total Items: {items.length}</p>
                <p>Already Imported: {items.filter(i => i.already_imported).length}</p>
                <p>Selected: {selectedItems.size}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Item Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Purchase Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Language
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Service Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Unit Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expense Account
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr
                    key={item.item_id}
                    className={`${
                      selectedItems.has(item.item_id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                    } ${item.already_imported ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.item_id)}
                        onChange={() => toggleItemSelection(item.item_id)}
                        disabled={item.already_imported}
                        className="h-4 w-4 text-blue-600 rounded cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.item_name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500">{item.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-900">${item.rate.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-900">${item.purchase_rate.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.client_id || ''}
                        onChange={(e) => updateMapping(item.item_id, 'client_id', e.target.value)}
                        disabled={item.already_imported}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="">Select Client</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.language || ''}
                        onChange={(e) => updateMapping(item.item_id, 'language', e.target.value)}
                        disabled={item.already_imported}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="">Select Language</option>
                        {COMMON_LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.service_type || 'OPI'}
                        onChange={(e) => updateMapping(item.item_id, 'service_type', e.target.value)}
                        disabled={item.already_imported}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="OPI">OPI</option>
                        <option value="VRI">VRI</option>
                        <option value="On-site">On-site</option>
                        <option value="Translation">Translation</option>
                        <option value="Other">Other</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.service_location || 'Remote'}
                        onChange={(e) => updateMapping(item.item_id, 'service_location', e.target.value)}
                        disabled={item.already_imported}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="Remote">Remote</option>
                        <option value="On-site">On-site</option>
                        <option value="Both">Both</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.unit_type || 'per_minute'}
                        onChange={(e) => updateMapping(item.item_id, 'unit_type', e.target.value)}
                        disabled={item.already_imported}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="per_minute">Per Minute</option>
                        <option value="per_hour">Per Hour</option>
                        <option value="per_word">Per Word</option>
                        <option value="flat_rate">Flat Rate</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={itemMappings[item.item_id]?.expense_account_id || ''}
                        onChange={(e) => {
                          const selectedAccount = expenseAccounts.find(
                            acc => acc.account_id === e.target.value
                          );
                          updateMapping(item.item_id, 'expense_account_id', e.target.value);
                          updateMapping(item.item_id, 'expense_account_name', selectedAccount?.account_name || '');
                        }}
                        disabled={item.already_imported || loadingAccounts}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-100"
                      >
                        <option value="">
                          {loadingAccounts ? 'Loading accounts...' : 'Select expense account...'}
                        </option>
                        {expenseAccounts.map((account) => (
                          <option key={account.account_id} value={account.account_id}>
                            {account.account_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.already_imported ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                          ✓ Imported
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

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
          <p className="mb-2">No items loaded yet</p>
          <p className="text-sm">Click "Fetch Items" to load items from Zoho Books</p>
        </div>
      )}
    </div>
  );
}
