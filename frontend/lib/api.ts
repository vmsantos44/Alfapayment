// API client for Alfa Payment System

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper function for API calls
async function apiCall(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Interpreters
export const interpretersAPI = {
  getAll: () => apiCall('/api/interpreters'),

  create: (data: any) => apiCall('/api/interpreters', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => apiCall(`/api/interpreters/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiCall(`/api/interpreters/${id}`, {
    method: 'DELETE',
  }),

  bulkCreate: (interpreters: any[]) => apiCall('/api/interpreters/bulk', {
    method: 'POST',
    body: JSON.stringify(interpreters),
  }),

  syncFromZohoSheet: () => apiCall('/api/interpreters/sync-zoho-sheet', {
    method: 'POST',
  }),
};

// Clients
export const clientsAPI = {
  getAll: () => apiCall('/api/clients'),

  create: (data: any) => apiCall('/api/clients', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => apiCall(`/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiCall(`/api/clients/${id}`, {
    method: 'DELETE',
  }),
};

// Client Rates
export const clientRatesAPI = {
  getAll: (params?: { client_id?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/client-rates${query ? '?' + query : ''}`);
  },

  create: (data: any) => apiCall('/api/client-rates', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id: string, data: any) => apiCall(`/api/client-rates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiCall(`/api/client-rates/${id}`, {
    method: 'DELETE',
  }),
};

// Payments
export const paymentsAPI = {
  getAll: (params?: { client_id?: string; period?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/payments${query ? '?' + query : ''}`);
  },

  create: (data: any) => apiCall('/api/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  bulkCreate: (payments: any[]) => apiCall('/api/payments/bulk', {
    method: 'POST',
    body: JSON.stringify(payments),
  }),

  update: (id: string, data: any) => apiCall(`/api/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id: string) => apiCall(`/api/payments/${id}`, {
    method: 'DELETE',
  }),

  getStats: (params?: { client_id?: string; period?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/payments/stats/summary${query ? '?' + query : ''}`);
  },

  importPropioReport: async (file: File, period?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (period) {
      formData.append('period', period);
    }

    const response = await fetch(`${API_URL}/api/payments/import-propio-report`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Import failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },
};

// CSV Operations
export const csvAPI = {
  parse: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/api/parse-csv`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to parse CSV');
    }

    return response.json();
  },

  exportPayments: (params?: { client_id?: string; period?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/export-payments-csv${query ? '?' + query : ''}`);
  },
};

// Zoho Integration
export const zohoAPI = {
  getCandidates: (params?: {
    module?: string;
    onboarding_status?: string;
    language?: string;
    service_location?: string;
    limit?: number;
  }) => {
    // Filter out undefined/null values
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          cleanParams[key] = String(value);
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return apiCall(`/api/zoho/candidates${query ? '?' + query : ''}`);
  },

  importCandidates: (candidateIds: string[]) => apiCall('/api/zoho/import-selected', {
    method: 'POST',
    body: JSON.stringify({ candidate_ids: candidateIds }),
  }),
};

// Zoho Books Integration
export const zohoBooksAPI = {
  getChartOfAccounts: (accountType?: string) => {
    const query = accountType ? `?account_type=${accountType}` : '';
    return apiCall(`/api/zoho-books/chart-of-accounts${query}`);
  },

  getExpenseAccounts: (params?: { search?: string; limit?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/zoho-books/expense-accounts${query ? '?' + query : ''}`);
  },

  getVendors: () => apiCall('/api/zoho-books/vendors'),

  createVendor: (data: {
    contact_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    payment_terms?: number;
  }) => apiCall('/api/zoho-books/vendors', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getBills: (params?: { vendor_id?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/zoho-books/bills${query ? '?' + query : ''}`);
  },

  getBill: (billId: string) => apiCall(`/api/zoho-books/bills/${billId}`),

  createBill: (data: {
    vendor_id: string;
    line_items: any[];
    bill_number?: string;
    date?: string;
    due_date?: string;
    payment_terms?: number;
    notes?: string;
    reference_number?: string;
  }) => apiCall('/api/zoho-books/bills', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createBillFromPayment: (paymentId: string, accountId: string, autoGenerateBillNumber: boolean = true) =>
    apiCall(`/api/zoho-books/bills/from-payment/${paymentId}`, {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, auto_generate_bill_number: autoGenerateBillNumber }),
    }),

  createBillsFromPayments: (paymentIds: string[], accountId: string, autoGenerateBillNumber: boolean = true) =>
    apiCall('/api/zoho-books/bills/bulk-from-payments', {
      method: 'POST',
      body: JSON.stringify({ payment_ids: paymentIds, account_id: accountId, auto_generate_bill_number: autoGenerateBillNumber }),
    }),

  // Items
  getItems: (params?: { item_type?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/zoho-books/items${query ? '?' + query : ''}`);
  },

  getItem: (itemId: string) => apiCall(`/api/zoho-books/items/${itemId}`),

  createItem: (data: {
    name: string;
    rate: number;
    description?: string;
    account_id?: string;
    tax_id?: string;
    item_type?: string;
    product_type?: string;
    unit?: string;
    sku?: string;
  }) => apiCall('/api/zoho-books/items', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateItem: (itemId: string, data: any) => apiCall(`/api/zoho-books/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteItem: (itemId: string) => apiCall(`/api/zoho-books/items/${itemId}`, {
    method: 'DELETE',
  }),

  markItemActive: (itemId: string) => apiCall(`/api/zoho-books/items/${itemId}/active`, {
    method: 'POST',
  }),

  markItemInactive: (itemId: string) => apiCall(`/api/zoho-books/items/${itemId}/inactive`, {
    method: 'POST',
  }),

  // Organizations
  getOrganizations: () => apiCall('/api/zoho-books/organizations'),

  // Items Sync
  fetchItemsForSync: (params?: { organization_id?: string; status?: string; search?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiCall(`/api/zoho-books/items/fetch-for-sync${query ? '?' + query : ''}`);
  },

  syncItemsToRates: (items: Array<{
    item_id: string;
    client_id: string;
    language: string;
    service_type: string;
    service_location?: string;
    rate_amount: number;
    purchase_amount?: number;
    unit_type?: string;
    notes?: string;
    expense_account_id?: string;
    expense_account_name?: string;
  }>) => apiCall('/api/zoho-books/items/sync-to-rates', {
    method: 'POST',
    body: JSON.stringify(items),
  }),
};
