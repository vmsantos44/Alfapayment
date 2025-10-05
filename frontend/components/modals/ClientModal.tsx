import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Client, ClientRate } from '@/lib/types';
import { COMMON_LANGUAGES } from '@/lib/constants';
import { clientRatesAPI } from '@/lib/api';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; rates?: ClientRate[] }) => void;
  editingItem: Client | null;
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem
}) => {
  const [formData, setFormData] = useState({ name: editingItem?.name || '' });
  const [clientRates, setClientRates] = useState<ClientRate[]>([]);
  const [newRate, setNewRate] = useState({
    language: '',
    serviceLocation: '',
    ratePerMinute: '',
    ratePerHour: '',
    rateType: 'minute'
  });
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
