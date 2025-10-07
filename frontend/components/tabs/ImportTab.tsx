import React, { useState } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { Client, ColumnMapping } from '@/lib/types';
import { STANDARD_COLUMNS } from '@/lib/constants';
import { paymentsAPI } from '@/lib/api';

interface ImportTabProps {
  selectedClientId: string;
  clients: Client[];
  uploadedFile: File | null;
  importedData: any[];
  columnMapping: ColumnMapping;
  onClientChange: (clientId: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onColumnMappingChange: (mapping: ColumnMapping) => void;
  onSaveMapping: () => void;
  onCalculate: () => void;
  onPaymentsUpdated?: () => void;
}

export const ImportTab: React.FC<ImportTabProps> = ({
  selectedClientId,
  clients,
  uploadedFile,
  importedData,
  columnMapping,
  onClientChange,
  onFileUpload,
  onColumnMappingChange,
  onSaveMapping,
  onCalculate,
  onPaymentsUpdated
}) => {
  const [propioFile, setPropioFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handlePropioImport = async () => {
    if (!propioFile) return;

    try {
      setIsImporting(true);
      const result = await paymentsAPI.importPropioReport(propioFile);

      if (result.success) {
        alert(result.message);
        setPropioFile(null);
        // Reset file input
        const fileInput = document.getElementById('propio-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

        // Notify parent to refresh payments
        if (onPaymentsUpdated) onPaymentsUpdated();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to import Propio report:\n\n${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Import: Propio Report */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-lg border-2 border-purple-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet size={32} className="text-purple-600" />
          <div>
            <h2 className="text-2xl font-bold text-purple-900">Quick Import: Propio Report</h2>
            <p className="text-sm text-purple-700">Upload Propio Excel reports for automatic processing</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border-2 border-dashed border-purple-300">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setPropioFile(e.target.files?.[0] || null)}
              className="hidden"
              id="propio-file-upload"
            />
            <label
              htmlFor="propio-file-upload"
              className="cursor-pointer bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 inline-flex items-center gap-2"
            >
              <Upload size={20} />
              Choose Propio Report
            </label>

            {propioFile && (
              <>
                <span className="text-sm text-gray-700 font-medium">{propioFile.name}</span>
                <button
                  onClick={handlePropioImport}
                  disabled={isImporting}
                  className={`ml-auto px-6 py-2 rounded-lg font-medium ${
                    isImporting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {isImporting ? 'Importing...' : 'Import Now'}
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-gray-600 mt-3">
            💡 Propio reports are automatically processed. No column mapping required!
          </p>
        </div>
      </div>

      {/* Standard Client Import */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Import Other Client Reports</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Client *</label>
          <select
            value={selectedClientId}
            onChange={(e) => onClientChange(e.target.value)}
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
            onChange={onFileUpload}
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
            onClick={onSaveMapping}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mb-4"
          >
            Save Mapping
          </button>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {Object.entries(STANDARD_COLUMNS).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium mb-1">{label}</label>
                <select
                  value={columnMapping[key as keyof ColumnMapping] || ''}
                  onChange={(e) => onColumnMappingChange({...columnMapping, [key]: e.target.value})}
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
            onClick={onCalculate}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 w-full"
          >
            Calculate Payments
          </button>
        </div>
      )}
    </div>
  );
};
