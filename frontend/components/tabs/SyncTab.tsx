import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, AlertCircle, XCircle, Eye } from 'lucide-react';

interface SyncOperation {
  id: string;
  triggerType: string;
  status: string;
  totalFetched: number;
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  totalSyncedToZoho: number;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface SyncStats {
  lastSync: SyncOperation | null;
  totalOperations: number;
  isSyncing: boolean;
}

interface SyncLog {
  id: string;
  syncOperationId: string;
  level: string;
  message: string;
  recordId: string | null;
  interpreterId: string | null;
  details: string | null;
  createdAt: string;
}

export const SyncTab: React.FC = () => {
  const [module, setModule] = useState('Contacts');
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncOperation[]>([]);
  const [selectedSync, setSelectedSync] = useState<SyncOperation | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // Test mode state
  const [testMode, setTestMode] = useState(false);
  const [testSearchType, setTestSearchType] = useState<'recordId' | 'email'>('email');
  const [testSearchValue, setTestSearchValue] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Poll sync status every 3 seconds
  useEffect(() => {
    loadSyncStatus();
    loadSyncHistory();

    const interval = setInterval(() => {
      loadSyncStatus();
      if (syncStats?.isSyncing) {
        loadSyncHistory();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [syncStats?.isSyncing]);

  const loadSyncStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync/status');
      const data = await response.json();
      setSyncStats(data);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/sync/history?limit=10');
      const data = await response.json();
      setSyncHistory(data);
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const loadSyncLogs = async (syncId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/sync/${syncId}/logs?limit=200`);
      const data = await response.json();
      setSyncLogs(data);
    } catch (error) {
      console.error('Error loading sync logs:', error);
    }
  };

  const handleForceSync = async () => {
    if (syncStats?.isSyncing) {
      alert('A sync is already in progress. Please wait for it to complete.');
      return;
    }

    if (!confirm(`Start synchronization from Zoho ${module}?\n\nThis will fetch all records with "Pending Sync" status.`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/sync/force', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ module }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 429) {
          // Rate limit error - show user-friendly message
          alert(error.detail || 'Please wait before syncing again');
        } else {
          throw new Error(error.detail || 'Sync failed');
        }
        return;
      }

      // Reload status and history
      await loadSyncStatus();
      await loadSyncHistory();

      alert('Sync started successfully! Monitor the progress below.');
    } catch (error: any) {
      console.error('Error starting sync:', error);
      alert(error.message || 'Failed to start sync');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSync = async () => {
    if (!testSearchValue.trim()) {
      alert('Please enter a Record ID or Email');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const payload: any = { module };
      if (testSearchType === 'recordId') {
        payload.recordId = testSearchValue.trim();
      } else {
        payload.email = testSearchValue.trim();
      }

      const response = await fetch('http://localhost:8000/api/sync/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Test sync failed');
      }

      const result = await response.json();
      setTestResult(result);

      // Reload status and history to reflect changes
      await loadSyncStatus();
      await loadSyncHistory();
    } catch (error: any) {
      console.error('Error during test sync:', error);
      setTestResult({
        success: false,
        error: error.message || 'Failed to perform test sync'
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleViewLogs = (sync: SyncOperation) => {
    setSelectedSync(sync);
    loadSyncLogs(sync.id);
    setShowLogs(true);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      case 'partial':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={18} />;
      case 'running':
        return <RefreshCw size={18} className="animate-spin" />;
      case 'failed':
        return <XCircle size={18} />;
      case 'partial':
        return <AlertCircle size={18} />;
      default:
        return <Clock size={18} />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-red-600 bg-red-50';
      case 'WARNING':
        return 'text-yellow-600 bg-yellow-50';
      case 'INFO':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Zoho CRM Sync</h2>
        <p className="text-gray-600">
          Automatically sync records from Zoho CRM with "Pending Sync" status
        </p>
      </div>

      {/* Test Mode Toggle */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-yellow-800">Test Mode</h3>
            <p className="text-sm text-yellow-700">
              Validate sync by fetching and syncing a single record
            </p>
          </div>
          <button
            onClick={() => setTestMode(!testMode)}
            className={`px-4 py-2 rounded font-medium ${
              testMode ? 'bg-yellow-600 text-white' : 'bg-white text-yellow-700 border border-yellow-300'
            }`}
          >
            {testMode ? 'Disable Test Mode' : 'Enable Test Mode'}
          </button>
        </div>

        {testMode && (
          <div className="mt-4 space-y-4">
            {/* Module Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Module</label>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                disabled={testLoading}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="Contacts">Contacts</option>
                <option value="Leads">Leads</option>
              </select>
            </div>

            {/* Search Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Search By</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="email"
                    checked={testSearchType === 'email'}
                    onChange={() => setTestSearchType('email')}
                    disabled={testLoading}
                    className="mr-2"
                  />
                  Email
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="recordId"
                    checked={testSearchType === 'recordId'}
                    onChange={() => setTestSearchType('recordId')}
                    disabled={testLoading}
                    className="mr-2"
                  />
                  Record ID
                </label>
              </div>
            </div>

            {/* Search Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {testSearchType === 'email' ? 'Email Address' : 'Record ID'}
              </label>
              <input
                type="text"
                value={testSearchValue}
                onChange={(e) => setTestSearchValue(e.target.value)}
                disabled={testLoading}
                placeholder={testSearchType === 'email' ? 'Enter email address' : 'Enter Zoho record ID'}
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            {/* Test Sync Button */}
            <button
              onClick={handleTestSync}
              disabled={testLoading || !testSearchValue.trim()}
              className={`w-full px-6 py-2 rounded font-medium ${
                testLoading || !testSearchValue.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              } text-white`}
            >
              {testLoading ? 'Testing...' : 'Test Sync Single Record'}
            </button>

            {/* Test Results */}
            {testResult && (
              <div className={`p-4 rounded border ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <h4 className={`font-semibold mb-2 ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.success ? '✓ Test Successful' : '✗ Test Failed'}
                </h4>

                {testResult.error && (
                  <div className="text-red-700 text-sm mb-2">
                    <strong>Error:</strong> {testResult.error}
                  </div>
                )}

                {testResult.success && testResult.record_fetched && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <strong>Record Found:</strong>
                      <div className="ml-4 mt-1">
                        <div>ID: {testResult.record_fetched.id}</div>
                        <div>Email: {testResult.record_fetched.email || 'N/A'}</div>
                        <div>Name: {testResult.record_fetched.contact_name || 'N/A'}</div>
                        <div>Sync Status: {testResult.record_fetched.sync_status || 'N/A'}</div>
                      </div>
                    </div>

                    <div>
                      <strong>Action Taken:</strong> {
                        testResult.action_taken === 'created' ? '🆕 Created new interpreter' :
                        testResult.action_taken === 'updated' ? '🔄 Updated existing interpreter' :
                        testResult.action_taken === 'skipped_no_changes' ? '⏭️ Skipped (no changes)' :
                        testResult.action_taken
                      }
                    </div>

                    {testResult.interpreter_id && (
                      <div>
                        <strong>Interpreter ID:</strong> {testResult.interpreter_id}
                      </div>
                    )}

                    {testResult.changes_detected && testResult.changes_detected.length > 0 && (
                      <div>
                        <strong>Changes Detected:</strong> {testResult.changes_detected.join(', ')}
                      </div>
                    )}

                    <div>
                      <strong>Zoho Updated:</strong> {testResult.zoho_updated ? '✓ Yes' : '✗ No'}
                    </div>

                    <div>
                      <strong>Duration:</strong> {testResult.duration_seconds?.toFixed(2)}s
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync Control Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Sync Control</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              disabled={syncStats?.isSyncing || loading}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="Contacts">Contacts</option>
              <option value="Leads">Leads</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleForceSync}
              disabled={syncStats?.isSyncing || loading}
              className={`flex items-center gap-2 px-6 py-2 rounded font-medium ${
                syncStats?.isSyncing || loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white`}
            >
              <RefreshCw size={18} className={syncStats?.isSyncing || loading ? 'animate-spin' : ''} />
              {syncStats?.isSyncing || loading ? 'Syncing...' : 'Force Sync'}
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>💡 <strong>How it works:</strong></p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Fetches records from Zoho {module} where "Sync to Payment App" = "Pending Sync"</li>
            <li>Creates or updates interpreters in the payment app</li>
            <li>Marks successfully synced records as "Synced" in Zoho</li>
            <li>Provides detailed logs of all operations</li>
          </ul>
        </div>
      </div>

      {/* Statistics Panel */}
      {syncStats?.lastSync && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Last Sync Statistics</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">{syncStats.lastSync.totalFetched}</div>
              <div className="text-sm text-gray-600">Records Fetched</div>
            </div>

            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">{syncStats.lastSync.totalCreated}</div>
              <div className="text-sm text-gray-600">Created</div>
            </div>

            <div className="bg-yellow-50 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-600">{syncStats.lastSync.totalUpdated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </div>

            <div className="bg-purple-50 p-4 rounded">
              <div className="text-2xl font-bold text-purple-600">{syncStats.lastSync.totalSyncedToZoho}</div>
              <div className="text-sm text-gray-600">Synced to Zoho</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Skipped:</span>
              <span className="ml-2 font-medium">{syncStats.lastSync.totalSkipped}</span>
            </div>
            <div>
              <span className="text-gray-600">Errors:</span>
              <span className="ml-2 font-medium text-red-600">{syncStats.lastSync.totalErrors}</span>
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>
              <span className="ml-2 font-medium">{formatDuration(syncStats.lastSync.durationSeconds)}</span>
            </div>
            <div>
              <span className="text-gray-600">Time:</span>
              <span className="ml-2 font-medium">{formatDate(syncStats.lastSync.completedAt || syncStats.lastSync.startedAt)}</span>
            </div>
          </div>

          {syncStats.lastSync.errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              <strong>Error:</strong> {syncStats.lastSync.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Sync History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Sync History</h3>

        {syncHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock size={48} className="mx-auto mb-2 text-gray-300" />
            <p>No sync operations yet</p>
            <p className="text-sm">Click "Force Sync" to start your first synchronization</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fetched</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Synced</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started At</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncHistory.map((sync) => (
                  <tr key={sync.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(sync.status)}`}>
                        {getStatusIcon(sync.status)}
                        {sync.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{sync.triggerType}</td>
                    <td className="px-4 py-3 text-sm font-medium">{sync.totalFetched}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{sync.totalCreated}</td>
                    <td className="px-4 py-3 text-sm text-yellow-600">{sync.totalUpdated}</td>
                    <td className="px-4 py-3 text-sm text-purple-600">{sync.totalSyncedToZoho}</td>
                    <td className="px-4 py-3 text-sm">{formatDuration(sync.durationSeconds)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(sync.startedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleViewLogs(sync)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Eye size={16} />
                        Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {showLogs && selectedSync && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Sync Logs - {selectedSync.id}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(selectedSync.startedAt)} • {syncLogs.length} entries
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No logs available</div>
              ) : (
                <div className="space-y-2">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded border ${
                        log.level === 'ERROR' ? 'bg-red-50 border-red-200' :
                        log.level === 'WARNING' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLogLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm">{log.message}</p>
                          {log.details && (
                            <pre className="text-xs text-gray-600 mt-1 overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.details), null, 2)}
                            </pre>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(log.createdAt)}
                            {log.recordId && ` • Record: ${log.recordId}`}
                            {log.interpreterId && ` • Interpreter: ${log.interpreterId}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t">
              <button
                onClick={() => setShowLogs(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
