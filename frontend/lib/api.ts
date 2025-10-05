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
