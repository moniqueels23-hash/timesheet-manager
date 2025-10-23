import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import ClientsTab from './components/ClientsTab';
import EmployeesTab from './components/EmployeesTab';
import TimesheetsTab from './components/TimesheetsTab';
import ReportsTab from './components/ReportsTab';
import UserManagementTab from './components/UserManagementTab';
import AuditTrailTab from './components/AuditTrailTab';
import SyncSetupTab from './components/SyncSetupTab';

function AppContent() {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('timesheets');

  if (!user) {
    return <Login />;
  }

  const tabs = [
    { id: 'clients', label: 'Clients', component: ClientsTab },
    { id: 'employees', label: 'Employees', component: EmployeesTab },
    { id: 'timesheets', label: 'Timesheets', component: TimesheetsTab },
    { id: 'reports', label: 'Reports', component: ReportsTab },
    { id: 'audit', label: 'Audit Trail', component: AuditTrailTab },
    { id: 'users', label: 'User Management', component: UserManagementTab, adminOnly: true },
    { id: 'sync', label: 'Sync Setup', component: SyncSetupTab }
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || user.role === 'Admin');
  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || TimesheetsTab;

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="bg-app-blue text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Timesheet Manager</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {user.username} ({user.role})
          </span>
          <button
            onClick={logout}
            className="bg-app-blue bg-app-blue-hover px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="border-b bg-white">
        <div className="flex px-6">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-app-blue text-app-blue'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
