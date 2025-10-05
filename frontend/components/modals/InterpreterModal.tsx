import React, { useState, useEffect } from 'react';
import { Interpreter } from '@/lib/types';
import { COMMON_LANGUAGES } from '@/lib/constants';

interface InterpreterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Interpreter>) => void;
  editingItem: Interpreter | null;
}

export const InterpreterModal: React.FC<InterpreterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingItem
}) => {
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
