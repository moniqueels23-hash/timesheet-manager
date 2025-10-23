import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await window.electron.auth.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      if (!window.electron || !window.electron.auth) {
        throw new Error('Electron API not available. Please restart the application.');
      }
      
      const result = await window.electron.auth.login(username, password);
      if (result.success) {
        setUser(result.user);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      return { success: false, error: error.message || 'Connection error' };
    }
  };

  const logout = () => {
    setUser(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    
    const permissionMap = {
      view: 'canView',
      edit: 'canEdit',
      create: 'canCreate',
      delete: 'canDelete',
      export: 'canExport'
    };
    
    return user[permissionMap[permission]] === 1;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
