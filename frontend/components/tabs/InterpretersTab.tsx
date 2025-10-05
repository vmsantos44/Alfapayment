import React from 'react';
import { Upload, Users, Plus, Edit, Trash2 } from 'lucide-react';
import { Interpreter } from '@/lib/types';

interface InterpretersTabProps {
  interpreters: Interpreter[];
  onImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddInterpreter: () => void;
  onEditInterpreter: (interpreter: Interpreter) => void;
  onDeleteInterpreter: (id: string) => void;
}

export const InterpretersTab: React.FC<InterpretersTabProps> = ({
  interpreters,
  onImportCSV,
  onAddInterpreter,
  onEditInterpreter,
  onDeleteInterpreter
}) => {
  return (
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
              onChange={onImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={onAddInterpreter}
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
                        onClick={() => onEditInterpreter(i)}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => onDeleteInterpreter(i.id)}
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
  );
};
