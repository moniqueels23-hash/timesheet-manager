import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export default function AuditTrailTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    username: '',
    action: '',
    tableName: ''
  });
  const [selectedLog, setSelectedLog] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await window.electron.audit.getLogs(filters);
      setLogs(result);
    } catch (error) {
      alert('Error loading audit logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    loadLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      username: '',
      action: '',
      tableName: ''
    });
    setTimeout(() => loadLogs(), 0);
  };

  const formatTimestamp = (timestamp) => {
    try {
      return format(new Date(timestamp), 'dd.MM.yyyy HH:mm:ss');
    } catch {
      return timestamp;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'text-green-600 font-semibold';
      case 'UPDATE': return 'text-app-blue font-semibold';
      case 'DELETE': return 'text-red-600 font-semibold';
      case 'RATE_CHANGE': return 'text-orange-600 font-semibold';
      default: return 'text-gray-600';
    }
  };

  const showDetails = (log) => {
    setSelectedLog(log);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Audit Trail</h2>
        
        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={filters.username}
                onChange={(e) => handleFilterChange('username', e.target.value)}
                placeholder="Filter by user"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">All Actions</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="RATE_CHANGE">Rate Change</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Table</label>
              <select
                value={filters.tableName}
                onChange={(e) => handleFilterChange('tableName', e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="">All Tables</option>
                <option value="Clients">Clients</option>
                <option value="Employees">Employees</option>
                <option value="Timesheets">Timesheets</option>
                <option value="Users">Users</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-app-blue text-white rounded hover:bg-app-blue"
            >
              Search
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full">
                <thead className="bg-app-blue text-white sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Timestamp</th>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">Action</th>
                    <th className="px-4 py-2 text-left">Table</th>
                    <th className="px-4 py-2 text-left">Record ID</th>
                    <th className="px-4 py-2 text-left">Details</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{formatTimestamp(log.timestamp)}</td>
                        <td className="px-4 py-2 font-medium">{log.username}</td>
                        <td className={`px-4 py-2 ${getActionColor(log.action)}`}>
                          {log.action}
                        </td>
                        <td className="px-4 py-2">{log.tableName}</td>
                        <td className="px-4 py-2 text-sm">{log.recordId}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{log.details}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => showDetails(log)}
                            className="text-app-blue hover:underline text-sm"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Showing {logs.length} log{logs.length !== 1 ? 's' : ''} (max 1000)
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Audit Log Details</h3>
            
            <div className="space-y-3">
              <div>
                <span className="font-semibold">Timestamp:</span> {formatTimestamp(selectedLog.timestamp)}
              </div>
              <div>
                <span className="font-semibold">User:</span> {selectedLog.username}
              </div>
              <div>
                <span className="font-semibold">Action:</span> <span className={getActionColor(selectedLog.action)}>{selectedLog.action}</span>
              </div>
              <div>
                <span className="font-semibold">Table:</span> {selectedLog.tableName}
              </div>
              <div>
                <span className="font-semibold">Record ID:</span> {selectedLog.recordId}
              </div>
              <div>
                <span className="font-semibold">Details:</span> {selectedLog.details}
              </div>
              
              {selectedLog.oldValues && (
                <div>
                  <span className="font-semibold">Old Values:</span>
                  <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.oldValues), null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLog.newValues && (
                <div>
                  <span className="font-semibold">New Values:</span>
                  <pre className="mt-1 p-3 bg-gray-100 rounded text-sm overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedLog.newValues), null, 2)}
                  </pre>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
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
}
