import React, { useState, useEffect } from 'react';

export default function UserManagementTab() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'Normal',
    canEdit: false,
    canCreate: false,
    canDelete: false,
    canView: true,
    canExport: false
  });

  useEffect(() => {
    loadUsers();
    
    window.electron.onDatabaseUpdated(() => {
      loadUsers();
    });

    return () => {
      window.electron.removeDatabaseUpdatedListener();
    };
  }, []);

  const loadUsers = async () => {
    const data = await window.electron.users.getAll();
    setUsers(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      await window.electron.users.update(editingId, formData);
    } else {
      await window.electron.users.create(formData);
    }

    resetForm();
    loadUsers();
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      role: 'Normal',
      canEdit: false,
      canCreate: false,
      canDelete: false,
      canView: true,
      canExport: false
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (user) => {
    setFormData({
      username: user.username,
      password: '',
      role: user.role,
      canEdit: user.canEdit === 1,
      canCreate: user.canCreate === 1,
      canDelete: user.canDelete === 1,
      canView: user.canView === 1,
      canExport: user.canExport === 1
    });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await window.electron.users.delete(id);
      loadUsers();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-app-blue bg-app-blue-hover text-white px-4 py-2 rounded"
        >
          Add User
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit User' : 'New User'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {editingId && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                  required={!editingId}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded"
                >
                  <option value="Admin">Admin</option>
                  <option value="Normal">Normal</option>
                </select>
              </div>
            </div>

            {formData.role === 'Normal' && (
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-medium mb-3">Permissions</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canView}
                      onChange={(e) => setFormData({ ...formData, canView: e.target.checked })}
                      className="mr-2"
                    />
                    Can View
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canCreate}
                      onChange={(e) => setFormData({ ...formData, canCreate: e.target.checked })}
                      className="mr-2"
                    />
                    Can Create
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canEdit}
                      onChange={(e) => setFormData({ ...formData, canEdit: e.target.checked })}
                      className="mr-2"
                    />
                    Can Edit
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canDelete}
                      onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                      className="mr-2"
                    />
                    Can Delete
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.canExport}
                      onChange={(e) => setFormData({ ...formData, canExport: e.target.checked })}
                      className="mr-2"
                    />
                    Can Export Reports
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-2">
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.username}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.role}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.role === 'Admin' ? (
                    <span className="text-app-blue font-medium">All Permissions</span>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {user.canView === 1 && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">View</span>}
                      {user.canCreate === 1 && <span className="bg-blue-100 text-app-blue px-2 py-1 rounded text-xs">Create</span>}
                      {user.canEdit === 1 && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Edit</span>}
                      {user.canDelete === 1 && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">Delete</span>}
                      {user.canExport === 1 && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">Export</span>}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(user)}
                    className="text-app-blue hover:opacity-80"
                  >
                    Edit
                  </button>
                  {user.username !== 'admin' && (
                    <button
                      onClick={() => handleDelete(user.id)}
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
