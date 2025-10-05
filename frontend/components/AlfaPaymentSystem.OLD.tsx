'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, TrendingUp, CheckCircle, XCircle, Download, Users, Building2, Plus, Edit, Trash2 } from 'lucide-react';
import Papa from 'papaparse';
import { interpretersAPI, clientsAPI, clientRatesAPI, paymentsAPI, csvAPI } from '@/lib/api';

// Types
interface Interpreter {
  id: string;
  recordId?: string;
  lastName?: string;
  employeeId?: string;
  cloudbreakId?: string;
  languagelinkId?: string;
  propioId?: string;
  contactName: string;
  email?: string;
  language?: string;
  paymentFrequency?: string;
  serviceLocation?: string;
  ratePerMinute?: string;
  ratePerHour?: string;
}

interface Client {
  id: string;
  name: string;
  idField: string;
  columnTemplate?: Record<string, string>;
}

interface ClientRate {
  id: string;
  clientId: string;
  language: string;
  serviceLocation?: string;
  ratePerMinute?: number;
  ratePerHour?: number;
  rateType: 'minute' | 'hour';
  createdAt?: string;
  updatedAt?: string;
}

interface Payment {
  clientName: string;
  clientInterpreterID: string;
  interpreterName: string;
  internalInterpreterName: string;
  internalInterpreterId: string | null;
  languagePair: string;
  period: string;
  clientRate: string;
  minutes: number;
  hours: number;
  clientCharge: string;
  interpreterPayment: string;
  profit: string;
  profitMargin: string;
  status: 'pending' | 'approved' | 'rejected';
  matchStatus: 'matched' | 'unmatched' | 'no_interpreter_rate';
  adjustment: number;
  notes: string;
}

// Common Languages List
const COMMON_LANGUAGES = [
  'Spanish',
  'Mandarin',
  'Cantonese',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Arabic',
  'Russian',
  'Japanese',
  'Korean',
  'Vietnamese',
  'Tagalog',
  'Polish',
  'Hindi',
  'Bengali',
  'Urdu',
  'Persian',
  'Turkish',
  'Greek',
  'Hebrew',
  'Thai',
  'Dutch',
  'Swedish',
  'Haitian Creole',
  'American Sign Language (ASL)',
  'Somali',
  'Punjabi',
  'Romanian',
  'Ukrainian',
  'Albanian',
  'Bosnian',
  'Serbian',
  'Croatian',
  'Swahili',
  'Amharic',
  'Tigrinya',
  'Nepali',
  'Burmese',
  'Khmer',
  'Laotian',
  'Farsi',
  'Pashto',
  'Dari'
].sort();

