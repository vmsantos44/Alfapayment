import React, { useState } from 'react';
import { Upload, FileText, TrendingUp, CheckCircle, XCircle, Download, Users, Building2, Plus, Edit, Trash2 } from 'lucide-react';

const AlfaPaymentSystem = () => {
  const [activeTab, setActiveTab] = useState('interpreters');
  
  // Core Data
  const [interpreters, setInterpreters] = useState([]);
  const [clients, setClients] = useState([
    { id: 'cloudbreak', name: 'Cloudbreak', idField: 'cloudbreakId' },
    { id: 'languagelink', name: 'Languagelink', idField: 'languagelinkId' },
    { id: 'propio', name: 'Propio', idField: 'propioId' }
  ]);
  
  // Import Process
  const [uploadedFile, setUploadedFile] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  const [importedData, setImportedData] = useState([]);
  const [calculatedPayments, setCalculatedPayments] = useState([]);
  
  // Modal States
  const [showInterpreterModal, setShowInterpreterModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
  const saveInterpreter = (data) => {
    if (editingItem) {
      setInterpreters(interpreters.map(i => i.id === editingItem.id ? { ...data, id: editingItem.id } : i));
    } else {
      setInterpreters([...interpreters, { ...data, id: Date.now().toString() }]);
    }
    setShowInterpreterModal(false);
    setEditingItem(null);
  };

  const deleteInterpreter = (id) => {
    if (confirm('Delete this interpreter?')) {
      setInterpreters(interpreters.filter(i => i.id !== id));
    }
  };

  const importInterpretersFromCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const imported = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const interpreter = {
          id: Date.now().toString() + i,
          recordId: values[headers.indexOf('Record Id')] || '',
          lastName: values[headers.indexOf('Last Name')] || '',
          employeeId: values[headers.indexOf('Emplyee ID')] || values[headers.indexOf('Employee ID')] || '',
          cloudbreakId: values[headers.indexOf('Cloudbreak ID')] || '',
          languagelinkId: values[headers.indexOf('Languagelink ID')] || '',
          propioId: values[headers.indexOf('Propio ID')] || '',
          contactName: values[headers.indexOf('Contact Name')] || '',
          email: values[headers.indexOf('Email')] || '',
          language: values[headers.indexOf('Language')] || '',
          paymentFrequency: values[headers.indexOf('Payment frequency')] || '',
          serviceLocation: values[headers.indexOf('Service Location')] || '',
          ratePerMinute: values[headers.indexOf('Rate Per Minute')] || values[headers.indexOf('Rate/Min')] || '',
          ratePerHour: values[headers.indexOf('Rate Per Hour')] || values[headers.indexOf('Rate/Hour')] || ''
        };
        imported.push(interpreter);
      }
      
      setInterpreters([...interpreters, ...imported]);
      alert(`Successfully imported ${imported.length} interpreters!`);
    };
    reader.readAsText(file);
  };

  // === CLIENT MANAGEMENT ===
  const saveClient = (data) => {
    if (editingItem) {
      setClients(clients.map(c => c.id === editingItem.id ? { ...data, id: editingItem.id, idField: editingItem.idField } : c));
    } else {
      const idField = data.name.toLowerCase().replace(/\s+/g, '') + 'Id';
      setClients([...clients, { ...data, id: Date.now().toString(), idField }]);
    }
    setShowClientModal(false);
    setEditingItem(null);
  };

  const deleteClient = (id) => {
    if (confirm('Delete this client?')) {
      setClients(clients.filter(c => c.id !== id));
    }
  };

  // === FILE IMPORT ===
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadedFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const mockData = [
        {
          'Interpreter ID': '12345',
          'Name': 'Jose Martinez',
          'Minutes': '1200',
          'Period': '2024-09',
          'Language': 'Spanish-English',
          'Rate': '0.50'
        },
        {
          'Interpreter ID': '67890',
          'Name': 'Maria Silva',
          'Minutes': '800',
          'Period': '2024-09',
          'Language': 'Portuguese-English',
          'Rate': '0.45'
        },
        {
          'Interpreter ID': '11111',
          'Name': 'Pierre Dubois',
          'Hours': '40',
          'Period': '2024-09',
          'Language': 'French-English',
          'Rate': '30.00'
        }
      ];
      
      setImportedData(mockData);
      
      if (mockData.length > 0) {
        const detectedMapping = {};
        const firstRow = mockData[0];
        
        Object.keys(firstRow).forEach(col => {
          if (col.toLowerCase().includes('id')) detectedMapping.interpreterId = col;
          if (col.toLowerCase().includes('name')) detectedMapping.interpreterName = col;
          if (col.toLowerCase().includes('minute')) detectedMapping.minutes = col;
          if (col.toLowerCase().includes('hour') && !col.toLowerCase().includes('minute')) detectedMapping.hours = col;
          if (col.toLowerCase().includes('date') || col.toLowerCase().includes('period')) detectedMapping.date = col;
          if (col.toLowerCase().includes('language')) detectedMapping.languagePair = col;
          if (col.toLowerCase().includes('rate')) detectedMapping.rate = col;
        });
        
        setColumnMapping(detectedMapping);
      }
    };
    reader.readAsText(file);
  };

  const saveColumnTemplate = () => {
    if (!selectedClientId) return;
    
    const updatedClients = clients.map(c => 
      c.id === selectedClientId ? { ...c, columnTemplate: columnMapping } : c
    );
    setClients(updatedClients);
    alert('Column mapping saved for this client!');
  };

  const loadColumnTemplate = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client && client.columnTemplate) {
      setColumnMapping(client.columnTemplate);
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

    const calculated = importedData.map(row => {
      const reportInterpreterID = row[columnMapping.interpreterId];
      const interpreterName = row[columnMapping.interpreterName];
      const minutes = parseFloat(row[columnMapping.minutes] || 0);
      const hours = parseFloat(row[columnMapping.hours] || 0);
      const languagePair = row[columnMapping.languagePair];
      const period = row[columnMapping.date];
      const clientRate = parseFloat(row[columnMapping.rate] || 0);

      const matchedInterpreter = interpreters.find(i => 
        i[client.idField] === reportInterpreterID
      );

      let clientCharge = 0;
      let interpreterPayment = 0;
      let matchStatus = 'unmatched';

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
            interpreterPayment = minutes * (parseFloat(matchedInterpreter.ratePerMinute) || 0);
          } else if (hours > 0) {
            clientCharge = hours * clientRate;
            interpreterPayment = hours * (parseFloat(matchedInterpreter.ratePerHour) || 0);
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
      const profitMargin = clientCharge > 0 ? ((profit / clientCharge) * 100).toFixed(1) : 0;

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
        status: 'pending',
        matchStatus,
        adjustment: 0,
        notes: ''
      };
    });

    setCalculatedPayments(calculated);
    setActiveTab('review');
  };

  const approvePayment = (index) => {
    const updated = [...calculatedPayments];
    updated[index].status = 'approved';
    setCalculatedPayments(updated);
  };

  const rejectPayment = (index) => {
    const updated = [...calculatedPayments];
    updated[index].status = 'rejected';
    setCalculatedPayments(updated);
  };

  const addAdjustment = (index) => {
    const amount = prompt('Enter adjustment amount (use negative for deductions):');
    const note = prompt('Enter reason for adjustment:');
    
    if (amount !== null) {
      const updated = [...calculatedPayments];
      const adjustment = parseFloat(amount);
      updated[index].adjustment = adjustment;
      updated[index].notes = note || '';
      updated[index].interpreterPayment = (parseFloat(updated[index].interpreterPayment) + adjustment).toFixed(2);
      updated[index].profit = (parseFloat(updated[index].clientCharge) - parseFloat(updated[index].interpreterPayment)).toFixed(2);
      setCalculatedPayments(updated);
    }
  };

  const approveAll = () => {
    const updated = calculatedPayments.map(p => 
      p.matchStatus === 'matched' ? {...p, status: 'approved'} : p
    );
    setCalculatedPayments(updated);
  };

  const exportToCSV = () => {
    const headers = ['Client', 'Client Interpreter ID', 'Report Name', 'Internal Interpreter', 'Language', 'Period', 'Minutes', 'Hours', 'Client Rate', 'Client Charge', 'Interpreter Payment', 'Profit', 'Margin', 'Status', 'Match Status', 'Adjustment', 'Notes'];
    const rows = calculatedPayments.map(p => [
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

  const totalStats = calculatedPayments.reduce((acc, p) => ({
    totalRevenue: acc.totalRevenue + parseFloat(p.clientCharge),
    totalPayments: acc.totalPayments + parseFloat(p.interpreterPayment),
    totalProfit: acc.totalProfit + parseFloat(p.profit),
    approved: acc.approved + (p.status === 'approved' ? 1 : 0),
    pending: acc.pending + (p.status === 'pending' ? 1 : 0),
    unmatched: acc.unmatched + (p.matchStatus === 'unmatched' ? 1 : 0),
    noInterpreterRate: acc.noInterpreterRate + (p.matchStatus === 'no_interpreter_rate' ? 1 : 0)
  }), { totalRevenue: 0, totalPayments: 0, totalProfit: 0, approved: 0, pending: 0, unmatched: 0, noInterpreterRate: 0 });

  // === MODALS ===
  const InterpreterModal = () => {
    const [formData, setFormData] = useState(editingItem || {
      recordId: '', lastName: '', employeeId: '', cloudbreakId: '',
      languagelinkId: '', propioId: '', contactName: '', email: '',
      language: '', paymentFrequency: '', serviceLocation: '',
      ratePerMinute: '', ratePerHour: ''
    });

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
                value={formData.contactName}
                onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Employee ID</label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Language(s)</label>
              <input
                type="text"
                value={formData.language}
                onChange={(e) => setFormData({...formData, language: e.target.value})}
                className="w-full border rounded px-3 py-2"
                placeholder="Spanish, Portuguese"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Payment Frequency</label>
              <select
                value={formData.paymentFrequency}
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
                value={formData.cloudbreakId}
                onChange={(e) => setFormData({...formData, cloudbreakId: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Languagelink ID</label>
              <input
                type="text"
                value={formData.languagelinkId}
                onChange={(e) => setFormData({...formData, languagelinkId: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Propio ID</label>
              <input
                type="text"
                value={formData.propioId}
                onChange={(e) => setFormData({...formData, propioId: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Service Location</label>
              <input
                type="text"
                value={formData.serviceLocation}
                onChange={(e) => setFormData({...formData, serviceLocation: e.target.value})}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Rate Per Minute ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.ratePerMinute}
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
                value={formData.ratePerHour}
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
                saveInterpreter(formData);
              }}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {editingItem ? 'Update' : 'Add'} Interpreter
            </button>
            <button
              onClick={() => {
                setShowInterpreterModal(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ClientModal = () => {
    const [formData, setFormData] = useState(editingItem || {
      name: ''
    });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-xl font-bold mb-4">
            {editingItem ? 'Edit Client' : 'Add Client'}
          </h3>
          
          <div>
            <label className="block text-sm font-medium mb-2">Client Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="ABC Company"
            />
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                if (!formData.name) {
                  alert('Client name is required!');
                  return;
                }
                saveClient(formData);
              }}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              {editingItem ? 'Update' : 'Add'} Client
            </button>
            <button
              onClick={() => {
                setShowClientModal(false);
                setEditingItem(null);
              }}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showInterpreterModal && <InterpreterModal />}
      {showClientModal && <ClientModal />}
      
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
                💡 Import your interpreter list from CRM CSV. Include columns: "Rate Per Minute" and "Rate Per Hour" to set what you PAY each interpreter.
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
                            {Object.values(row).map((val, j) => (
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
              <h2 className="text-2xl font-bold">Review & Approve</h2>
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
              </div>
            </div>

            {calculatedPayments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No payments to review</p>
            ) : (
              <>
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
                      {calculatedPayments.map((p, i) => (
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
              <h3 className="text-xl font-bold mb-4">Performance by Language</h3>
              {calculatedPayments.filter(p => p.matchStatus === 'matched').length === 0 ? (
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
                      {calculatedPayments.filter(p => p.matchStatus === 'matched').map((p, i) => (
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