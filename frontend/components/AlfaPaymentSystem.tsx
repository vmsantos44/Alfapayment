'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, TrendingUp, Users, Building2, Cloud, RefreshCw, DollarSign, Download } from 'lucide-react';
import Papa from 'papaparse';

// Types
import { Interpreter, Client, Payment, ColumnMapping } from '@/lib/types';

// Hooks
import { useInterpreters } from './hooks/useInterpreters';
import { useClients } from './hooks/useClients';
import { usePayments } from './hooks/usePayments';

// Modals
import { InterpreterModal } from './modals/InterpreterModal';
import { ClientModal } from './modals/ClientModal';

// Tabs
import { InterpretersTab } from './tabs/InterpretersTab';
import { ClientsTab } from './tabs/ClientsTab';
import { ImportTab } from './tabs/ImportTab';
import { ReviewTab } from './tabs/ReviewTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { ZohoImportTab } from './tabs/ZohoImportTab';
import { SyncTab } from './tabs/SyncTab';
import { ZohoBooksTab } from './tabs/ZohoBooksTab';
import { ItemsSyncTab } from './tabs/ItemsSyncTab';

// Utils
import { calculatePayments, detectColumnMapping, calculatePaymentStats } from '@/lib/utils/paymentCalculator';
import { clientsAPI, zohoAPI } from '@/lib/api';