// Modal Components (moved outside to prevent re-rendering issues)
const InterpreterModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Interpreter>) => void;
  editingItem: Interpreter | null;
}> = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState<Partial<Interpreter>>({
    recordId: '', lastName: '', employeeId: '', cloudbreakId: '',
    languagelinkId: '', propioId: '', contactName: '', email: '',
    language: '', paymentFrequency: '', serviceLocation: '',
    ratePerMinute: '', ratePerHour: ''
  });

  // Update form data when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
    } else {
      setFormData({
        recordId: '', lastName: '', employeeId: '', cloudbreakId: '',
        languagelinkId: '', propioId: '', contactName: '', email: '',
        language: '', paymentFrequency: '', serviceLocation: '',
        ratePerMinute: '', ratePerHour: ''
      });
    }
  }, [editingItem]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
        <h3 className="text-xl font-bold mb-4">
          {editingItem ? 'Edit Interpreter' : 'Add Interpreter'}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Contact Name *</label>
            <input
              type="text"
              value={formData.contactName || ''}
              onChange={(e) => setFormData({...formData, contactName: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Last Name</label>
            <input
              type="text"
              value={formData.lastName || ''}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Record ID (CRM)</label>
            <input
              type="text"
              value={formData.recordId || ''}
              onChange={(e) => setFormData({...formData, recordId: e.target.value})}
              className="w-full border rounded px-3 py-2 bg-gray-50"
              placeholder="zcrm_..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Employee ID</label>
            <input
              type="text"
              value={formData.employeeId || ''}
              onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Language(s)</label>
            <input
              type="text"
              list="interpreter-language-options"
              value={formData.language || ''}
              onChange={(e) => setFormData({...formData, language: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="Type to search languages..."
            />
            <datalist id="interpreter-language-options">
              {COMMON_LANGUAGES.map(lang => (
                <option key={lang} value={lang} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Payment Frequency</label>
            <select
              value={formData.paymentFrequency || ''}
              onChange={(e) => setFormData({...formData, paymentFrequency: e.target.value})}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">-- Select --</option>
              <option value="Weekly">Weekly</option>
              <option value="Bi-weekly">Bi-weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Cloudbreak ID</label>
            <input
              type="text"
              value={formData.cloudbreakId || ''}
              onChange={(e) => setFormData({...formData, cloudbreakId: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Languagelink ID</label>
            <input
              type="text"
              value={formData.languagelinkId || ''}
              onChange={(e) => setFormData({...formData, languagelinkId: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Propio ID</label>
            <input
              type="text"
              value={formData.propioId || ''}
              onChange={(e) => setFormData({...formData, propioId: e.target.value})}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Service Location</label>
            <select
              value={formData.serviceLocation || ''}
              onChange={(e) => setFormData({...formData, serviceLocation: e.target.value})}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">-- Select --</option>
              <option value="On-site">On-site</option>
              <option value="Remote">Remote</option>
              <option value="Both">Both</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Rate Per Minute ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.ratePerMinute || ''}
              onChange={(e) => setFormData({...formData, ratePerMinute: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="0.35"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Rate Per Hour ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.ratePerHour || ''}
              onChange={(e) => setFormData({...formData, ratePerHour: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="20.00"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => {
              if (!formData.contactName) {
                alert('Contact Name is required!');
                return;
              }
              onSave(formData);
            }}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {editingItem ? 'Update' : 'Add'} Interpreter
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string }) => void;
  editingItem: Client | null;
}> = ({ isOpen, onClose, onSave, editingItem }) => {
  const [formData, setFormData] = useState({ name: editingItem?.name || '' });
  const [clientRates, setClientRates] = useState<ClientRate[]>([]);
  const [newRate, setNewRate] = useState({ language: '', serviceLocation: '', ratePerMinute: '', ratePerHour: '', rateType: 'minute' });
  const [loadingRates, setLoadingRates] = useState(false);

  // Load client rates when editing
  useEffect(() => {
    if (isOpen && editingItem) {
      loadClientRates();
      setFormData({ name: editingItem.name });
    } else if (isOpen && !editingItem) {
      setFormData({ name: '' });
      setClientRates([]);
    }
  }, [isOpen, editingItem]);

  const loadClientRates = async () => {
    if (!editingItem?.id) return;
    try {
      setLoadingRates(true);
      const rates = await clientRatesAPI.getAll({ client_id: editingItem.id });
      setClientRates(rates);
    } catch (error) {
      console.error('Error loading client rates:', error);
    } finally {
      setLoadingRates(false);
    }
  };

  const handleAddRate = async () => {
    if (!newRate.language) {
      alert('Language is required!');
      return;
    }

    if (!newRate.ratePerMinute && !newRate.ratePerHour) {
      alert('Please provide at least one rate (per minute or per hour)!');
      return;
    }

    if (!editingItem?.id) {
      // If creating a new client, store rates temporarily
      const tempRate: ClientRate = {
        id: `temp-${Date.now()}`,
        clientId: '',
        language: newRate.language,
        serviceLocation: newRate.serviceLocation || undefined,
        ratePerMinute: newRate.ratePerMinute ? parseFloat(newRate.ratePerMinute) : undefined,
        ratePerHour: newRate.ratePerHour ? parseFloat(newRate.ratePerHour) : undefined,
        rateType: newRate.rateType as 'minute' | 'hour',
      };
      setClientRates([...clientRates, tempRate]);
      setNewRate({ language: '', serviceLocation: '', ratePerMinute: '', ratePerHour: '', rateType: 'minute' });
      return;
    }

    // If editing existing client, save to backend
    try {
      const rateData = {
        clientId: editingItem.id,
        language: newRate.language,
        serviceLocation: newRate.serviceLocation || undefined,
        ratePerMinute: newRate.ratePerMinute ? parseFloat(newRate.ratePerMinute) : undefined,
        ratePerHour: newRate.ratePerHour ? parseFloat(newRate.ratePerHour) : undefined,
        rateType: newRate.rateType,
      };
      const created = await clientRatesAPI.create(rateData);
      setClientRates([...clientRates, created]);
      setNewRate({ language: '', serviceLocation: '', ratePerMinute: '', ratePerHour: '', rateType: 'minute' });
    } catch (error) {
      console.error('Error creating rate:', error);
      alert('Failed to add rate');
    }
  };

  const handleDeleteRate = async (rateId: string) => {
    if (rateId.startsWith('temp-')) {
      // Remove from temporary list
      setClientRates(clientRates.filter(r => r.id !== rateId));
      return;
    }

    try {
      await clientRatesAPI.delete(rateId);
      setClientRates(clientRates.filter(r => r.id !== rateId));
    } catch (error) {
      console.error('Error deleting rate:', error);
      alert('Failed to delete rate');
    }
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert('Client name is required!');
      return;
    }

    // If creating a new client with temp rates, we need to save client first, then rates
    if (!editingItem && clientRates.length > 0) {
      // Pass the rates along with the client data
      onSave({ name: formData.name, rates: clientRates } as any);
    } else {
      onSave(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
        <h3 className="text-xl font-bold mb-4">
          {editingItem ? 'Edit Client' : 'Add Client'}
        </h3>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Client Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full border rounded px-3 py-2"
            placeholder="ABC Company"
          />
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">Language Rates</h4>

          {/* Existing Rates */}
          {loadingRates ? (
            <div className="text-gray-500 text-sm mb-4">Loading rates...</div>
          ) : clientRates.length > 0 ? (
            <div className="mb-4 space-y-2">
              {clientRates.map((rate) => (
                <div key={rate.id} className="flex items-center gap-2 p-2 border rounded bg-gray-50">
                  <div className="flex-1">
                    <span className="font-medium">{rate.language}</span>
                    {rate.serviceLocation && (
                      <span className="text-blue-600 text-xs ml-2 px-2 py-0.5 bg-blue-100 rounded">
                        {rate.serviceLocation}
                      </span>
                    )}
                    <span className="text-gray-600 text-sm ml-2">
                      {rate.ratePerMinute && `$${rate.ratePerMinute}/min`}
                      {rate.ratePerMinute && rate.ratePerHour && ' | '}
                      {rate.ratePerHour && `$${rate.ratePerHour}/hr`}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteRate(rate.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm mb-4">No rates added yet</div>
          )}

          {/* Add New Rate */}
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="text-sm font-medium mb-2">Add New Rate</div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label className="block text-xs mb-1">Language *</label>
                <input
                  type="text"
                  list="language-options"
                  value={newRate.language}
                  onChange={(e) => setNewRate({...newRate, language: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="Type to search..."
                />
                <datalist id="language-options">
                  {COMMON_LANGUAGES.map(lang => (
                    <option key={lang} value={lang} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs mb-1">Service Location</label>
                <select
                  value={newRate.serviceLocation}
                  onChange={(e) => setNewRate({...newRate, serviceLocation: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">-- Select --</option>
                  <option value="On-site">On-site</option>
                  <option value="Remote">Remote</option>
                  <option value="Both">Both</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">Rate Type</label>
                <select
                  value={newRate.rateType}
                  onChange={(e) => setNewRate({...newRate, rateType: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="minute">Per Minute</option>
                  <option value="hour">Per Hour</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-xs mb-1">Rate per Minute ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRate.ratePerMinute}
                  onChange={(e) => setNewRate({...newRate, ratePerMinute: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Rate per Hour ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRate.ratePerHour}
                  onChange={(e) => setNewRate({...newRate, ratePerHour: e.target.value})}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button
              onClick={handleAddRate}
              className="w-full bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              + Add Rate
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {editingItem ? 'Update' : 'Add'} Client
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Component
const AlfaPaymentSystem = () => {
  const [activeTab, setActiveTab] = useState('interpreters');

  // Core Data
  const [interpreters, setInterpreters] = useState<Interpreter[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Import Process
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importedData, setImportedData] = useState<any[]>([]);
  const [calculatedPayments, setCalculatedPayments] = useState<Payment[]>([]);

  // Database Payments (for Review tab)
  const [dbPayments, setDbPayments] = useState<any[]>([]);

  // Filter States
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMatchStatus, setFilterMatchStatus] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Transform database payments to Payment interface format
  const transformDbPayment = (p: any): Payment => {
    const client = clients.find(c => c.id === p.client_id);
    return {
      clientName: client?.name || p.client_id,
      clientInterpreterID: p.client_interpreter_id,
      interpreterName: p.interpreter_name,
      internalInterpreterName: p.internal_interpreter_name,
      internalInterpreterId: p.interpreter_id,
      languagePair: p.language_pair || '',
      period: p.period,
      clientRate: String(p.client_rate),
      minutes: p.minutes,
      hours: p.hours,
      clientCharge: String(p.client_charge),
      interpreterPayment: String(p.interpreter_payment),
      profit: String(p.profit),
      profitMargin: String(p.profit_margin) + '%',
      status: p.status as 'pending' | 'approved' | 'rejected',
      matchStatus: p.match_status as 'matched' | 'unmatched' | 'no_interpreter_rate',
      adjustment: p.adjustment || 0,
      notes: p.notes || ''
    };
  };

  // Use calculatedPayments from import workflow, or dbPayments from database
  const reviewPayments = calculatedPayments.length > 0
    ? calculatedPayments
    : dbPayments.map(transformDbPayment);

  // Apply filters to payments
  const filteredPayments = reviewPayments.filter(payment => {
    // Client filter
    if (filterClient !== 'all' && payment.clientName !== filterClient) return false;

    // Status filter
    if (filterStatus !== 'all' && payment.status !== filterStatus) return false;

    // Match status filter
    if (filterMatchStatus !== 'all' && payment.matchStatus !== filterMatchStatus) return false;

    // Language filter
    if (filterLanguage !== 'all' && payment.languagePair !== filterLanguage) return false;

    // Period filter
    if (filterPeriod !== 'all' && payment.period !== filterPeriod) return false;

    // Date range filter (parse period as YYYY-MM format)
    if (filterStartDate || filterEndDate) {
      const periodDate = payment.period ? new Date(payment.period + '-01') : null;
      if (!periodDate) return false;

      if (filterStartDate) {
        const startDate = new Date(filterStartDate);
        if (periodDate < startDate) return false;
      }

      if (filterEndDate) {
        const endDate = new Date(filterEndDate);
        if (periodDate > endDate) return false;
      }
    }

    // Search text filter (interpreter name)
    if (searchText && !payment.internalInterpreterName.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Get unique values for filter dropdowns
  const uniqueClients = Array.from(new Set(reviewPayments.map(p => p.clientName))).sort();
  const uniqueLanguages = Array.from(new Set(reviewPayments.map(p => p.languagePair).filter(Boolean))).sort();
  const uniquePeriods = Array.from(new Set(reviewPayments.map(p => p.period))).sort();

  // Clear all filters
  const clearFilters = () => {
    setFilterClient('all');
    setFilterStatus('all');
    setFilterMatchStatus('all');
    setFilterLanguage('all');
    setFilterPeriod('all');
    setSearchText('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Modal States
  const [showInterpreterModal, setShowInterpreterModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Interpreter | Client | null>(null);

  // Load data from database on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [interpretersData, clientsData, paymentsData] = await Promise.all([
          interpretersAPI.getAll(),
          clientsAPI.getAll(),
          paymentsAPI.getAll(),
        ]);
        setInterpreters(interpretersData);
        setClients(clientsData);
        setDbPayments(paymentsData);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data from database');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Standard columns
  const standardColumns = {
    interpreterId: 'Interpreter ID (from client report)',
    interpreterName: 'Interpreter Name',
    minutes: 'Minutes Worked',
    hours: 'Hours Worked',
    date: 'Date/Period',
    languagePair: 'Language Pair',
    rate: 'Rate (from client report)'
  };

  // === INTERPRETER MANAGEMENT ===
  const saveInterpreter = async (data: Partial<Interpreter>) => {
    try {
      if (editingItem && 'contactName' in editingItem) {
        // Update existing
        const updated = await interpretersAPI.update(editingItem.id, data);
        setInterpreters(interpreters.map(i => i.id === editingItem.id ? updated : i));
      } else {
        // Create new
        const created = await interpretersAPI.create(data);
        setInterpreters([...interpreters, created]);
      }
      setShowInterpreterModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving interpreter:', error);
      alert('Failed to save interpreter');
    }
  };

  const deleteInterpreter = async (id: string) => {
    if (confirm('Delete this interpreter?')) {
      try {
        await interpretersAPI.delete(id);
        setInterpreters(interpreters.filter(i => i.id !== id));
      } catch (error) {
        console.error('Error deleting interpreter:', error);
        alert('Failed to delete interpreter');
      }
    }
  };

  const importInterpretersFromCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const imported = results.data.map((row: any) => ({
            record_id: row['Record Id'] || '',
            last_name: row['Last Name'] || '',
            employee_id: row['Employee ID'] || row['Emplyee ID'] || '',
            cloudbreak_id: row['Cloudbreak ID'] || '',
            languagelink_id: row['Languagelink ID'] || '',
            propio_id: row['Propio ID'] || '',
            contact_name: row['Contact Name'] || '',
            email: row['Email'] || '',
            language: row['Language'] || '',
            payment_frequency: row['Payment frequency'] || '',
            service_location: row['Service Location'] || '',
            rate_per_minute: row['Rate Per Minute'] || row['Rate/Min'] || '',
            rate_per_hour: row['Rate Per Hour'] || row['Rate per Hour'] || row['Rate/Hour'] || ''
          }));

          const result = await interpretersAPI.bulkCreate(imported);

          // Combine created and updated interpreters
          const allInterpreters = [...result.created, ...result.updated];

          // Update state with new/updated interpreters
          const existingIds = new Set(interpreters.map(i => i.id));
          const newInterpreters = allInterpreters.filter(i => !existingIds.has(i.id));
          const updatedInterpreters = interpreters.map(existing => {
            const updated = allInterpreters.find(i => i.id === existing.id);
            return updated || existing;
          });

          setInterpreters([...updatedInterpreters, ...newInterpreters]);

          // Show detailed summary
          const { summary } = result;
          let message = `Import complete!\n\n`;
          message += `• Created: ${summary.created} new interpreters\n`;
          message += `• Updated: ${summary.updated} existing interpreters\n`;
          message += `• Total processed: ${summary.total}`;

          alert(message);
        } catch (error) {
          console.error('Error importing interpreters:', error);
          alert('Failed to import interpreters');
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  // === CLIENT MANAGEMENT ===
  const saveClient = async (data: { name: string; rates?: ClientRate[] }) => {
    try {
      if (editingItem && 'idField' in editingItem) {
        // Update existing
        const updated = await clientsAPI.update(editingItem.id, { name: data.name });
        setClients(clients.map(c => c.id === editingItem.id ? updated : c));
      } else {
        // Create new client
        const idField = data.name.toLowerCase().replace(/\s+/g, '') + 'Id';
        const created = await clientsAPI.create({ name: data.name, id_field: idField });
        setClients([...clients, created]);

        // If there are temp rates, save them
        if (data.rates && data.rates.length > 0) {
          for (const rate of data.rates) {
            if (rate.id.startsWith('temp-')) {
              await clientRatesAPI.create({
                clientId: created.id,
                language: rate.language,
                ratePerMinute: rate.ratePerMinute,
                ratePerHour: rate.ratePerHour,
                rateType: rate.rateType,
              });
            }
          }
        }
      }
      setShowClientModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Failed to save client');
    }
  };

  const deleteClient = async (id: string) => {
    if (confirm('Delete this client?')) {
      try {
        await clientsAPI.delete(id);
        setClients(clients.filter(c => c.id !== id));
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Failed to delete client');
      }
    }
  };

  // === FILE IMPORT (FIXED) ===
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setImportedData(results.data);

        if (results.data.length > 0) {
          const detectedMapping: Record<string, string> = {};
          const firstRow = results.data[0] as Record<string, any>;

          Object.keys(firstRow).forEach(col => {
            const colLower = col.toLowerCase();
            if (colLower.includes('id')) detectedMapping.interpreterId = col;
            if (colLower.includes('name')) detectedMapping.interpreterName = col;
            if (colLower.includes('minute') && !colLower.includes('rate')) detectedMapping.minutes = col;
            if (colLower.includes('hour') && !colLower.includes('minute') && !colLower.includes('rate')) detectedMapping.hours = col;
            if (colLower.includes('date') || colLower.includes('period')) detectedMapping.date = col;
            if (colLower.includes('language')) detectedMapping.languagePair = col;
            if (colLower.includes('rate')) detectedMapping.rate = col;
          });

          setColumnMapping(detectedMapping);
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const saveColumnTemplate = async () => {
    if (!selectedClientId) return;

    try {
      // Save to database
      const updated = await clientsAPI.update(selectedClientId, {
        column_template: JSON.stringify(columnMapping)
      });

      // Update local state
      setClients(clients.map(c =>
        c.id === selectedClientId ? updated : c
      ));

      alert('Column mapping saved for this client! It will be auto-loaded next time.');
    } catch (error) {
      console.error('Error saving column template:', error);
      alert('Failed to save column mapping');
    }
  };

  const loadColumnTemplate = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client?.columnTemplate) {
      try {
        // Parse JSON string if it's stored as string
        const template = typeof client.columnTemplate === 'string'
          ? JSON.parse(client.columnTemplate)
          : client.columnTemplate;
        setColumnMapping(template);
      } catch (error) {
        console.error('Error loading column template:', error);
      }
    }
  };

  // === PAYMENT CALCULATION ===
  const calculatePayments = () => {
    if (!selectedClientId) {
      alert('Please select a client first!');
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const calculated: Payment[] = importedData.map((row: any) => {
      const reportInterpreterID = row[columnMapping.interpreterId];
      const interpreterName = row[columnMapping.interpreterName];
      const minutes = parseFloat(row[columnMapping.minutes] || 0);
      const hours = parseFloat(row[columnMapping.hours] || 0);
      const languagePair = row[columnMapping.languagePair];
      const period = row[columnMapping.date];
      const clientRate = parseFloat(row[columnMapping.rate] || 0);

      const matchedInterpreter = interpreters.find(i =>
        i[client.idField as keyof Interpreter] === reportInterpreterID
      );

      let clientCharge = 0;
      let interpreterPayment = 0;
      let matchStatus: 'matched' | 'unmatched' | 'no_interpreter_rate' = 'unmatched';

      if (matchedInterpreter) {
        const hasRate = matchedInterpreter.ratePerMinute || matchedInterpreter.ratePerHour;

        if (!hasRate) {
          matchStatus = 'no_interpreter_rate';
          if (minutes > 0) {
            clientCharge = minutes * clientRate;
          } else if (hours > 0) {
            clientCharge = hours * clientRate;
          }
        } else {
          matchStatus = 'matched';

          if (minutes > 0) {
            clientCharge = minutes * clientRate;
            interpreterPayment = minutes * (parseFloat(matchedInterpreter.ratePerMinute || '0'));
          } else if (hours > 0) {
            clientCharge = hours * clientRate;
            interpreterPayment = hours * (parseFloat(matchedInterpreter.ratePerHour || '0'));
          }
        }
      } else {
        matchStatus = 'unmatched';
        if (minutes > 0) {
          clientCharge = minutes * clientRate;
        } else if (hours > 0) {
          clientCharge = hours * clientRate;
        }
      }

      const profit = clientCharge - interpreterPayment;
      const profitMargin = clientCharge > 0 ? ((profit / clientCharge) * 100).toFixed(1) : '0';

      return {
        clientName: client.name,
        clientInterpreterID: reportInterpreterID,
        interpreterName: interpreterName,
        internalInterpreterName: matchedInterpreter ? matchedInterpreter.contactName : 'UNMATCHED',
        internalInterpreterId: matchedInterpreter ? matchedInterpreter.id : null,
        languagePair,
        period,
        clientRate: clientRate.toFixed(2),
        minutes,
        hours,
        clientCharge: clientCharge.toFixed(2),
        interpreterPayment: interpreterPayment.toFixed(2),
        profit: profit.toFixed(2),
        profitMargin: `${profitMargin}%`,
        status: 'pending' as const,
        matchStatus,
        adjustment: 0,
        notes: ''
      };
    });

    setCalculatedPayments(calculated);
    setActiveTab('review');
  };

  const approvePayment = async (index: number) => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments
      const updated = [...calculatedPayments];
      updated[index].status = 'approved';
      setCalculatedPayments(updated);
    } else {
      // Working with database payments
      const payment = dbPayments[index];
      if (!payment.id) return;

      try {
        await paymentsAPI.update(payment.id, { status: 'approved' });
        const updatedDb = [...dbPayments];
        updatedDb[index] = { ...payment, status: 'approved' };
        setDbPayments(updatedDb);
      } catch (error) {
        console.error('Error approving payment:', error);
        alert('Failed to approve payment');
      }
    }
  };

  const rejectPayment = async (index: number) => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments
      const updated = [...calculatedPayments];
      updated[index].status = 'rejected';
      setCalculatedPayments(updated);
    } else {
      // Working with database payments
      const payment = dbPayments[index];
      if (!payment.id) return;

      try {
        await paymentsAPI.update(payment.id, { status: 'rejected' });
        const updatedDb = [...dbPayments];
        updatedDb[index] = { ...payment, status: 'rejected' };
        setDbPayments(updatedDb);
      } catch (error) {
        console.error('Error rejecting payment:', error);
        alert('Failed to reject payment');
      }
    }
  };

  const addAdjustment = async (index: number) => {
    const amount = prompt('Enter adjustment amount (use negative for deductions):');
    const note = prompt('Enter reason for adjustment:');

    if (amount !== null) {
      const adjustment = parseFloat(amount);

      if (calculatedPayments.length > 0) {
        // Working with import workflow payments
        const updated = [...calculatedPayments];
        updated[index].adjustment = adjustment;
        updated[index].notes = note || '';
        updated[index].interpreterPayment = (parseFloat(updated[index].interpreterPayment) + adjustment).toFixed(2);
        updated[index].profit = (parseFloat(updated[index].clientCharge) - parseFloat(updated[index].interpreterPayment)).toFixed(2);
        setCalculatedPayments(updated);
      } else {
        // Working with database payments
        const payment = dbPayments[index];
        if (!payment.id) return;

        try {
          await paymentsAPI.update(payment.id, {
            adjustment,
            notes: note || ''
          });
          const updatedDb = [...dbPayments];
          updatedDb[index] = {
            ...payment,
            adjustment,
            notes: note || '',
            interpreter_payment: payment.interpreter_payment + adjustment,
            profit: payment.client_charge - (payment.interpreter_payment + adjustment)
          };
          setDbPayments(updatedDb);
        } catch (error) {
          console.error('Error adding adjustment:', error);
          alert('Failed to add adjustment');
        }
      }
    }
  };

  const approveAll = async () => {
    if (calculatedPayments.length > 0) {
      // Working with import workflow payments
      const updated = calculatedPayments.map(p =>
        p.matchStatus === 'matched' ? {...p, status: 'approved' as const} : p
      );
      setCalculatedPayments(updated);
    } else {
      // Working with database payments - approve all matched
      try {
        const toApprove = dbPayments.filter(p => p.match_status === 'matched');
        await Promise.all(
          toApprove.map(p => paymentsAPI.update(p.id, { status: 'approved' }))
        );
        const updatedDb = dbPayments.map(p =>
          p.match_status === 'matched' ? { ...p, status: 'approved' } : p
        );
        setDbPayments(updatedDb);
      } catch (error) {
        console.error('Error approving all:', error);
        alert('Failed to approve all payments');
      }
    }
  };

  const exportToCSV = () => {
    const headers = ['Client', 'Client Interpreter ID', 'Report Name', 'Internal Interpreter', 'Language', 'Period', 'Minutes', 'Hours', 'Client Rate', 'Client Charge', 'Interpreter Payment', 'Profit', 'Margin', 'Status', 'Match Status', 'Adjustment', 'Notes'];
    const rows = filteredPayments.map(p => [
      p.clientName, p.clientInterpreterID, p.interpreterName, p.internalInterpreterName,
      p.languagePair, p.period, p.minutes, p.hours, p.clientRate, p.clientCharge, p.interpreterPayment,
      p.profit, p.profitMargin, p.status, p.matchStatus, p.adjustment, p.notes
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alfa-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToZohoBooks = async () => {
    try {
      const params = new URLSearchParams();

      // Convert client name to client ID
      if (filterClient !== 'all') {
        const clientId = filterClient.toLowerCase().replace(/\s+/g, '');
        params.append('client_id', clientId);
      }
      if (filterPeriod !== 'all') params.append('period', filterPeriod);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/export-zoho-books?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        console.error('Export error:', errorData);
        alert(errorData.detail || 'Failed to export Zoho Books file');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zoho_books_import_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting Zoho Books:', error);
      alert(error.message || 'Failed to export Zoho Books file');
    }
  };

  const totalStats = filteredPayments.reduce((acc, p) => ({
    totalRevenue: acc.totalRevenue + parseFloat(p.clientCharge),
    totalPayments: acc.totalPayments + parseFloat(p.interpreterPayment),
    totalProfit: acc.totalProfit + parseFloat(p.profit),
    approved: acc.approved + (p.status === 'approved' ? 1 : 0),
    pending: acc.pending + (p.status === 'pending' ? 1 : 0),
    unmatched: acc.unmatched + (p.matchStatus === 'unmatched' ? 1 : 0),
    noInterpreterRate: acc.noInterpreterRate + (p.matchStatus === 'no_interpreter_rate' ? 1 : 0)
  }), { totalRevenue: 0, totalPayments: 0, totalProfit: 0, approved: 0, pending: 0, unmatched: 0, noInterpreterRate: 0 });

  return (
    <div className="min-h-screen bg-gray-50">
      <InterpreterModal
        isOpen={showInterpreterModal}
        onClose={() => {
          setShowInterpreterModal(false);
          setEditingItem(null);
        }}
        onSave={saveInterpreter}
        editingItem={editingItem as Interpreter || null}
      />

      <ClientModal
        isOpen={showClientModal}
        onClose={() => {
          setShowClientModal(false);
          setEditingItem(null);
        }}
        onSave={saveClient}
        editingItem={editingItem as Client || null}
      />

      <div className="bg-blue-600 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold">Alfa Systems</h1>
        <p className="text-blue-100">Interpreter Payment Management System</p>
      </div>

      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'interpreters', label: 'Interpreters', icon: Users },
              { id: 'clients', label: 'Clients', icon: Building2 },
              { id: 'import', label: 'Import', icon: Upload },
              { id: 'review', label: 'Review', icon: FileText },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon size={20} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Interpreters Tab */}
        {activeTab === 'interpreters' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Interpreters</h2>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 cursor-pointer">
                  <Upload size={20} />
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    onChange={importInterpretersFromCSV}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setShowInterpreterModal(true);
                  }}
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

            {interpreters.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg mb-2">No interpreters yet</p>
                <p className="text-sm">Import from CSV or add manually</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border px-4 py-2 text-left">Name</th>
                      <th className="border px-4 py-2 text-left">Email</th>
                      <th className="border px-4 py-2 text-left">Language</th>
                      <th className="border px-4 py-2 text-center">Cloudbreak ID</th>
                      <th className="border px-4 py-2 text-center">Languagelink ID</th>
                      <th className="border px-4 py-2 text-center">Propio ID</th>
                      <th className="border px-4 py-2 text-center">Rate/Min</th>
                      <th className="border px-4 py-2 text-center">Rate/Hour</th>
                      <th className="border px-4 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interpreters.map(i => (
                      <tr key={i.id}>
                        <td className="border px-4 py-2 font-medium">{i.contactName}</td>
                        <td className="border px-4 py-2">{i.email || '-'}</td>
                        <td className="border px-4 py-2">{i.language || '-'}</td>
                        <td className="border px-4 py-2 text-center font-mono text-xs">{i.cloudbreakId || '-'}</td>
                        <td className="border px-4 py-2 text-center font-mono text-xs">{i.languagelinkId || '-'}</td>
                        <td className="border px-4 py-2 text-center font-mono text-xs">{i.propioId || '-'}</td>
                        <td className="border px-4 py-2 text-center text-green-600 font-medium">
                          {i.ratePerMinute ? `$${parseFloat(i.ratePerMinute).toFixed(2)}` : '-'}
                        </td>
                        <td className="border px-4 py-2 text-center text-green-600 font-medium">
                          {i.ratePerHour ? `$${parseFloat(i.ratePerHour).toFixed(2)}` : '-'}
                        </td>
                        <td className="border px-4 py-2">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => {
                                setEditingItem(i);
                                setShowInterpreterModal(true);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => deleteInterpreter(i.id)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                            >
                              <Trash2 size={18} />
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
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Clients</h2>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setShowClientModal(true);
                }}
                className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                <Plus size={20} />
                Add Client
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="text-sm text-blue-800">
                💡 Your three main clients are pre-configured. Interpreter payment rates are stored directly on each interpreter record in the Interpreters tab.
              </p>
            </div>

            <table className="min-w-full border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-2 text-left">Client Name</th>
                  <th className="border px-4 py-2 text-center">ID Field</th>
                  <th className="border px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td className="border px-4 py-2 font-medium">{c.name}</td>
                    <td className="border px-4 py-2 text-center text-xs font-mono">{c.idField}</td>
                    <td className="border px-4 py-2">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setEditingItem(c);
                            setShowClientModal(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => deleteClient(c.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-4">Import Client Report</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Select Client *</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    loadColumnTemplate(e.target.value);
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- Choose a client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center ${!selectedClientId ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 inline-block"
                >
                  Choose File
                </label>
                {uploadedFile && (
                  <p className="mt-4 text-gray-600">
                    <strong>{uploadedFile.name}</strong>
                  </p>
                )}
              </div>
            </div>

            {importedData.length > 0 && selectedClientId && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-bold mb-4">Column Mapping</h3>

                <button
                  onClick={saveColumnTemplate}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mb-4"
                >
                  Save Mapping
                </button>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {Object.entries(standardColumns).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium mb-1">{label}</label>
                      <select
                        value={columnMapping[key] || ''}
                        onChange={(e) => setColumnMapping({...columnMapping, [key]: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="">-- Select --</option>
                        {Object.keys(importedData[0] || {}).map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Preview (First 3 rows)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(importedData[0] || {}).map(col => (
                            <th key={col} className="border px-4 py-2 text-left">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importedData.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className="border px-4 py-2">{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <button
                  onClick={calculatePayments}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 w-full"
                >
                  Calculate Payments
                </button>
              </div>
            )}
          </div>
        )}

        {/* Review Tab */}
        {activeTab === 'review' && (
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
                  onClick={approveAll}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  Approve All Matched
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  <Download size={20} />
                  Export CSV
                </button>
                <button
                  onClick={exportToZohoBooks}
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
                        onChange={(e) => setFilterClient(e.target.value)}
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
                        onChange={(e) => setFilterStatus(e.target.value)}
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
                        onChange={(e) => setFilterMatchStatus(e.target.value)}
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
                        onChange={(e) => setFilterLanguage(e.target.value)}
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
                        onChange={(e) => setFilterStartDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Search Interpreter</label>
                      <input
                        type="text"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Search name..."
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  <button
                    onClick={clearFilters}
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
                                  onClick={() => approvePayment(i)}
                                  className="p-1 text-green-600 hover:bg-green-100 rounded"
                                >
                                  <CheckCircle size={18} />
                                </button>
                                <button
                                  onClick={() => rejectPayment(i)}
                                  className="p-1 text-red-600 hover:bg-red-100 rounded"
                                >
                                  <XCircle size={18} />
                                </button>
                                <button
                                  onClick={() => addAdjustment(i)}
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
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-6 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
                  <select
                    value={filterClient}
                    onChange={(e) => setFilterClient(e.target.value)}
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
                    onChange={(e) => setFilterLanguage(e.target.value)}
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
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
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
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search name..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                  />
                </div>
              </div>

              <button
                onClick={clearFilters}
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
        )}
      </div>
    </div>
  );
};

export default AlfaPaymentSystem;
