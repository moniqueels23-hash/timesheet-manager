import React, { useState, useEffect } from 'react';

export default function SyncSetupTab() {
  const [syncPath, setSyncPath] = useState('');
  const [lastSync, setLastSync] = useState('');

  useEffect(() => {
    loadSyncInfo();
  }, []);

  const loadSyncInfo = async () => {
    const path = await window.electron.sync.getSyncPath();
    const last = await window.electron.sync.getLastSync();
    setSyncPath(path || 'Not configured');
    setLastSync(last || 'Never');
  };

  const handleSelectFolder = async () => {
    const result = await window.electron.sync.selectFolder();
    if (result.success) {
      alert('Shared data file created successfully!\n\nPath: ' + result.path + '\n\nOther users can now connect to this file by selecting it in their Sync Setup.');
      loadSyncInfo();
    } else if (result.error) {
      alert('Error: ' + result.error);
    }
  };

  const handleSelectFile = async () => {
    const result = await window.electron.sync.selectFile();
    if (result.success) {
      alert('Connected to shared data file successfully!\n\nPath: ' + result.path);
      loadSyncInfo();
    } else if (result.error) {
      alert('Error: ' + result.error);
    }
  };

  const handleSyncNow = async () => {
    const result = await window.electron.sync.syncNow();
    if (result.success) {
      alert('Synced successfully!');
      loadSyncInfo();
    } else {
      alert('Sync failed: ' + result.error);
    }
  };

  const handleExportBackup = async () => {
    const result = await window.electron.backup.export();
    if (result.success) {
      alert('Backup exported successfully to:\n' + result.path);
    } else if (result.error) {
      alert('Export failed: ' + result.error);
    }
  };

  const handleImportBackup = async () => {
    if (confirm('This will replace all current data with the backup. Are you sure?')) {
      const result = await window.electron.backup.import();
      if (result.success) {
        alert('Backup imported successfully!');
        window.location.reload();
      } else if (result.error) {
        alert('Import failed: ' + result.error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Sync Setup</h2>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Google Drive Sync</h3>
        <p className="text-sm text-gray-600">
          Set up data syncing via Google Drive Desktop. Multiple users can work on the same data file.
        </p>

        <div className="bg-blue-50 p-4 rounded space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Current Linked File:</span>
            <span className="text-sm text-gray-900 font-mono">{syncPath}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-700">Last Sync:</span>
            <span className="text-sm text-gray-900">
              {lastSync !== 'Never' ? new Date(lastSync).toLocaleString() : lastSync}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Step 1: Create or Connect to Shared File</h4>
            <div className="flex gap-2">
              <button
                onClick={handleSelectFolder}
                className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
              >
                Select Folder Path (Create New)
              </button>
              <button
                onClick={handleSelectFile}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Select Existing Data File
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose a folder inside your Google Drive to create a new shared file, or connect to an existing file.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-700 mb-2">Step 2: Sync Data</h4>
            <button
              onClick={handleSyncNow}
              disabled={syncPath === 'Not configured'}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              Sync Now
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Manually sync with the shared file. The app automatically syncs when changes are detected.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Backup & Restore</h3>
        <p className="text-sm text-gray-600">
          Create a backup of all data or restore from a previous backup.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleExportBackup}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Export Backup
          </button>
          <button
            onClick={handleImportBackup}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
          >
            Import Backup
          </button>
        </div>

        <div className="bg-yellow-50 p-4 rounded">
          <p className="text-sm text-yellow-800">
            <strong>Warning:</strong> Importing a backup will replace all current data. Make sure to create a backup first if needed.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-3">
        <h3 className="text-lg font-semibold text-gray-800">How It Works</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>1. Create Shared File:</strong> Choose a folder in your Google Drive Desktop sync folder. The app creates a shared database file there.</p>
          <p><strong>2. Share with Team:</strong> Other team members install the app and use "Select Existing Data File" to connect to the same file.</p>
          <p><strong>3. Auto-Sync:</strong> The app monitors the file for changes and automatically reloads when updates are detected from other users.</p>
          <p><strong>4. Permissions:</strong> User permissions are stored in the database, so they sync across all installations.</p>
        </div>
      </div>
    </div>
  );
}