const AlfaPaymentSystem = () => {
  const [activeTab, setActiveTab] = useState('interpreters');

  // Use custom hooks
  const {
    interpreters,
    loading: interpretersLoading,
    loadInterpreters,
    createInterpreter,
    updateInterpreter,
    deleteInterpreter,
    importInterpretersFromCSV,
    syncFromZohoSheet
  } = useInterpreters();

  const {
    clients,
    loading: clientsLoading,
    loadClients,
    createClient,
    updateClient,
    deleteClient
  } = useClients();

  const {
    dbPayments,
    loadPayments,
    approvePayment,
    rejectPayment,
    addAdjustment,
    transformDbPayment
  } = usePayments(clients);

  // Import workflow state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [importedData, setImportedData] = useState<any[]>([]);
  const [calculatedPayments, setCalculatedPayments] = useState<Payment[]>([]);

  // Filter states for Review/Analytics tabs
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterMatchStatus, setFilterMatchStatus] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // Filter states for Interpreters tab
  const [filterInterpreterLanguage, setFilterInterpreterLanguage] = useState<string>('all');
  const [filterServiceLocation, setFilterServiceLocation] = useState<string>('all');
  const [filterPaymentFrequency, setFilterPaymentFrequency] = useState<string>('all');
  const [filterOnboardingStatus, setFilterOnboardingStatus] = useState<string>('all');
  const [searchInterpreterText, setSearchInterpreterText] = useState<string>('');

  // Bill date for Zoho Books export (defaults to today)
  const [billDate, setBillDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Zoho import states
  const [zohoCandidates, setZohoCandidates] = useState<any[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [zohoLoading, setZohoLoading] = useState(false);

  // Modal states
  const [showInterpreterModal, setShowInterpreterModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Interpreter | Client | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          loadInterpreters(),
          loadClients(),
          loadPayments()
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load data from database');
      }
    };
    loadData();
  }, [loadInterpreters, loadClients, loadPayments]);

  // Get payments for review (either calculated or from DB)
  const reviewPayments = calculatedPayments.length > 0
    ? calculatedPayments
    : dbPayments.map(transformDbPayment);

  // Apply filters
  const filteredPayments = reviewPayments.filter(payment => {
    if (filterClient !== 'all' && payment.clientName !== filterClient) return false;
    if (filterStatus !== 'all' && payment.status !== filterStatus) return false;
    if (filterMatchStatus !== 'all' && payment.matchStatus !== filterMatchStatus) return false;
    if (filterLanguage !== 'all' && payment.languagePair !== filterLanguage) return false;
    if (filterPeriod !== 'all' && payment.period !== filterPeriod) return false;

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

    if (searchText && !payment.internalInterpreterName.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    return true;
  });

  // Apply interpreter filters
  const filteredInterpreters = interpreters.filter(interpreter => {
    if (filterInterpreterLanguage !== 'all' && interpreter.language !== filterInterpreterLanguage) return false;
    if (filterServiceLocation !== 'all' && interpreter.serviceLocation !== filterServiceLocation) return false;
    if (filterPaymentFrequency !== 'all' && interpreter.paymentFrequency !== filterPaymentFrequency) return false;
    if (filterOnboardingStatus !== 'all' && interpreter.onboardingStatus !== filterOnboardingStatus) return false;

    if (searchInterpreterText) {
      const searchLower = searchInterpreterText.toLowerCase();
      const matchesName = interpreter.contactName?.toLowerCase().includes(searchLower);
      const matchesEmail = interpreter.email?.toLowerCase().includes(searchLower);
      const matchesCloudbreak = interpreter.cloudbreakId?.toLowerCase().includes(searchLower);
      const matchesLanguagelink = interpreter.languagelinkId?.toLowerCase().includes(searchLower);
      const matchesPropio = interpreter.propioId?.toLowerCase().includes(searchLower);
      const matchesEmployeeId = interpreter.employeeId?.toLowerCase().includes(searchLower);

      if (!matchesName && !matchesEmail && !matchesCloudbreak && !matchesLanguagelink && !matchesPropio && !matchesEmployeeId) {
        return false;
      }
    }

    return true;
  });

  // Get unique filter values for payments
  const uniqueClients = Array.from(new Set(reviewPayments.map(p => p.clientName))).sort();
  const uniqueLanguages = Array.from(new Set(reviewPayments.map(p => p.languagePair).filter(Boolean))).sort();
  const uniquePeriods = Array.from(new Set(reviewPayments.map(p => p.period))).sort();

  // Get unique filter values for interpreters
  const uniqueInterpreterLanguages = Array.from(new Set(interpreters.map(i => i.language).filter(Boolean))).sort();
  const uniqueServiceLocations = Array.from(new Set(interpreters.map(i => i.serviceLocation).filter(Boolean))).sort();
  const uniquePaymentFrequencies = Array.from(new Set(interpreters.map(i => i.paymentFrequency).filter(Boolean))).sort();
  const uniqueOnboardingStatuses = Array.from(new Set(interpreters.map(i => i.onboardingStatus).filter(Boolean))).sort();

  // Calculate stats
  const totalStats = calculatePaymentStats(filteredPayments);

  // Handlers
  const handleFilterChange = (filter: string, value: string) => {
    switch (filter) {
      case 'client': setFilterClient(value); break;
      case 'status': setFilterStatus(value); break;
      case 'matchStatus': setFilterMatchStatus(value); break;
      case 'language': setFilterLanguage(value); break;
      case 'period': setFilterPeriod(value); break;
      case 'search': setSearchText(value); break;
      case 'startDate': setFilterStartDate(value); break;
      case 'endDate': setFilterEndDate(value); break;
    }
  };

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

  const handleInterpreterFilterChange = (filter: string, value: string) => {
    switch (filter) {
      case 'language': setFilterInterpreterLanguage(value); break;
      case 'serviceLocation': setFilterServiceLocation(value); break;
      case 'paymentFrequency': setFilterPaymentFrequency(value); break;
      case 'onboardingStatus': setFilterOnboardingStatus(value); break;
      case 'search': setSearchInterpreterText(value); break;
    }
  };

  const clearInterpreterFilters = () => {
    setFilterInterpreterLanguage('all');
    setFilterServiceLocation('all');
    setFilterPaymentFrequency('all');
    setFilterOnboardingStatus('all');
    setSearchInterpreterText('');
  };

  // Interpreter handlers
  const handleSaveInterpreter = async (data: Partial<Interpreter>) => {
    try {
      if (editingItem && 'contactName' in editingItem) {
        await updateInterpreter(editingItem.id, data);
      } else {
        await createInterpreter(data);
      }
      setShowInterpreterModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to save interpreter');
    }
  };

  const handleDeleteInterpreter = async (id: string) => {
    if (confirm('Delete this interpreter?')) {
      try {
        await deleteInterpreter(id);
      } catch (error) {
        alert('Failed to delete interpreter');
      }
    }
  };

  const handleImportInterpretersCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importInterpretersFromCSV(file);
      let message = `Import complete!\n\n`;
      message += `• Created: ${result.created} new interpreters\n`;
      message += `• Updated: ${result.updated} existing interpreters\n`;
      message += `• Total processed: ${result.total}`;
      alert(message);
    } catch (error) {
      alert('Failed to import interpreters');
    }
  };

  const handleSyncFromZoho = async () => {
    try {
      const result = await syncFromZohoSheet();

      if (result.success) {
        let message = `✓ Zoho Sync Complete!\n\n`;
        message += `• ${result.summary.created} new interpreters added\n`;
        message += `• ${result.summary.updated} interpreters updated\n`;
        message += `• ${result.summary.skipped} unchanged\n`;
        message += `• Total in Zoho: ${result.summary.total}`;

        if (result.summary.errors > 0) {
          message += `\n\n⚠️ ${result.summary.errors} errors occurred`;
        }

        alert(message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to sync from Zoho Sheet:\n\n${errorMessage}`);
    }
  };

  // Client handlers
  const handleSaveClient = async (data: any) => {
    try {
      if (editingItem && 'idField' in editingItem) {
        await updateClient(editingItem.id, { name: data.name });
      } else {
        await createClient(data);
      }
      setShowClientModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to save client');
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm('Delete this client?')) {
      try {
        await deleteClient(id);
      } catch (error) {
        alert('Failed to delete client');
      }
    }
  };

  // Zoho import handlers
  const handleFetchZohoCandidates = async (filters: {
    module?: string;
    onboardingStatus?: string;
    language?: string;
    serviceLocation?: string;
  }) => {
    try {
      setZohoLoading(true);
      const response = await zohoAPI.getCandidates({
        module: filters.module,
        onboarding_status: filters.onboardingStatus,
        language: filters.language,
        service_location: filters.serviceLocation,
        limit: 100
      });

      // Extract candidates from response
      const candidates = Array.isArray(response) ? response : (response.data || []);
      setZohoCandidates(candidates);
      setSelectedCandidates(new Set()); // Clear selections
    } catch (error) {
      console.error('Error fetching Zoho candidates:', error);
      alert('Failed to fetch candidates from Zoho CRM');
    } finally {
      setZohoLoading(false);
    }
  };

  const handleToggleCandidate = (id: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCandidates(newSelected);
  };

  const handleToggleAllCandidates = () => {
    if (selectedCandidates.size === zohoCandidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(zohoCandidates.map(c => c.id)));
    }
  };

  const handleImportSelectedCandidates = async () => {
    if (selectedCandidates.size === 0) {
      alert('Please select at least one candidate to import');
      return;
    }

    try {
      setZohoLoading(true);
      const candidateIds = Array.from(selectedCandidates);
      const result = await zohoAPI.importCandidates(candidateIds);

      // Reload interpreters to show newly imported ones
      await loadInterpreters();

      alert(`Successfully imported ${result.summary?.created || 0} interpreters`);

      // Clear selections and switch to interpreters tab
      setSelectedCandidates(new Set());
      setActiveTab('interpreters');
    } catch (error) {
      console.error('Error importing candidates:', error);
      alert('Failed to import selected candidates');
    } finally {
      setZohoLoading(false);
    }
  };

  // Import workflow handlers
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
          const detectedMapping = detectColumnMapping(results.data[0] as Record<string, any>);
          setColumnMapping(detectedMapping);
        }
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    loadColumnTemplate(clientId);
  };

  const loadColumnTemplate = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client?.columnTemplate) {
      try {
        const template = typeof client.columnTemplate === 'string'
          ? JSON.parse(client.columnTemplate)
          : client.columnTemplate;
        setColumnMapping(template);
      } catch (error) {
        console.error('Error loading column template:', error);
      }
    }
  };

  const handleSaveColumnTemplate = async () => {
    if (!selectedClientId) return;

    try {
      await clientsAPI.update(selectedClientId, {
        column_template: JSON.stringify(columnMapping)
      });

      // Update local state
      await loadClients();

      alert('Column mapping saved for this client! It will be auto-loaded next time.');
    } catch (error) {
      console.error('Error saving column template:', error);
      alert('Failed to save column mapping');
    }
  };

  const handleCalculatePayments = () => {
    if (!selectedClientId) {
      alert('Please select a client first!');
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const calculated = calculatePayments(importedData, columnMapping, interpreters, client);
    setCalculatedPayments(calculated);
    setActiveTab('review');
  };

  // Payment action handlers
  const handleApprovePayment = async (index: number) => {
    if (calculatedPayments.length > 0) {
      const updated = [...calculatedPayments];
      updated[index].status = 'approved';
      setCalculatedPayments(updated);
    } else {
      await approvePayment(index, []);
    }
  };

  const handleRejectPayment = async (index: number) => {
    if (calculatedPayments.length > 0) {
      const updated = [...calculatedPayments];
      updated[index].status = 'rejected';
      setCalculatedPayments(updated);
    } else {
      await rejectPayment(index, []);
    }
  };

  const handleAddAdjustment = async (index: number) => {
    const amount = prompt('Enter adjustment amount (use negative for deductions):');
    const note = prompt('Enter reason for adjustment:');

    if (amount !== null) {
      const adjustment = parseFloat(amount);

      if (calculatedPayments.length > 0) {
        const updated = [...calculatedPayments];
        updated[index].adjustment = adjustment;
        updated[index].notes = note || '';
        updated[index].interpreterPayment = (parseFloat(updated[index].interpreterPayment) + adjustment).toFixed(2);
        updated[index].profit = (parseFloat(updated[index].clientCharge) - parseFloat(updated[index].interpreterPayment)).toFixed(2);
        setCalculatedPayments(updated);
      } else {
        await addAdjustment(index, adjustment, note || '', []);
      }
    }
  };

  const handleApproveAll = () => {
    if (calculatedPayments.length > 0) {
      const updated = calculatedPayments.map(p =>
        p.matchStatus === 'matched' ? { ...p, status: 'approved' as const } : p
      );
      setCalculatedPayments(updated);
    }
    // TODO: Handle DB approval in usePayments hook
  };

  const handleExportCSV = () => {
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

  const handleExportZohoBooks = async () => {
    try {
      const params = new URLSearchParams();

      // Add ALL active filters to match the CSV export behavior
      if (filterClient !== 'all') {
        const clientId = filterClient.toLowerCase().replace(/\s+/g, '');
        params.append('client_id', clientId);
      }
      if (filterPeriod !== 'all') params.append('period', filterPeriod);
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterMatchStatus !== 'all') params.append('match_status', filterMatchStatus);
      if (filterLanguage !== 'all') params.append('language', filterLanguage);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);
      if (searchText) params.append('search', searchText);

      // Add bill date
      if (billDate) params.append('bill_date', billDate);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <InterpreterModal
        isOpen={showInterpreterModal}
        onClose={() => {
          setShowInterpreterModal(false);
          setEditingItem(null);
        }}
        onSave={handleSaveInterpreter}
        editingItem={editingItem as Interpreter || null}
      />

      <ClientModal
        isOpen={showClientModal}
        onClose={() => {
          setShowClientModal(false);
          setEditingItem(null);
        }}
        onSave={handleSaveClient}
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
              { id: 'sync', label: 'Sync', icon: RefreshCw },
              { id: 'zoho', label: 'Zoho Import', icon: Cloud },
              { id: 'import', label: 'Import', icon: Upload },
              { id: 'review', label: 'Review', icon: FileText },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'zoho-books', label: 'Zoho Books', icon: DollarSign },
              { id: 'items-sync', label: 'Items Sync', icon: Download }
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
        {activeTab === 'interpreters' && (
          <InterpretersTab
            interpreters={interpreters}
            filteredInterpreters={filteredInterpreters}
            uniqueLanguages={uniqueInterpreterLanguages}
            uniqueServiceLocations={uniqueServiceLocations}
            uniquePaymentFrequencies={uniquePaymentFrequencies}
            uniqueOnboardingStatuses={uniqueOnboardingStatuses}
            filterLanguage={filterInterpreterLanguage}
            filterServiceLocation={filterServiceLocation}
            filterPaymentFrequency={filterPaymentFrequency}
            filterOnboardingStatus={filterOnboardingStatus}
            searchText={searchInterpreterText}
            onFilterChange={handleInterpreterFilterChange}
            onClearFilters={clearInterpreterFilters}
            onImportCSV={handleImportInterpretersCSV}
            onAddInterpreter={() => {
              setEditingItem(null);
              setShowInterpreterModal(true);
            }}
            onEditInterpreter={(interpreter) => {
              setEditingItem(interpreter);
              setShowInterpreterModal(true);
            }}
            onDeleteInterpreter={handleDeleteInterpreter}
            onSyncFromZoho={handleSyncFromZoho}
            isSyncing={interpretersLoading}
          />
        )}

        {activeTab === 'clients' && (
          <ClientsTab
            clients={clients}
            onAddClient={() => {
              setEditingItem(null);
              setShowClientModal(true);
            }}
            onEditClient={(client) => {
              setEditingItem(client);
              setShowClientModal(true);
            }}
            onDeleteClient={handleDeleteClient}
          />
        )}

        {activeTab === 'sync' && (
          <SyncTab />
        )}

        {activeTab === 'zoho' && (
          <ZohoImportTab
            zohoCandidates={zohoCandidates}
            selectedCandidates={selectedCandidates}
            loading={zohoLoading}
            existingInterpreters={interpreters}
            onFetchCandidates={handleFetchZohoCandidates}
            onToggleCandidate={handleToggleCandidate}
            onToggleAll={handleToggleAllCandidates}
            onImportSelected={handleImportSelectedCandidates}
          />
        )}

        {activeTab === 'import' && (
          <ImportTab
            selectedClientId={selectedClientId}
            clients={clients}
            uploadedFile={uploadedFile}
            importedData={importedData}
            columnMapping={columnMapping}
            onClientChange={handleClientChange}
            onFileUpload={handleFileUpload}
            onColumnMappingChange={setColumnMapping}
            onSaveMapping={handleSaveColumnTemplate}
            onCalculate={handleCalculatePayments}
            onPaymentsUpdated={loadPayments}
          />
        )}

        {activeTab === 'review' && (
          <ReviewTab
            reviewPayments={reviewPayments}
            filteredPayments={filteredPayments}
            uniqueClients={uniqueClients}
            uniqueLanguages={uniqueLanguages}
            uniquePeriods={uniquePeriods}
            filterClient={filterClient}
            filterStatus={filterStatus}
            filterMatchStatus={filterMatchStatus}
            filterLanguage={filterLanguage}
            filterPeriod={filterPeriod}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            searchText={searchText}
            billDate={billDate}
            totalStats={totalStats}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            onApproveAll={handleApproveAll}
            onApprove={handleApprovePayment}
            onReject={handleRejectPayment}
            onAdjustment={handleAddAdjustment}
            onExportCSV={handleExportCSV}
            onExportZohoBooks={handleExportZohoBooks}
            onBillDateChange={setBillDate}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            filteredPayments={filteredPayments}
            uniqueClients={uniqueClients}
            uniqueLanguages={uniqueLanguages}
            filterClient={filterClient}
            filterLanguage={filterLanguage}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            filterStatus={filterStatus}
            searchText={searchText}
            totalStats={totalStats}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
          />
        )}

        {activeTab === 'zoho-books' && (
          <ZohoBooksTab
            payments={dbPayments}
          />
        )}

        {activeTab === 'items-sync' && (
          <ItemsSyncTab />
        )}
      </div>
    </div>
  );
};

export default AlfaPaymentSystem;
