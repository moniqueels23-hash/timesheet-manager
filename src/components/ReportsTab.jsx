import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

export default function ReportsTab() {
  const { hasPermission } = useAuth();
  const [clients, setClients] = useState([]);
  const [reportType, setReportType] = useState('single');
  const [selectedClient, setSelectedClient] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await window.electron.clients.getAll();
    setClients(data);
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let data;
      if (reportType === 'single') {
        const result = await window.electron.reports.generateByClient(
          selectedClient,
          startDate,
          endDate
        );
        data = [result];
      } else {
        data = await window.electron.reports.generateAll(startDate, endDate);
      }
      setReportData(data);
    } catch (error) {
      alert('Error generating report: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!reportData) return;
    
    const filename = reportType === 'single'
      ? `${selectedClient}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      : `all-clients-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    const result = await window.electron.reports.exportToExcel(reportData, filename);
    if (result.success) {
      alert('Exported to Excel successfully!');
    } else {
      alert('Export failed: ' + result.error);
    }
  };

  const exportToPDF = async () => {
    if (!reportData) return;
    
    const filename = reportType === 'single'
      ? `${selectedClient}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      : `all-clients-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    const result = await window.electron.reports.exportToPDF(reportData, filename);
    if (result.success) {
      alert('Exported to PDF successfully!');
    } else {
      alert('Export failed: ' + result.error);
    }
  };

  const formatDateDisplay = (dateStr) => {
    try {
      const date = new Date(dateStr);
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

  const canExport = hasPermission('export');

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Reports</h2>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded"
            >
              <option value="single">Single Client</option>
              <option value="all">All Clients</option>
            </select>
          </div>

          {reportType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded"
                required
              >
                <option value="">Select Client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.clientId}>{c.clientName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={generateReport}
            disabled={loading || (reportType === 'single' && !selectedClient)}
            className="bg-app-blue bg-app-blue-hover text-white px-6 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>

          {reportData && canExport && (
            <>
              <button
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                Export to Excel
              </button>
              <button
                onClick={exportToPDF}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
              >
                Export to PDF
              </button>
            </>
          )}
        </div>
      </div>

      {reportData && reportData.map(({ client, timesheets }, idx) => (
        <div key={idx} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div className="flex justify-between items-stretch mb-4">
            <div className="bg-app-blue text-white px-4 py-2.5 rounded-lg font-bold text-sm flex items-center">
              {client.clientName}
            </div>
            <div className="bg-app-blue text-white px-4 py-2.5 rounded-lg font-bold text-sm flex items-center">
              {client.clientId}
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-300">
            <table className="min-w-full border-collapse text-xs" style={{tableLayout: 'auto', width: '100%'}}>
              <thead className="bg-app-blue text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold border-r border-white whitespace-nowrap">Date</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold border-r border-white">Description</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold border-r border-white whitespace-nowrap">ID</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold border-r border-white whitespace-nowrap">Time</th>
                  <th className="px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap">Charge Out</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {timesheets.map((ts, tsIdx) => {
                  const displayId = ts.entryType === 'Close-off'
                    ? 'C/O'
                    : ts.entryType === 'Transfer' 
                      ? (ts.transferToClientId || ts.transferFromClientId || ts.linkedId)
                      : ts.linkedId;
                  
                  return (
                    <tr key={tsIdx} className={getRowClass(ts.entryType)}>
                      <td className="px-2 py-1 whitespace-nowrap border-b border-r border-gray-300">{formatDateDisplay(ts.date)}</td>
                      <td className="px-2 py-1 border-b border-r border-gray-300">{ts.description}</td>
                      <td className="px-2 py-1 whitespace-nowrap font-medium border-b border-r border-gray-300">{displayId}</td>
                      <td className="px-2 py-1 whitespace-nowrap border-b border-r border-gray-300 text-center">{ts.timeSpent}</td>
                      <td className="px-2 py-1 whitespace-nowrap border-b border-gray-300">R {ts.chargeOut}</td>
                    </tr>
                  );
                })}
                <tr className="bg-app-blue text-white font-bold">
                  <td colSpan="4" className="px-2 py-1.5 text-right border-r border-white">TOTAL:</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    R {timesheets.reduce((sum, ts) => sum + ts.chargeOut, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {reportData && reportData.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
          No data found for the selected criteria
        </div>
      )}
    </div>
  );
}
