import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Client } from '@/lib/types';

interface ClientsTabProps {
  clients: Client[];
  onAddClient: () => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({
  clients,
  onAddClient,
  onEditClient,
  onDeleteClient
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Clients</h2>
        <button
          onClick={onAddClient}
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
                    onClick={() => onEditClient(c)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => onDeleteClient(c.id)}
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
  );
};
