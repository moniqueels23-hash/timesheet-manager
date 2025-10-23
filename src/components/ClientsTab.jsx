import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ClientsTab() {
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    clientId: '',
    clientName: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
    
    window.electron.onDatabaseUpdated(() => {
      loadClients();
    });

    return () => {
      window.electron.removeDatabaseUpdatedListener();
    };
  }, []);

  const loadClients = async () => {
    const data = await window.electron.clients.getAll();
    setClients(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      await window.electron.clients.update(editingId, formData);
    } else {
      await window.electron.clients.create(formData);
    }

    setFormData({ clientId: '', clientName: '', notes: '' });
    setShowForm(false);
    setEditingId(null);
    loadClients();
  };

  const handleEdit = (client) => {
    setFormData({
      clientId: client.clientId,
      clientName: client.clientName,
      notes: client.notes || ''
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this client?')) {
      await window.electron.clients.delete(id);
      loadClients();
    }
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const importData = jsonData.map(row => ({
          clientId: row['Client ID'] || row.clientId || row.ID,
          clientName: row['Client Name'] || row.clientName || row.Name,
          notes: row.Notes || row.notes || ''
        }));

        const result = await window.electron.clients.import(importData);
        alert(`Import complete:\n${result.success} clients added\n${result.errors.length} errors\n\n${result.errors.join('\n')}`);
        
        setShowImport(false);
        loadClients();
      } catch (error) {
        alert('Import failed: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredClients = clients.filter(client =>
    client.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.clientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasPermission('edit');
  const canCreate = hasPermission('create');
  const canDelete = hasPermission('delete');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Clients</h2>
        {canCreate && (
          <div className="space-x-2">
            <button
              onClick={() => setShowImport(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Import CSV/Excel
            </button>
            <button
              onClick={() => {
                setFormData({ clientId: '', clientName: '', notes: '' });
                setEditingId(null);
                setShowForm(true);
              }}
              className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
            >
              Add Client
            </button>
          </div>
        )}
      </div>

      <input
        type="text"
        placeholder="Search clients..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />

      {showImport && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Import Clients</h3>
          <p className="text-sm text-gray-600 mb-4">
            Excel/CSV should have columns: <strong>Client ID, Client Name, Notes</strong> (optional)
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Example:<br/>
            CLI001, ABC Corporation, Tax client<br/>
            CLI002, XYZ Ltd, Audit services
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileImport}
            className="mb-4"
          />
          <button
            onClick={() => setShowImport(false)}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Client' : 'New Client'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client ID
              </label>
              <input
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client Name
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                rows="3"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Client ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Client Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Notes
              </th>
              {(canEdit || canDelete) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredClients.map((client) => (
              <tr key={client.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {client.clientId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {client.clientName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {client.notes}
                </td>
                {(canEdit || canDelete) && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {canEdit && (
                      <button
                        onClick={() => handleEdit(client)}
                        className="text-app-blue hover:opacity-80"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
