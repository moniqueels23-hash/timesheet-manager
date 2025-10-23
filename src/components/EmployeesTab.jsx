import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function EmployeesTab() {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    hourlyRate: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showRateHistory, setShowRateHistory] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);

  useEffect(() => {
    loadEmployees();
    
    window.electron.onDatabaseUpdated(() => {
      loadEmployees();
    });

    return () => {
      window.electron.removeDatabaseUpdatedListener();
    };
  }, []);

  const loadEmployees = async () => {
    const data = await window.electron.employees.getAll();
    setEmployees(data);
  };

  const loadRateHistory = async (employeeId) => {
    const history = await window.electron.employees.getRateHistory(employeeId);
    setRateHistory(history);
    setShowRateHistory(employeeId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      await window.electron.employees.update(editingId, {
        ...formData,
        hourlyRate: parseFloat(formData.hourlyRate)
      });
    } else {
      await window.electron.employees.create({
        ...formData,
        hourlyRate: parseFloat(formData.hourlyRate)
      });
    }

    setFormData({ employeeId: '', name: '', hourlyRate: '' });
    setShowForm(false);
    setEditingId(null);
    loadEmployees();
  };

  const handleEdit = (employee) => {
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name,
      hourlyRate: employee.hourlyRate.toString()
    });
    setEditingId(employee.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      await window.electron.employees.delete(id);
      loadEmployees();
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = hasPermission('edit');
  const canCreate = hasPermission('create');
  const canDelete = hasPermission('delete');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Employees</h2>
        {canCreate && (
          <button
            onClick={() => {
              setFormData({ employeeId: '', name: '', hourlyRate: '' });
              setEditingId(null);
              setShowForm(true);
            }}
            className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
          >
            Add Employee
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search employees..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Employee' : 'New Employee'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hourly Rate
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.hourlyRate}
                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
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

      {showRateHistory && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Rate History</h3>
            <button
              onClick={() => setShowRateHistory(null)}
              className="text-gray-600 hover:text-gray-900"
            >
              Close
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hourly Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rateHistory.map((rate) => (
                <tr key={rate.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(rate.effectiveDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R {rate.hourlyRate.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Employee ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Hourly Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.map((employee) => (
              <tr key={employee.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {employee.employeeId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {employee.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  R {employee.hourlyRate.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => loadRateHistory(employee.employeeId)}
                    className="text-green-600 hover:text-green-900"
                  >
                    History
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-app-blue hover:opacity-80"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
