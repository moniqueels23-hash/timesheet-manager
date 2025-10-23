import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { format, parse } from 'date-fns';

const FRACTION_OPTIONS = ['¼', '½', '¾', '1', '1¼', '1½', '1¾', '2', '2¼', '2½', '2¾', '3', '3¼', '3½', '3¾', '4', '4¼', '4½', '4¾', '5', '5¼', '5½', '5¾', '6', '6¼', '6½', '6¾', '7', '7¼', '7½', '7¾', '8'];

export default function TimesheetsTab() {
  const { hasPermission } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    clientId: '',
    description: '',
    linkedId: '',
    timeSpent: '¼',
    chargeOut: '',
    entryType: 'Normal',
    transferFromClientId: '',
    transferToClientId: ''
  });
  
  // Set default date filter to current month for performance
  const getDefaultStartDate = () => {
    const now = new Date();
    return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
  };
  
  const getDefaultEndDate = () => {
    const now = new Date();
    return format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');
  };
  
  const [filters, setFilters] = useState({
    clientId: '',
    linkedId: '',
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate()
  });

  useEffect(() => {
    loadData();
    loadReferenceData();
    
    window.electron.onDatabaseUpdated(() => {
      loadData();
      loadReferenceData();
    });

    return () => {
      window.electron.removeDatabaseUpdatedListener();
    };
  }, []);
  
  useEffect(() => {
    loadData();
  }, [page, pageSize, filters]);

  const loadReferenceData = async () => {
    const [clData, empData] = await Promise.all([
      window.electron.clients.getAll(),
      window.electron.employees.getAll()
    ]);
    setClients(clData);
    setEmployees(empData);
  };

  const loadData = async () => {
    const response = await window.electron.timesheets.getAll({
      page,
      pageSize,
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      clientId: filters.clientId || null,
      linkedId: filters.linkedId || null
    });
    
    setTimesheets(response.timesheets);
    setTotal(response.total);
    setTotalPages(response.totalPages);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      chargeOut: formData.chargeOut ? parseFloat(formData.chargeOut) : undefined
    };

    if (editingId) {
      await window.electron.timesheets.update(editingId, submitData);
    } else {
      await window.electron.timesheets.create(submitData);
    }

    resetForm();
    loadData();
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      clientId: '',
      description: '',
      linkedId: '',
      timeSpent: '¼',
      chargeOut: '',
      entryType: 'Normal',
      transferFromClientId: '',
      transferToClientId: ''
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (timesheet) => {
    setFormData({
      date: timesheet.date,
      clientId: timesheet.clientId,
      description: timesheet.description,
      linkedId: timesheet.linkedId,
      timeSpent: timesheet.timeSpent,
      chargeOut: timesheet.chargeOut.toString(),
      entryType: timesheet.entryType,
      transferFromClientId: timesheet.transferFromClientId || '',
      transferToClientId: timesheet.transferToClientId || ''
    });
    setEditingId(timesheet.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this timesheet entry?')) {
      await window.electron.timesheets.delete(id);
      loadData();
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
          date: row.Date || row.date,
          clientName: row['Client Name'] || row.clientName || row.Client,
          description: row.Description || row.description,
          employeeId: row['Employee ID'] || row.employeeId || row.ID,
          timeSpent: row['Time Spent'] || row.timeSpent || row.Time,
          entryType: row['Entry Type'] || row.entryType || 'Normal',
          chargeOut: row['Charge Out'] || row.chargeOut
        }));

        const result = await window.electron.timesheets.import(importData);
        alert(`Import complete:\n${result.success} entries added\n${result.errors.length} errors\n\n${result.errors.join('\n')}`);
        
        // Reset form and close import dialog
        resetForm();
        setShowImport(false);
        loadData();
      } catch (error) {
        alert('Import failed: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const formatDateDisplay = (dateStr) => {
    try {
      const date = parse(dateStr, 'yyyy-MM-dd', new Date());
      return format(date, 'dd.MM.yyyy');
    } catch {
      return dateStr;
    }
  };

  const getRowClass = (entryType) => {
    if (entryType === 'Close-off') return 'timesheet-row-closeoff';
    if (entryType === 'Transfer') return 'timesheet-row-transfer';
    return 'timesheet-row-normal';
  };
  
  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPage(1); // Reset to first page when filter changes
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };
  
  const handlePageSizeChange = (newSize) => {
    setPageSize(parseInt(newSize));
    setPage(1); // Reset to first page when page size changes
  };

  const canEdit = hasPermission('edit');
  const canCreate = hasPermission('create');
  const canDelete = hasPermission('delete');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Timesheets</h2>
        <div className="space-x-2">
          {canCreate && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Import CSV/Excel
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
              >
                Add Entry
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <select
              value={filters.clientId}
              onChange={(e) => handleFilterChange('clientId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.clientId}>{c.clientName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={filters.linkedId}
              onChange={(e) => handleFilterChange('linkedId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            >
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.employeeId}>{e.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>
        
        <div className="mt-3 text-sm text-gray-600">
          Showing {timesheets.length} of {total.toLocaleString()} total entries
        </div>
      </div>

      {showImport && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Import Timesheets</h3>
          <p className="text-sm text-gray-600 mb-4">
            Excel/CSV should have columns: Date, Client Name, Description, Employee ID, Time Spent, Entry Type, Charge Out (optional)
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
            {editingId ? 'Edit Timesheet Entry' : 'New Timesheet Entry'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                disabled={false}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                disabled={false}
                required
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.clientId}>{c.clientName}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                rows="2"
                disabled={false}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
              <select
                value={formData.entryType}
                onChange={(e) => setFormData({ ...formData, entryType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                disabled={false}
                required
              >
                <option value="Normal">Normal</option>
                <option value="Close-off">Close-off</option>
                <option value="Transfer">Transfer</option>
              </select>
            </div>

            {formData.entryType === 'Normal' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <select
                    value={formData.linkedId}
                    onChange={(e) => setFormData({ ...formData, linkedId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                    disabled={false}
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.employeeId}>{e.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Spent</label>
                  <select
                    value={formData.timeSpent}
                    onChange={(e) => setFormData({ ...formData, timeSpent: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                    disabled={false}
                    required
                  >
                    {FRACTION_OPTIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {formData.entryType === 'Close-off' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Charge Out Amount (will be negative)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.chargeOut}
                  onChange={(e) => setFormData({ ...formData, chargeOut: e.target.value, linkedId: 'CLOSEOFF' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                  disabled={false}
                  required
                />
              </div>
            )}

            {formData.entryType === 'Transfer' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer To Client</label>
                  <select
                    value={formData.transferToClientId}
                    onChange={(e) => setFormData({ ...formData, transferToClientId: e.target.value, linkedId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                    disabled={false}
                    required
                  >
                    <option value="">Select Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.clientId}>{c.clientName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.chargeOut}
                    onChange={(e) => setFormData({ ...formData, chargeOut: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded"
                    disabled={false}
                    required
                  />
                </div>
              </>
            )}

            <div className="col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charge Out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              {(canEdit || canDelete) && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timesheets.map((ts) => {
              const displayId = ts.entryType === 'Transfer' ? (ts.transferToClientId || ts.transferFromClientId) : ts.linkedId;
              return (
                <tr key={ts.id} className={getRowClass(ts.entryType)}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{formatDateDisplay(ts.date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{ts.clientId}</td>
                  <td className="px-4 py-3 text-sm">{ts.description}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{displayId}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{ts.timeSpent}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">R {ts.chargeOut}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">{ts.entryType}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                      {canEdit && (
                        <button onClick={() => handleEdit(ts)} className="text-app-blue hover:opacity-80">
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(ts.id)} className="text-red-600 hover:text-red-900">
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-700">
                Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                First
              </button>
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
